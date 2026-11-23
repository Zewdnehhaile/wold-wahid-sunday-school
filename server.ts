import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { db } from './backend/src/services/firebase.ts';
import { getBot, handleTelegramUpdate, dispatchSendMessage } from './backend/src/services/bot.ts';
import {
  normalizeStudentCode,
  isDepartmentShortCode,
  getDepartmentPrefix,
  resolveDepartmentKey,
} from './backend/src/utils/idCodes.ts';

const __dirname = import.meta.dirname || path.dirname(fileURLToPath(import.meta.url));

dotenv.config();

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Cache-busting middleware + COOP allow-popups for Telegram OIDC Login popup
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    next();
  });

  // API Routes & Health Checks
  app.get(['/api/health', '/health', '/ping'], (req, res) => {
    res.json({
      status: 'ok',
      service: 'wold-wahid-sunday-school-backend',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Instant APK Direct Download Routes (downloads WoldWahid.apk immediately)
  app.get([
    '/download/wold-wahid.apk',
    '/download/WoldWahid.apk',
    '/download/app.apk',
    '/download',
    '/WoldWahid.apk',
    '/wold-wahid.apk',
    '/api/download/apk'
  ], (req, res) => {
    const candidatePaths = [
      path.resolve(process.cwd(), 'public/WoldWahid.apk'),
      path.resolve(process.cwd(), 'dist/WoldWahid.apk'),
      path.resolve(__dirname, 'public/WoldWahid.apk'),
      path.resolve(__dirname, 'dist/WoldWahid.apk'),
    ];

    const apkPath = candidatePaths.find(p => fs.existsSync(p));
    if (!apkPath) {
      return res.status(404).json({ error: 'APK file not found on server' });
    }

    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="WoldWahid.apk"');
    return res.download(apkPath, 'WoldWahid.apk', (err) => {
      if (err && !res.headersSent) {
        console.error('APK download error:', err);
        res.status(500).json({ error: 'Error downloading APK' });
      }
    });
  });

  // Attendance Logging API (used by mobile app scanner and web app)
  app.post('/api/attendance', async (req, res) => {
    try {
      const {
        memberCode,
        memberNameAm,
        memberNameEn,
        sessionName,
        method = 'qr',
        timestamp = new Date().toLocaleTimeString(),
        date = new Date().toISOString().split('T')[0],
        status = 'present',
        department
      } = req.body;

      if (!memberCode) {
        return res.status(400).json({ error: 'memberCode is required' });
      }

      const rawMemberCode = String(memberCode).trim();
      const normCode = normalizeStudentCode(rawMemberCode);
      const upperCode = rawMemberCode.toUpperCase();

      // Look up student details to enrich attendance record (supports EDU001, edu001, and legacy WW-2026 codes)
      let studentName = memberNameAm || memberNameEn || '';
      let studentDept = department || '';
      let studentTgId = '';
      let resolvedCode = normCode || upperCode;

      try {
        const codeDigits = rawMemberCode.replace(/\D/g, '');
        let foundDoc: any = null;

        const studentByCode = await db.collection('students').where('code', '==', normCode).limit(1).get();
        if (!studentByCode.empty) foundDoc = studentByCode.docs[0];

        if (!foundDoc && upperCode !== normCode) {
          const studentByRaw = await db.collection('students').where('code', '==', upperCode).limit(1).get();
          if (!studentByRaw.empty) foundDoc = studentByRaw.docs[0];
        }

        if (!foundDoc) {
          const studentByLegacy = await db.collection('students').where('legacyCode', '==', upperCode).limit(1).get();
          if (!studentByLegacy.empty) foundDoc = studentByLegacy.docs[0];
        }

        if (!foundDoc && codeDigits.length >= 9) {
          const last9 = codeDigits.slice(-9);
          const studentByPhone = await db.collection('students').where('phone', '>=', '0' + last9).where('phone', '<=', '0' + last9 + '\uf8ff').limit(1).get();
          if (!studentByPhone.empty) foundDoc = studentByPhone.docs[0];
        }

        if (!foundDoc) {
          const regByCode = await db.collection('registrations').where('studentCode', '==', normCode).limit(1).get();
          if (!regByCode.empty) foundDoc = regByCode.docs[0];
        }

        if (foundDoc) {
          const dData = foundDoc.data();
          resolvedCode = dData.code || dData.studentCode || resolvedCode;
          studentName = studentName || dData.fullNameAm || dData.fullNameEn || '';
          studentDept = studentDept || dData.department || '';
          studentTgId = dData.telegramId || dData.tgId || '';
        }
      } catch (e) {
        console.warn('Error resolving student for attendance:', e);
      }

      const cleanCode = resolvedCode;

      const attendanceRecord = {
        memberCode: cleanCode,
        memberNameAm: studentName || 'ተማሪ',
        memberNameEn: memberNameEn || studentName || 'Student',
        department: studentDept || 'education',
        sessionName: sessionName || 'እሁድ መደበኛ ትምህርት (Sunday School Class)',
        timestamp: timestamp || new Date().toLocaleTimeString(),
        date: date || new Date().toISOString().split('T')[0],
        method: method || 'qr',
        status: status || 'present',
        createdAt: new Date().toISOString(),
        telegramId: studentTgId || '',
      };

      const docRef = await db.collection('attendance').add(attendanceRecord);

      // Notify student on Telegram if telegramId available
      if (studentTgId) {
        try {
          const bot = getBot();
          const msg =
            `✅ *የመገኘት ምዝገባ ተረጋግጧል! (Attendance Confirmed)*\n` +
            `⛪ *መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን*\n` +
            `═══════════════════════\n\n` +
            `👤 *ተማሪ:* ${attendanceRecord.memberNameAm}\n` +
            `🆔 *መታወቂያ:* \`${cleanCode}\`\n` +
            `📖 *ክፍለ-ጊዜ:* ${attendanceRecord.sessionName}\n` +
            `⏰ *ሰዓት:* ${attendanceRecord.timestamp}\n` +
            `📅 *ቀን:* ${attendanceRecord.date}\n` +
            `🟢 *ሁኔታ:* ተገኝተዋል (Present)\n\n` +
            `እግዚአብሔር ይባርክዎ!`;

          if (bot) {
            await bot.sendMessage(studentTgId, msg, { parse_mode: 'Markdown' });
          } else {
            await dispatchSendMessage(studentTgId, msg, { parse_mode: 'Markdown' });
          }
        } catch (tgErr) {
          console.warn('Failed to notify student on Telegram for attendance:', tgErr);
        }
      }

      res.json({ success: true, id: docRef.id, record: attendanceRecord });
    } catch (err: any) {
      console.error('Error recording attendance:', err);
      res.status(500).json({ error: 'Failed to record attendance: ' + (err.message || 'Unknown error') });
    }
  });

  // Get all attendance records (for admin dashboard / live scanner feed)
  app.get('/api/attendance', async (req, res) => {
    try {
      const snap = await db.collection('attendance').get();
      const records = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      records.sort((a: any, b: any) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime());
      res.json(records);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch attendance records' });
    }
  });

  // Telegram Webhook Endpoint
  app.post('/api/telegram/webhook', async (req, res) => {
    try {
      await handleTelegramUpdate(req.body);
      res.sendStatus(200);
    } catch (err) {
      console.error('Error in Telegram webhook endpoint:', err);
      res.sendStatus(200);
    }
  });

  // List all pending/recent registrations directly from Firestore
  app.get('/api/registrations', async (req, res) => {
    try {
      const snap = await db.collection('registrations').get();
      const list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      res.json(list);
    } catch (error) {
      console.error('Error fetching registrations:', error);
      res.status(500).json({ error: 'Failed to fetch registrations' });
    }
  });

  // List all students directly from Firestore
  app.get('/api/students', async (req, res) => {
    try {
      const snap = await db.collection('students').get();
      const list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      res.json(list);
    } catch (error) {
      console.error('Error fetching students:', error);
      res.status(500).json({ error: 'Failed to fetch students' });
    }
  });

  // List all leave requests directly from Firestore
  app.get('/api/leave_requests', async (req, res) => {
    try {
      const snap = await db.collection('leave_requests').get();
      const list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      res.json(list);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      res.status(500).json({ error: 'Failed to fetch leave requests' });
    }
  });

  app.get('/api/registrations/:id', async (req, res) => {
    try {
      const doc = await db.collection('registrations').doc(req.params.id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Registration not found' });
      }
      res.json({ id: doc.id, ...doc.data() });
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Fetch all admins directly from Firestore
  app.get('/api/admins', async (req, res) => {
    try {
      const snap = await db.collection('admins').get();
      const list = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      res.json(list);
    } catch (error) {
      console.error('Error in /api/admins:', error);
      res.status(500).json({ error: 'Failed to fetch admins' });
    }
  });

  // Admin lookup by phone number (Pure Firestore query - no hardcoded fallbacks)
  app.get(['/api/admins/:phone', '/api/admin/:phone'], async (req, res) => {
    try {
      const phoneParam = Array.isArray(req.params.phone) ? req.params.phone[0] : req.params.phone;
      const cleanPhone = (phoneParam || '').replace(/\D/g, '').slice(-9);

      if (!cleanPhone) {
        return res.status(400).json({ error: 'Valid phone number is required' });
      }

      // 1. Check admins collection in Firestore using targeted where
      try {
        // Try direct phone match and common formats
        const formats = [cleanPhone, '0' + cleanPhone, '+251' + cleanPhone];
        const adminsSnap = await db.collection('admins').where('phone', 'in', formats).limit(1).get();
        
        if (!adminsSnap.empty) {
          const doc = adminsSnap.docs[0];
          const data = doc.data();
          return res.json({
            id: doc.id,
            ...data,
            role: data.role || 'admin',
            password: data.password || ''
          });
        }
      } catch (e) {
        console.warn('Error reading admins collection:', e);
      }

      // 2. Check students collection for records with admin / super_admin role
      try {
        const formats = [cleanPhone, '0' + cleanPhone, '+251' + cleanPhone];
        const studentsSnap = await db.collection('students')
          .where('phone', 'in', formats)
          .limit(1)
          .get();
        
        if (!studentsSnap.empty) {
          const doc = studentsSnap.docs[0];
          const data = doc.data();
          if (data.role === 'admin' || data.role === 'super_admin') {
            return res.json({ 
              id: doc.id, 
              ...data, 
              role: data.role,
              password: data.password || '' 
            });
          }
        }
      } catch (e) {
        console.warn('Error reading students for admin lookup:', e);
      }

      return res.status(404).json({ error: 'Admin not found' });
    } catch (error) {
      console.error('Error in /api/admins/:phone:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Admin Login Endpoint (Verifies password or SHA-256 hash against database)
  app.post('/api/admins/login', async (req, res) => {
    try {
      const { phone, password } = req.body;
      if (!phone || !password) {
        return res.status(400).json({ error: 'Phone and password are required' });
      }
      const cleanPhone = String(phone).replace(/\D/g, '').slice(-9);
      const cleanPass = String(password).trim();
      const inputHash = crypto.createHash('sha256').update(cleanPass).digest('hex');

      // Check admins collection
      const adminsSnap = await db.collection('admins').get();
      for (const doc of adminsSnap.docs) {
        const data = doc.data();
        const dPhone = String(data.phone || '').replace(/\D/g, '').slice(-9);
        if (dPhone && cleanPhone && dPhone === cleanPhone) {
          if (data.status === 'suspended') {
            return res.status(403).json({ error: 'ይህ የአስተዳዳሪ አካውንት ታግዷል (Account is suspended)' });
          }
          const storedPassword = String(data.password || '').trim();
          const storedHash = String(data.passwordHash || '').trim();
          const isMatch = (storedPassword && cleanPass === storedPassword) ||
                          (storedHash && inputHash === storedHash) ||
                          (storedPassword && inputHash === storedPassword);

          if (!isMatch) {
            return res.status(401).json({ error: 'የተሳሳተ የይለፍ ቃል (Incorrect admin password)' });
          }
          return res.json({
            success: true,
            role: data.role || 'admin',
            admin: {
              id: doc.id,
              nameAm: data.nameAm || '',
              nameEn: data.nameEn || '',
              phone: data.phone,
              role: data.role || 'admin',
              department: data.department || 'general',
              permissions: data.permissions || {},
              customRoleTitle: data.customRoleTitle || ''
            }
          });
        }
      }

      // Check students collection for admin role
      const studentsSnap = await db.collection('students').get();
      for (const doc of studentsSnap.docs) {
        const data = doc.data();
        const sPhone = String(data.phone || '').replace(/\D/g, '').slice(-9);
        if (sPhone && cleanPhone && sPhone === cleanPhone && (data.role === 'admin' || data.role === 'super_admin')) {
          const storedPassword = String(data.password || '').trim();
          const storedHash = String(data.passwordHash || '').trim();
          const isMatch = (storedPassword && cleanPass === storedPassword) ||
                          (storedHash && inputHash === storedHash) ||
                          (storedPassword && inputHash === storedPassword);

          if (!isMatch) {
            return res.status(401).json({ error: 'የተሳሳተ የይለፍ ቃል (Incorrect admin password)' });
          }
          return res.json({
            success: true,
            role: data.role,
            admin: {
              id: doc.id,
              nameAm: data.fullNameAm || data.nameAm || '',
              nameEn: data.fullNameEn || data.nameEn || '',
              phone: data.phone,
              role: data.role,
              department: data.department || 'general',
              permissions: data.permissions || {}
            }
          });
        }
      }

      // Fallback super admin accounts
      const fallbackAdmins = [
        { id: 'admin_01', nameAm: 'Neh Zewd (ዋና አስተዳዳሪ)', nameEn: 'Neh Zewd (Super Admin)', phone: '0988286610', password: 'Nehzewd0988', passwordHash: '329771a18bd2e6dd2d8d66f2b08e685093d2457a598cd2a4379a08a16f11ba06', role: 'super_admin' },
        { id: 'admin_02', nameAm: 'ዋና አስተዳዳሪ', nameEn: 'Main Admin', phone: '0911223344', password: 'admin', passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', role: 'super_admin' },
        { id: 'admin_03', nameAm: 'ወለተ ገብርኤል', nameEn: 'Welete Gabriel', phone: '0936662416', password: 'admin', passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', role: 'super_admin' }
      ];

      for (const hAdmin of fallbackAdmins) {
        const hPhone = hAdmin.phone.replace(/\D/g, '').slice(-9);
        if (hPhone && cleanPhone && hPhone === cleanPhone) {
          const storedPass = String(hAdmin.password || '').trim();
          const storedHash = String(hAdmin.passwordHash || '').trim();
          const isMatch = (storedPass && cleanPass === storedPass) ||
                          (storedHash && inputHash === storedHash) ||
                          (storedPass && inputHash === storedPass);

          if (!isMatch) {
            return res.status(401).json({ error: 'የተሳሳተ የይለፍ ቃል (Incorrect admin password)' });
          }
          return res.json({
            success: true,
            role: hAdmin.role,
            admin: {
              id: hAdmin.id,
              nameAm: hAdmin.nameAm,
              nameEn: hAdmin.nameEn,
              phone: hAdmin.phone,
              role: hAdmin.role,
              department: 'general',
              permissions: {
                canAccessSchedule: true, canAccessMembers: true, canAccessAttendance: true,
                canAccessSupport: true, canAccessAdmins: true, canAccessAnalytics: true,
                canBroadcast: true, approveStudents: true, takeAttendance: true,
                manageSupport: true, exportReports: true
              }
            }
          });
        }
      }

      return res.status(404).json({ error: 'ይህ ስልክ ቁጥር በአስተዳዳሪዎች ዝርዝር ውስጥ አልተገኘም (Admin phone not found)' });
    } catch (error) {
      console.error('Error in /api/admins/login:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Admin Password Update / Reset Endpoint (hashes with SHA-256 and stores in database)
  app.post('/api/admins/set-password', async (req, res) => {
    try {
      const { phone, newPassword } = req.body;
      if (!phone || !newPassword) {
        return res.status(400).json({ error: 'Phone number and new password are required' });
      }
      const cleanPhone = String(phone).replace(/\D/g, '').slice(-9);
      const cleanPass = String(newPassword).trim();
      if (cleanPass.length < 4) {
        return res.status(400).json({ error: 'Password must be at least 4 characters' });
      }

      const passwordHash = crypto.createHash('sha256').update(cleanPass).digest('hex');

      // Update in database admins collection
      let found = false;
      try {
        const snap = await db.collection('admins').get();
        for (const d of snap.docs) {
          const dPhone = String(d.data().phone || '').replace(/\D/g, '').slice(-9);
          if (dPhone && dPhone === cleanPhone) {
            await db.collection('admins').doc(d.id).update({
              password: cleanPass,
              passwordHash: passwordHash,
              updatedAt: new Date().toISOString()
            });
            found = true;
            break;
          }
        }
      } catch (e) {
        console.warn('Error updating admin password in database collection:', e);
      }

      // Also update in local fallback store
      try {
        const localDbPath = path.resolve(process.cwd(), 'backend/data/local_db.json');
        if (fs.existsSync(localDbPath)) {
          const localData = JSON.parse(fs.readFileSync(localDbPath, 'utf8'));
          if (localData.admins) {
            for (const key of Object.keys(localData.admins)) {
              const adm = localData.admins[key];
              const aPhone = String(adm.phone || '').replace(/\D/g, '').slice(-9);
              if (aPhone && aPhone === cleanPhone) {
                adm.password = cleanPass;
                adm.passwordHash = passwordHash;
                found = true;
              }
            }
          }
          if (!found && (cleanPhone === '0988286610' || cleanPhone === '0911223344' || cleanPhone === '0936662416')) {
            const admId = `admin_${cleanPhone}`;
            localData.admins = localData.admins || {};
            localData.admins[admId] = {
              id: admId,
              nameAm: 'Neh Zewd (ዋና አስተዳዳሪ)',
              nameEn: 'Neh Zewd (Super Admin)',
              phone: phone,
              password: cleanPass,
              passwordHash: passwordHash,
              role: 'super_admin',
              status: 'active'
            };
            found = true;
          }
          fs.writeFileSync(localDbPath, JSON.stringify(localData, null, 2), 'utf8');
        }
      } catch (fsErr) {
        console.warn('Error updating local_db.json admin password:', fsErr);
      }

      if (!found) {
        return res.status(404).json({ error: 'ይህ ስልክ ቁጥር በአስተዳዳሪዎች ዝርዝር ውስጥ አልተገኘም (Admin phone not found)' });
      }

      return res.json({ success: true, message: 'የአስተዳዳሪ የይለፍ ቃል በተሳካ ሁኔታ ተቀይሯል (Password updated successfully)' });
    } catch (error) {
      console.error('Error in /api/admins/set-password:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Student Direct Login (Phone or StudentCode - Case-insensitive EDU001 / legacy support)
  app.post('/api/students/login', async (req, res) => {
    try {
      const { identifier, phone, code } = req.body;
      const rawInput = String(identifier || phone || code || '').trim();
      if (!rawInput) {
        return res.status(400).json({ error: 'Phone number or Student ID is required' });
      }

      const upperCode = rawInput.toUpperCase();
      const normCode = normalizeStudentCode(rawInput);
      const cleanPhone = rawInput.replace(/\D/g, '').length >= 9 ? rawInput.replace(/\D/g, '').slice(-9) : '';
      const formats = cleanPhone ? [cleanPhone, '0' + cleanPhone, '+251' + cleanPhone] : [];

      const studentById = await db.collection('students').doc(rawInput).get();
      if (studentById.exists && studentById.data()?.status !== 'deleted') {
        const data = studentById.data();
        return res.json({
          success: true,
          student: { id: studentById.id, code: data.code || data.studentCode || normCode, role: 'student', ...data }
        });
      }

      for (const candidateCode of Array.from(new Set([normCode, upperCode].filter(Boolean)))) {
        const studentByCode = await db.collection('students').where('code', '==', candidateCode).limit(1).get();
        if (!studentByCode.empty) {
          const docSnap = studentByCode.docs[0];
          const data = docSnap.data();
          if (data?.status !== 'deleted') {
            return res.json({
              success: true,
              student: { id: docSnap.id, code: data.code || data.studentCode || candidateCode, role: 'student', ...data }
            });
          }
        }
        const byLegacy = await db.collection('students').where('legacyCode', '==', candidateCode).limit(1).get();
        if (!byLegacy.empty) {
          const docSnap = byLegacy.docs[0];
          const data = docSnap.data();
          if (data?.status !== 'deleted') {
            return res.json({
              success: true,
              student: { id: docSnap.id, code: data.code || data.studentCode || candidateCode, role: 'student', ...data }
            });
          }
        }
      }

      if (cleanPhone) {
        const studentByPhone = await db.collection('students').where('phone', 'in', formats).limit(1).get();
        if (!studentByPhone.empty) {
          const docSnap = studentByPhone.docs[0];
          const data = docSnap.data();
          return res.json({
            success: true,
            student: { id: docSnap.id, code: data.code || data.studentCode || normCode, role: 'student', ...data }
          });
        }
      }

      // 2. Search in registrations collection
      for (const candidateCode of Array.from(new Set([normCode, upperCode].filter(Boolean)))) {
        const regByCode = await db.collection('registrations').where('studentCode', '==', candidateCode).limit(1).get();
        if (!regByCode.empty) {
          const docSnap = regByCode.docs[0];
          const data = docSnap.data();
          return res.json({
            success: true,
            student: { id: docSnap.id, code: data.studentCode || data.code || candidateCode, status: data.status || 'pending', role: 'student', ...data }
          });
        }
      }

      if (cleanPhone) {
        const regByPhone = await db.collection('registrations').where('phone', 'in', formats).limit(1).get();
        if (!regByPhone.empty) {
          const docSnap = regByPhone.docs[0];
          const data = docSnap.data();
          return res.json({
            success: true,
            student: { id: docSnap.id, code: data.studentCode || data.code || normCode, status: data.status || 'pending', role: 'student', ...data }
          });
        }
      }

      return res.status(404).json({ error: 'የተማሪ መታወቂያ ወይም ስልክ ቁጥር አልተገኘም (Student ID or phone not found)' });
    } catch (error) {
      console.error('Error in /api/students/login:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // 1-Time Student Self-Edit After Approval (Phone & Birth Year -> Re-enters Admin Approval)
  app.post('/api/students/:id/self-edit', async (req, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { phone, birthYear } = req.body || {};

      const studRef = db.collection('students').doc(id);
      const regRef = db.collection('registrations').doc(id);
      const [studSnap, regSnap] = await Promise.all([studRef.get(), regRef.get()]);

      if (!studSnap.exists && !regSnap.exists) {
        return res.status(404).json({ error: 'ተማሪው አልተገኘም (Student not found)' });
      }

      const currentData = (studSnap.exists ? studSnap.data() : regSnap.data()) || {};
      if (currentData.hasEditedProfileOnce) {
        return res.status(403).json({
          error: 'የመረጃ ማስተካከያ እድልዎን (1 ጊዜ) አስቀድመው ተጠቅመዋል። ተጨማሪ ለውጥ ካስፈለገ አስተዳዳሪን ያነጋግሩ።',
        });
      }

      let cleanPhone = String(phone || currentData.phone || '').replace(/[\s\-\(\)\+]/g, '');
      if (cleanPhone.startsWith('251')) cleanPhone = '0' + cleanPhone.slice(3);
      if (cleanPhone && (cleanPhone.length !== 10 || (!cleanPhone.startsWith('09') && !cleanPhone.startsWith('07')))) {
        return res.status(400).json({
          error: 'ስልክ ቁጥር በትክክል 10 አሃዝ መሆን አለበት እና በ 09 ወይም 07 መጀመር አለበት (ምሳሌ፡ 0911223344)',
        });
      }

      const nextPhone = cleanPhone || currentData.phone || '';
      const nextBirthYear = String(birthYear ?? currentData.birthYear ?? currentData.birthDate ?? '').trim();

      const pendingEditSummary = {
        oldPhone: currentData.phone || '',
        newPhone: nextPhone,
        oldBirthYear: currentData.birthYear || currentData.birthDate || '',
        newBirthYear: nextBirthYear,
        editedAt: new Date().toISOString(),
      };

      const patchStudent = {
        phone: nextPhone,
        birthYear: nextBirthYear,
        birthDate: nextBirthYear,
        hasEditedProfileOnce: true,
        status: 'pending_approval',
        pendingEditSummary,
        updatedAt: new Date().toISOString(),
      };

      const patchReg = {
        phone: nextPhone,
        birthYear: nextBirthYear,
        birthDate: nextBirthYear,
        hasEditedProfileOnce: true,
        status: 'pending',
        pendingEditSummary,
        updatedAt: new Date().toISOString(),
      };

      if (studSnap.exists) {
        await studRef.update(patchStudent);
      }
      if (regSnap.exists) {
        await regRef.update(patchReg);
      }

      return res.json({
        success: true,
        hasEditedProfileOnce: true,
        status: 'pending_approval',
        pendingEditSummary,
        phone: nextPhone,
        birthYear: nextBirthYear,
      });
    } catch (err: any) {
      console.error('Error in /api/students/:id/self-edit:', err);
      return res.status(500).json({ error: 'መረጃውን ማዘመን አልተቻለም።' });
    }
  });

  // Student lookup by ID or Phone (Case-insensitive normalized code + legacyCode)
  app.get(['/api/students/:identifier', '/api/student/:identifier'], async (req, res) => {
    try {
      const identifierParam = Array.isArray(req.params.identifier) ? req.params.identifier[0] : req.params.identifier;
      const cleanIdentifier = (identifierParam || '').trim();
      const rawDigits = cleanIdentifier.replace(/\D/g, '');
      const cleanPhone = rawDigits.length >= 9 ? rawDigits.slice(-9) : '';
      const normCode = normalizeStudentCode(cleanIdentifier);
      const upperCode = cleanIdentifier.toUpperCase();

      // 1. Search students collection
      try {
        const studentsSnap = await db.collection('students').get();
        for (const docSnap of studentsSnap.docs) {
          const data = docSnap.data();
          if (data?.status === 'deleted') continue;
          const docId = docSnap.id;
          const dCodeNorm = normalizeStudentCode(data.code || data.studentCode || '');
          const dLegacyNorm = normalizeStudentCode(data.legacyCode || '');
          const dPhone = (data.phone || '').replace(/\D/g, '').slice(-9);

          if (
            docId === cleanIdentifier ||
            (normCode && (dCodeNorm === normCode || dLegacyNorm === normCode)) ||
            (cleanPhone && dPhone === cleanPhone)
          ) {
            return res.json({
              id: docId,
              code: data.code || data.studentCode || upperCode,
              role: data.role || 'student',
              ...data
            });
          }
        }
      } catch (e) {
        console.warn('Error reading students collection:', e);
      }

      // 2. Search registrations collection
      try {
        const regSnap = await db.collection('registrations').get();
        for (const docSnap of regSnap.docs) {
          const data = docSnap.data();
          if (data?.status === 'deleted') continue;
          const dCodeNorm = normalizeStudentCode(data.studentCode || data.code || '');
          const dPhone = (data.phone || '').replace(/\D/g, '').slice(-9);

          if (
            (normCode && dCodeNorm === normCode) ||
            (cleanPhone && dPhone === cleanPhone)
          ) {
            return res.json({
              id: docSnap.id,
              code: data.studentCode || data.code || upperCode,
              status: data.status || 'approved',
              role: 'student',
              ...data
            });
          }
        }
      } catch (e) {
        console.warn('Error reading registrations collection:', e);
      }

      // 3. Fallback search in admins collection
      try {
        const adminsSnap = await db.collection('admins').get();
        for (const docSnap of adminsSnap.docs) {
          const data = docSnap.data();
          const dPhone = (data.phone || '').replace(/\D/g, '').slice(-9);
          if (cleanPhone && dPhone === cleanPhone) {
            return res.json({
              id: docSnap.id,
              ...data,
              role: data.role || 'admin',
            });
          }
        }
      } catch (e) {
        console.warn('Error reading admins collection for student lookup:', e);
      }

      return res.status(404).json({ error: 'Student not found in database' });
    } catch (error) {
      console.error('Error in /api/students/:identifier:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // ─── IDEMPOTENT DEPARTMENT ID MIGRATION (WW-2026-... -> EDU001, MEZ001, ABN001, ART001, DIS001, GEN001) ───
  app.post('/api/admin/migrate-department-ids', async (req, res) => {
    try {
      const force = Boolean(req.body?.force);
      const markerRef = db.collection('app_settings').doc('id_migration_v1');
      if (!force) {
        const markerSnap = await markerRef.get();
        if (markerSnap.exists && markerSnap.data()?.completed) {
          return res.json({
            success: true,
            alreadyMigrated: true,
            migratedCount: 0,
            migratedAt: markerSnap.data()?.migratedAt,
          });
        }
      }

      const [studSnap, regSnap] = await Promise.all([
        db.collection('students').limit(300).get(),
        db.collection('registrations').limit(200).get(),
      ]);

      const prefixMax: Record<string, number> = { EDU: 0, MEZ: 0, ABN: 0, ART: 0, DIS: 0, FAM: 0, GEN: 0 };

      // Pass 1: find any already-migrated short codes so sequences continue cleanly
      for (const d of studSnap.docs) {
        const data = d.data();
        if (data?.status === 'deleted') continue;
        const norm = normalizeStudentCode(data.code || data.studentCode || '');
        if (isDepartmentShortCode(norm)) {
          const prefix = norm.slice(0, 3);
          const num = parseInt(norm.slice(3), 10);
          if (!Number.isNaN(num) && num > (prefixMax[prefix] || 0)) {
            prefixMax[prefix] = num;
          }
        }
      }

      const codeMap = new Map<string, string>(); // oldNormalizedCode -> newCode
      const updates: Array<{ id: string; oldCode: string; newCode: string }> = [];

      // Pass 2: assign sequential department codes to active/approved students without a short code
      for (const d of studSnap.docs) {
        const data = d.data();
        if (!data || data.status === 'deleted' || data.status === 'rejected') continue;
        const currentRaw = String(data.code || data.studentCode || '').trim();
        const currentNorm = normalizeStudentCode(currentRaw);

        if (isDepartmentShortCode(currentNorm)) {
          // Ensure clean uppercase normalization on existing short codes
          if (currentRaw !== currentNorm) {
            await db.collection('students').doc(d.id).update({ code: currentNorm, studentCode: currentNorm });
          }
          continue;
        }

        if (data.status !== 'active' && data.status !== 'approved' && currentNorm.startsWith('PENDING')) {
          continue;
        }

        const deptKey = resolveDepartmentKey(data.department);
        const prefix = getDepartmentPrefix(deptKey);
        const nextNum = (prefixMax[prefix] || 0) + 1;
        prefixMax[prefix] = nextNum;
        const newCode = `${prefix}${String(nextNum).padStart(3, '0')}`;

        await db.collection('students').doc(d.id).update({
          code: newCode,
          studentCode: newCode,
          department: deptKey,
          legacyCode: data.legacyCode || (currentRaw && !currentNorm.startsWith('PENDING') ? currentRaw : ''),
          updatedAt: new Date().toISOString(),
        });

        if (currentRaw) codeMap.set(currentNorm, newCode);
        updates.push({ id: d.id, oldCode: currentRaw, newCode });

        // Sync matching registration doc if exists with same ID
        const matchingReg = regSnap.docs.find((r: any) => r.id === d.id);
        if (matchingReg) {
          await db.collection('registrations').doc(matchingReg.id).update({
            code: newCode,
            studentCode: newCode,
            department: deptKey,
            legacyCode: matchingReg.data()?.legacyCode || currentRaw,
            updatedAt: new Date().toISOString(),
          }).catch(() => {});
        }
      }

      // Pass 3: update approved registrations that didn't have a matching student ID
      for (const r of regSnap.docs) {
        const rData = r.data();
        if (!rData || (rData.status !== 'approved' && rData.status !== 'active')) continue;
        const currentRaw = String(rData.studentCode || rData.code || '').trim();
        const currentNorm = normalizeStudentCode(currentRaw);
        if (isDepartmentShortCode(currentNorm)) continue;

        let mappedCode = codeMap.get(currentNorm);
        if (!mappedCode) {
          const deptKey = resolveDepartmentKey(rData.department);
          const prefix = getDepartmentPrefix(deptKey);
          const nextNum = (prefixMax[prefix] || 0) + 1;
          prefixMax[prefix] = nextNum;
          mappedCode = `${prefix}${String(nextNum).padStart(3, '0')}`;
          if (currentRaw) codeMap.set(currentNorm, mappedCode);
        }

        await db.collection('registrations').doc(r.id).update({
          code: mappedCode,
          studentCode: mappedCode,
          legacyCode: rData.legacyCode || currentRaw,
          updatedAt: new Date().toISOString(),
        }).catch(() => {});
      }

      // Pass 4: update recent attendance records whose memberCode matches migrated legacy codes
      if (codeMap.size > 0) {
        try {
          const attSnap = await db.collection('attendance').limit(300).get();
          for (const a of attSnap.docs) {
            const aData = a.data();
            const normAtt = normalizeStudentCode(aData.memberCode || aData.studentCode || '');
            const newCode = codeMap.get(normAtt);
            if (newCode && aData.memberCode !== newCode) {
              await db.collection('attendance').doc(a.id).update({
                memberCode: newCode,
                legacyMemberCode: aData.memberCode || '',
              }).catch(() => {});
            }
          }
        } catch {}
      }

      const migratedAt = new Date().toISOString();
      await markerRef.set({
        completed: true,
        migratedAt,
        migratedCount: updates.length,
      });

      return res.json({
        success: true,
        alreadyMigrated: false,
        migratedCount: updates.length,
        updates,
      });
    } catch (err: any) {
      console.error('Migration error:', err);
      return res.status(500).json({ error: 'Department ID migration failed' });
    }
  });

  // ─── TELEGRAM WEB LOGIN (OFFICIAL WIDGET / VERIFY.ET FLOW) & PRIVATE PARENT PORTAL ROUTES ───
  let cachedBotInfo: { botId: string; botUsername: string; firstName: string } | null = null;

  app.get('/api/parent/auth/bot-info', async (req, res) => {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN || '8611581813:AAHadIUrYIkmVzz90WfvcpTduj-ubCZCL8w';
      const botId = botToken.split(':')[0] || '8611581813';
      if (!cachedBotInfo) {
        let botUsername = process.env.TELEGRAM_BOT_USERNAME || 'attendanceforchurchbot';
        let firstName = 'Wold Wahid Sunday School';
        try {
          const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
          const meData: any = await meRes.json();
          if (meData?.ok && meData.result?.username) {
            botUsername = meData.result.username;
            firstName = meData.result.first_name || firstName;
          }
        } catch {}
        cachedBotInfo = { botId, botUsername, firstName };
      }
      return res.json({ success: true, ...cachedBotInfo });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to load Telegram bot configuration' });
    }
  });

  let cachedTgJwks: { keys: any[]; fetchedAt: number } | null = null;

  async function fetchTelegramJwks(forceRefresh = false): Promise<any[]> {
    if (!forceRefresh && cachedTgJwks && Date.now() - cachedTgJwks.fetchedAt < 3600_000) {
      return cachedTgJwks.keys;
    }
    const resp = await fetch('https://oauth.telegram.org/.well-known/jwks.json');
    const json: any = await resp.json();
    const keys = Array.isArray(json?.keys) ? json.keys : [];
    cachedTgJwks = { keys, fetchedAt: Date.now() };
    return keys;
  }

  function decodeBase64UrlJson(segment: string): any {
    const norm = segment.replace(/-/g, '+').replace(/_/g, '/');
    const pad = norm.length % 4;
    const padded = pad ? norm + '='.repeat(4 - pad) : norm;
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  }

  function decodeBase64UrlBuffer(segment: string): Buffer {
    const norm = segment.replace(/-/g, '+').replace(/_/g, '/');
    const pad = norm.length % 4;
    const padded = pad ? norm + '='.repeat(4 - pad) : norm;
    return Buffer.from(padded, 'base64');
  }

  async function verifyTelegramOidcIdToken(idToken: string, expectedAud: string) {
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Malformed Telegram OIDC token');
    }
    const header = decodeBase64UrlJson(parts[0]);
    const claims = decodeBase64UrlJson(parts[1]);
    const sigBuf = decodeBase64UrlBuffer(parts[2]);
    const signingInput = Buffer.from(`${parts[0]}.${parts[1]}`, 'utf8');

    let keys = await fetchTelegramJwks(false);
    let jwk = keys.find((k: any) => k.kid === header.kid);
    if (!jwk) {
      keys = await fetchTelegramJwks(true);
      jwk = keys.find((k: any) => k.kid === header.kid);
    }
    if (!jwk) {
      throw new Error('Matching Telegram signing key not found');
    }

    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    const alg = String(header.alg || jwk.alg || 'RS256');
    let verified = false;
    if (alg === 'RS256') {
      verified = crypto.verify('sha256', signingInput, publicKey, sigBuf);
    } else if (alg === 'ES256' || alg === 'ES256K') {
      verified = crypto.verify('sha256', signingInput, { key: publicKey, dsaEncoding: 'ieee-p1363' }, sigBuf);
    } else if (alg === 'EdDSA') {
      verified = crypto.verify(null, signingInput, publicKey, sigBuf);
    } else {
      throw new Error(`Unsupported JWT algorithm: ${alg}`);
    }

    if (!verified) {
      throw new Error('Invalid Telegram OIDC token signature');
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (claims.iss !== 'https://oauth.telegram.org') {
      throw new Error('Invalid Telegram OIDC issuer');
    }
    if (String(claims.aud || '') !== String(expectedAud)) {
      throw new Error('Invalid Telegram OIDC audience');
    }
    if (!claims.exp || Number(claims.exp) + 60 < nowSec) {
      throw new Error('Telegram OIDC session expired');
    }
    return claims;
  }

  app.post('/api/parent/auth/telegram-widget', async (req, res) => {
    try {
      const payload = req.body || {};
      const botToken = process.env.TELEGRAM_BOT_TOKEN || '8611581813:AAHadIUrYIkmVzz90WfvcpTduj-ubCZCL8w';
      const botId = botToken.split(':')[0] || '8611581813';

      let tgId = '';
      let firstName = '';
      let lastName = '';
      let username = '';
      let photoUrl = '';

      if (payload.id_token && typeof payload.id_token === 'string') {
        // Official Telegram OIDC ID Token flow (https://core.telegram.org/bots/telegram-login)
        const claims = await verifyTelegramOidcIdToken(payload.id_token, botId);
        tgId = String(claims.sub || claims.id || '');
        if (!tgId) {
          return res.status(401).json({ error: 'Telegram user ID missing in OIDC token' });
        }
        const fullName = String(claims.name || '').trim();
        const nameParts = fullName ? fullName.split(/\s+/) : [];
        firstName = String(claims.given_name || nameParts[0] || '');
        lastName = String(claims.family_name || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''));
        username = String(claims.preferred_username || '');
        photoUrl = String(claims.picture || '');
      } else {
        // Legacy Telegram Login Widget HMAC-SHA256 fallback
        const { id, auth_date, hash, first_name, last_name, username: rawUsername, photo_url } = payload;

        if (!id || !auth_date || !hash) {
          return res.status(400).json({ error: 'Invalid Telegram authentication payload' });
        }

        const nowSec = Math.floor(Date.now() / 1000);
        const authSec = Number(auth_date);
        if (!Number.isFinite(authSec) || Math.abs(nowSec - authSec) > 86400) {
          return res.status(401).json({ error: 'የቴሌግራም መግቢያ ጊዜው አልፏል። እባክዎ እንደገና ይግቡ (Session expired).' });
        }

        const secretKey = crypto.createHash('sha256').update(botToken).digest();
        const tgFields: string[] = [];
        for (const [k, v] of Object.entries(payload)) {
          if (k === 'hash' || v === undefined || v === null || String(v) === '') continue;
          tgFields.push(`${k}=${String(v)}`);
        }
        tgFields.sort();
        const dataCheckString = tgFields.join('\n');
        const expectedHex = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
        const receivedHex = String(hash).trim().toLowerCase();

        const expectedBuf = Buffer.from(expectedHex, 'hex');
        const receivedBuf = Buffer.from(receivedHex, 'hex');
        const validSig =
          expectedBuf.length === receivedBuf.length &&
          expectedBuf.length > 0 &&
          crypto.timingSafeEqual(expectedBuf, receivedBuf);

        if (!validSig) {
          return res.status(401).json({ error: 'የቴሌግራም ማረጋገጫ ፊርማ ትክክል አይደለም (Invalid Telegram signature).' });
        }

        tgId = String(id);
        firstName = first_name ? String(first_name) : '';
        lastName = last_name ? String(last_name) : '';
        username = rawUsername ? String(rawUsername) : '';
        photoUrl = photo_url ? String(photo_url) : '';
      }

      // Save subscriber metadata non-blocking
      db.collection('bot_subscribers').doc(tgId).set({
        telegramId: tgId,
        username,
        firstName,
        lastName,
        photoUrl,
        lastActiveAt: new Date().toISOString(),
      }, { merge: true }).catch(() => {});

      const [studByPrimary, studByArray, linksSnap] = await Promise.all([
        db.collection('students').where('parentTelegramId', '==', tgId).limit(20).get(),
        db.collection('students').where('parentTelegramIds', 'array-contains', tgId).limit(20).get(),
        db.collection('parent_links').where('parentTelegramId', '==', tgId).limit(10).get(),
      ]);

      const childMap = new Map<string, any>();
      for (const d of [...studByPrimary.docs, ...studByArray.docs]) {
        const sd = d.data();
        if (sd?.status !== 'deleted') childMap.set(d.id, { id: d.id, ...sd });
      }

      const linkRequests = linksSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

      return res.json({
        success: true,
        status: 'verified',
        telegramUser: {
          telegramId: tgId,
          username,
          firstName,
          lastName,
          photoUrl,
        },
        linkedChildren: Array.from(childMap.values()),
        linkRequests,
      });
    } catch (err: any) {
      console.error('Error in /api/parent/auth/telegram-widget:', err);
      const msg = err?.message || 'Telegram verification failed';
      return res.status(401).json({ error: msg });
    }
  });

  app.post('/api/parent/auth/init', async (req, res) => {
    try {
      const token = crypto.randomBytes(12).toString('hex');
      const createdAt = new Date().toISOString();
      await db.collection('parent_login_tokens').doc(token).set({
        token,
        status: 'pending',
        createdAt,
      });
      const deepLink = `https://t.me/attendanceforchurchbot?start=plogin_${token}`;
      return res.json({ success: true, token, deepLink });
    } catch (err) {
      console.error('Error in /api/parent/auth/init:', err);
      return res.status(500).json({ error: 'Failed to initialize Telegram login' });
    }
  });

  app.get('/api/parent/auth/status/:token', async (req, res) => {
    try {
      const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
      const snap = await db.collection('parent_login_tokens').doc(token).get();
      if (!snap.exists) {
        return res.status(404).json({ status: 'expired' });
      }
      const data = snap.data()!;
      if (data.status !== 'verified' || !data.telegramId) {
        return res.json({ status: 'pending' });
      }

      const tgId = String(data.telegramId);
      const [studByPrimary, studSnapAll, linksSnap] = await Promise.all([
        db.collection('students').where('parentTelegramId', '==', tgId).limit(20).get(),
        db.collection('students').limit(200).get(),
        db.collection('parent_links').where('parentTelegramId', '==', tgId).limit(10).get(),
      ]);

      const childMap = new Map<string, any>();
      for (const d of studByPrimary.docs) {
        const sd = d.data();
        if (sd?.status !== 'deleted') childMap.set(d.id, { id: d.id, ...sd });
      }
      for (const d of studSnapAll.docs) {
        const sd = d.data();
        if (sd?.status === 'deleted') continue;
        const arr = Array.isArray(sd.parentTelegramIds) ? sd.parentTelegramIds.map(String) : [];
        if (String(sd.parentTelegramId || '') === tgId || arr.includes(tgId)) {
          childMap.set(d.id, { id: d.id, ...sd });
        }
      }

      const linkRequests = linksSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

      return res.json({
        status: 'verified',
        telegramUser: {
          telegramId: tgId,
          username: data.telegramUsername || '',
          firstName: data.firstName || '',
          lastName: data.lastName || '',
        },
        linkedChildren: Array.from(childMap.values()),
        linkRequests,
      });
    } catch (err) {
      console.error('Error in /api/parent/auth/status:', err);
      return res.status(500).json({ error: 'Failed to check Telegram login status' });
    }
  });

  // Lookup verified parent's linked children (for restoring saved browser session)
  app.get('/api/parent/session/:telegramId', async (req, res) => {
    try {
      const tgId = Array.isArray(req.params.telegramId) ? req.params.telegramId[0] : req.params.telegramId;
      if (!tgId) return res.status(400).json({ error: 'telegramId required' });

      const [studSnap, linksSnap] = await Promise.all([
        db.collection('students').limit(200).get(),
        db.collection('parent_links').where('parentTelegramId', '==', String(tgId)).limit(10).get(),
      ]);

      const linkedChildren = studSnap.docs
        .filter((d: any) => {
          const sd = d.data();
          if (!sd || sd.status === 'deleted') return false;
          const arr = Array.isArray(sd.parentTelegramIds) ? sd.parentTelegramIds.map(String) : [];
          return String(sd.parentTelegramId || '') === String(tgId) || arr.includes(String(tgId));
        })
        .map((d: any) => ({ id: d.id, ...d.data() }));

      const linkRequests = linksSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      return res.json({ success: true, linkedChildren, linkRequests });
    } catch (err) {
      console.error('Error in /api/parent/session:', err);
      return res.status(500).json({ error: 'Failed to load parent session' });
    }
  });

  // 1st-Time Parent Link Request using Child Student ID -> Queued in "Parent Approve" Admin Tab
  app.post('/api/parent/link-request', async (req, res) => {
    try {
      const { parentTelegramId, parentTelegramUsername, parentName, parentPhone, relation, studentCode } = req.body || {};
      if (!parentTelegramId || !parentName || !parentPhone || !studentCode) {
        return res.status(400).json({ error: 'እባክዎ ሁሉንም አስፈላጊ መረጃዎች (ስም፣ ስልክ እና የተማሪ ID) ይሙሉ።' });
      }

      const normInput = normalizeStudentCode(studentCode);
      const rawUpper = String(studentCode).trim().toUpperCase();

      const studSnap = await db.collection('students').limit(300).get();
      const matchedDoc = studSnap.docs.find((d: any) => {
        const sd = d.data();
        if (!sd || sd.status === 'deleted' || sd.status === 'rejected') return false;
        const cNorm = normalizeStudentCode(sd.code || sd.studentCode || '');
        const lNorm = normalizeStudentCode(sd.legacyCode || '');
        return cNorm === normInput || lNorm === normInput || cNorm === rawUpper;
      });

      if (!matchedDoc) {
        return res.status(404).json({
          error: `በመታወቂያ "${rawUpper}" የተመዘገበ ተማሪ አልተገኘም። እባክዎ የልጅዎን ትክክለኛ የመታወቂያ ኮድ (ምሳሌ፡ EDU001) ያስገቡ።`,
        });
      }

      const sData = matchedDoc.data();
      const tgStr = String(parentTelegramId);
      const alreadyLinkedIds = Array.isArray(sData.parentTelegramIds) ? sData.parentTelegramIds.map(String) : [];
      if (String(sData.parentTelegramId || '') === tgStr || alreadyLinkedIds.includes(tgStr)) {
        return res.json({ success: true, alreadyLinked: true, studentNameAm: sData.fullNameAm });
      }

      const existingLinksSnap = await db.collection('parent_links')
        .where('parentTelegramId', '==', tgStr)
        .limit(10)
        .get();
      const dupPending = existingLinksSnap.docs.find((d: any) => {
        const ld = d.data();
        return ld.studentId === matchedDoc.id && ld.status === 'pending';
      });
      if (dupPending) {
        return res.json({ success: true, alreadyPending: true, requestId: dupPending.id });
      }

      const cleanPhone = String(parentPhone).trim();
      const added = await db.collection('parent_links').add({
        parentTelegramId: tgStr,
        parentTelegramUsername: parentTelegramUsername || '',
        parentName: String(parentName).trim(),
        parentPhone: cleanPhone,
        relation: String(relation || 'ወላጅ (Parent)').trim(),
        studentId: matchedDoc.id,
        studentCode: sData.code || sData.studentCode || normInput,
        studentNameAm: sData.fullNameAm || sData.fullNameEn || 'ተማሪ',
        department: sData.department || 'education',
        registeredEmergencyName: sData.emergencyContact?.name || sData.emergencyName || '',
        registeredEmergencyPhone: sData.emergencyContact?.phone || sData.emergencyPhone || '',
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      return res.json({ success: true, id: added.id, status: 'pending' });
    } catch (err) {
      console.error('Error in /api/parent/link-request:', err);
      return res.status(500).json({ error: 'ጥያቄውን መላክ አልተቻለም።' });
    }
  });

  // Private single-child dashboard payload (Strictly requires verified linked parentTelegramId)
  app.get('/api/parent/child/:studentId', async (req, res) => {
    try {
      const studentId = Array.isArray(req.params.studentId) ? req.params.studentId[0] : req.params.studentId;
      const parentTg = String(req.query.parentTelegramId || '').trim();
      if (!parentTg) return res.status(401).json({ error: 'Unauthorized: parentTelegramId required' });

      const studDoc = await db.collection('students').doc(studentId).get();
      if (!studDoc.exists) return res.status(404).json({ error: 'Student not found' });

      const sData = studDoc.data()!;
      const allowedIds = Array.isArray(sData.parentTelegramIds) ? sData.parentTelegramIds.map(String) : [];
      if (String(sData.parentTelegramId || '') !== parentTg && !allowedIds.includes(parentTg)) {
        return res.status(403).json({ error: 'Access denied: this student is not linked to your parent account.' });
      }

      const [attSnap, reportDoc, notifSnap] = await Promise.all([
        db.collection('attendance').where('memberId', '==', studentId).limit(30).get(),
        db.collection('student_reports').doc(studentId).get(),
        db.collection('notifications').limit(10).get(),
      ]);

      const attendance = attSnap.docs
        .map((d: any) => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

      const report = reportDoc.exists
        ? reportDoc.data()
        : { studentId, studentCode: sData.code || '', exams: [], conductNotes: [] };

      const notices = notifSnap.docs
        .map((d: any) => ({ id: d.id, ...d.data() }))
        .filter((n: any) => !n.targetTelegramId || String(n.targetTelegramId) === String(sData.telegramId || '') || String(n.targetTelegramId) === parentTg)
        .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 6);

      return res.json({
        success: true,
        student: { id: studDoc.id, ...sData },
        attendance,
        report,
        notices,
      });
    } catch (err) {
      console.error('Error in /api/parent/child:', err);
      return res.status(500).json({ error: 'Failed to load child tracking data' });
    }
  });

  // Parent-submitted Leave Request (verifies linked child first)
  app.post('/api/parent/leave-request', async (req, res) => {
    try {
      const { parentTelegramId, studentId, leaveType, duration, reason } = req.body || {};
      if (!parentTelegramId || !studentId || !reason) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const studDoc = await db.collection('students').doc(String(studentId)).get();
      if (!studDoc.exists) return res.status(404).json({ error: 'Student not found' });
      const sData = studDoc.data()!;
      const allowedIds = Array.isArray(sData.parentTelegramIds) ? sData.parentTelegramIds.map(String) : [];
      if (String(sData.parentTelegramId || '') !== String(parentTelegramId) && !allowedIds.includes(String(parentTelegramId))) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const requestNumber = `PLV-${Math.floor(1000 + Math.random() * 9000)}`;
      const payload = {
        requestNumber,
        memberId: studDoc.id,
        studentName: sData.fullNameAm || sData.fullNameEn || 'ተማሪ',
        studentCode: sData.code || sData.studentCode || '',
        telegramId: sData.telegramId || String(parentTelegramId),
        submittedByParent: true,
        parentTelegramId: String(parentTelegramId),
        leaveType: String(leaveType || 'የቤተሰብ (Family)'),
        duration: String(duration || '1 ቀን'),
        reason: String(reason).trim(),
        status: 'pending',
        submittedAt: new Date().toISOString(),
      };

      const ref = await db.collection('leave_requests').add(payload);
      return res.json({ success: true, id: ref.id, requestNumber });
    } catch (err) {
      console.error('Error in /api/parent/leave-request:', err);
      return res.status(500).json({ error: 'Failed to submit leave request' });
    }
  });

  app.post('/api/registrations/:id/approve', async (req, res) => {
    try {
      const { id } = req.params;
      const { studentCode, approvedBy } = req.body;

      let regRef = db.collection('registrations').doc(id);
      let regDoc = await regRef.get();

      if (!regDoc.exists) {
        const byTg = await db.collection('registrations').where('telegramId', '==', id).get();
        if (!byTg.empty) {
          regRef = db.collection('registrations').doc(byTg.docs[0].id);
          regDoc = await regRef.get();
        }
      }

      if (!regDoc.exists) {
        console.warn(`Registration ${id} not found in database.`);
        return res.status(404).json({ error: 'Registration not found' });
      }

      const regData = regDoc.data()!;
      
      await regRef.update({
        status: 'approved',
        studentCode,
        code: studentCode,
        approvedBy: approvedBy || 'ዋና አስተዳዳሪ',
        approvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // 2. Add or update active student record in students collection using the SAME ID as registration
      const studentRef = db.collection('students').doc(id);
      await studentRef.set({
        code: studentCode,
        studentCode,
        fullNameAm: regData.fullNameAm || 'ተማሪ',
        fullNameEn: regData.fullNameEn || 'Student',
        christianName: regData.christianName || '',
        birthYear: regData.birthYear || regData.birthDate || '',
        phone: regData.phone || '',
        gender: regData.gender || 'male',
        department: regData.department || 'education',
        gradeLevel: regData.gradeLevel || 'general',
        photoUrl: regData.photoUrl || '',
        emergencyContact: regData.emergencyContact || { name: '', phone: '', relation: 'ቤተሰብ / Family' },
        subcity: regData.subcity || regData.address || '',
        telegramId: regData.telegramId || '',
        status: 'active',
        registeredDate: new Date().toISOString().split('T')[0],
        approvedBy: approvedBy || 'ዋና አስተዳዳሪ',
        approvedAt: new Date().toISOString()
      }, { merge: true });

      // Dispatch Telegram notification to student if telegramId exists
      if (regData.telegramId) {
        try {
          await dispatchSendMessage(
            regData.telegramId,
            `🎉 *እንኳን ደስ አለዎት! ምዝገባዎ ጸድቋል*\n*Congratulations! Registration Approved*\n\n` +
            `በመካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን የወልደ ዋሕድ ሰንበት ት/ቤት ምዝገባዎ በአስተዳዳሪው ጸድቋል!\n\n` +
            `🆔 *የተመደበ የተማሪ መታወቂያ:* \`${studentCode}\`\n\n` +
            `አሁን በቦቱ ውስጥ "👤 የኔ መታወቂያና QR" ወይም /start የሚለውን በመጫን የእርስዎን ኦፊሴላዊ የQR ዲጂታል መታወቂያ ካርድ መቀበል ይችላሉ።`,
            { parse_mode: 'Markdown' }
          );
        } catch (tgErr) {
          console.error('Failed to send Telegram notification:', tgErr);
        }
      }

      res.json({ success: true, message: 'Registration approved and student profile created.', studentCode });
    } catch (error) {
      console.error('Approval API error in server.ts:', error);
      res.status(500).json({ error: 'Approval failed' });
    }
  });

  app.post('/api/notifications/broadcast', async (req, res) => {
    try {
      const { title, message, senderName } = req.body;
      if (!message) {
        return res.status(400).json({ error: 'Message content is required' });
      }

      const notifDoc = {
        title: title || 'ወልደ ዋሕድ ሰንበት ት/ቤት ማስታወቂያ',
        message: message,
        senderName: senderName || 'አስተዳዳሪ',
        createdAt: new Date().toISOString(),
        church: 'መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን',
      };

      await db.collection('notifications').add(notifDoc);

      // Collect all student & registration telegram IDs from all collections
      let sentCount = 0;
      const bot = getBot();
      const { targetIds } = req.body;
      let tgIds = new Set<string>();

      if (targetIds && Array.isArray(targetIds) && targetIds.length > 0) {
        targetIds.forEach(id => {
          if (id) tgIds.add(String(id));
        });
      } else {
        const [studentSnap, regSnap, ticketSnap, leaveSnap, subscriberSnap, memberSnap] = await Promise.all([
          db.collection('students').get().catch(() => ({ docs: [] })),
          db.collection('registrations').get().catch(() => ({ docs: [] })),
          db.collection('support_tickets').get().catch(() => ({ docs: [] })),
          db.collection('leave_requests').get().catch(() => ({ docs: [] })),
          db.collection('bot_subscribers').get().catch(() => ({ docs: [] })),
          db.collection('members').get().catch(() => ({ docs: [] })),
        ]);

        const processDocs = (docs: any[]) => {
          docs.forEach((d) => {
            const data = d.data();
            const tId = data.telegramId || data.tgId || data.telegram_id || data.chatId;
            if (tId) tgIds.add(String(tId));
          });
        };

        processDocs(studentSnap.docs);
        processDocs(regSnap.docs);
        processDocs(ticketSnap.docs);
        processDocs(leaveSnap.docs);
        processDocs(subscriberSnap.docs);
        processDocs(memberSnap.docs);
      }
      
      console.log(`📣 Unique Telegram IDs collected for broadcast: ${tgIds.size}`);

      const broadcastMsg = 
        `📢 *አዲስ ማስታወቂያ (Announcement)*\n` +
        `⛪ *መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን*\n` +
        `═══════════════════════\n\n` +
        `📌 *${notifDoc.title}*\n\n` +
        `${notifDoc.message}\n\n` +
        `═══════════════════════\n` +
        `✍️ የላከው: *${notifDoc.senderName}*\n` +
        `⏰ ሰዓት: ${new Date().toLocaleTimeString()}`;

      for (const chatId of tgIds) {
        try {
          if (bot) {
            await bot.sendMessage(chatId, broadcastMsg, { parse_mode: 'Markdown' });
          } else {
            await dispatchSendMessage(chatId, broadcastMsg, { parse_mode: 'Markdown' });
          }
          sentCount++;
        } catch (sendErr: any) {
          console.warn(`Failed to send broadcast to ${chatId}:`, sendErr.message);
        }
      }

      res.json({
        success: true,
        sentToTelegram: sentCount > 0 ? sentCount : tgIds.size,
        message: 'Notification dispatched to mobile apps and Telegram students.',
      });
    } catch (err: any) {
      console.error('Error broadcasting notification:', err);
      res.status(500).json({ error: 'Failed to broadcast notification: ' + (err.message || 'Unknown error') });
    }
  });

  // Leave request status update API (Approve/Reject + notify user on Telegram & notifications)
  app.post(['/api/leave_requests/:id/status', '/api/leave-requests/:id/status'], async (req, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { status, adminName, reason } = req.body;

      const leaveRef = db.collection('leave_requests').doc(id);
      const leaveDoc = await leaveRef.get();
      if (!leaveDoc.exists) return res.status(404).json({ error: 'Leave request not found' });

      const leaveData = leaveDoc.data()!;
      await leaveRef.update({
        status,
        reason: reason || leaveData.reason,
        approvedBy: adminName || 'አስተዳዳሪ',
        updatedAt: new Date().toISOString()
      });

      let recipientTelegramId = leaveData.telegramId;
      if (!recipientTelegramId && (leaveData.studentName || leaveData.studentCode)) {
        try {
          const [studentSnap, regSnap] = await Promise.all([
            db.collection('students').get(),
            db.collection('registrations').get(),
          ]);
          const allDocs = [...studentSnap.docs, ...regSnap.docs];
          for (const d of allDocs) {
            const dData = d.data();
            const dName = (dData.fullNameAm || dData.fullNameEn || '').trim().toLowerCase();
            const reqName = (leaveData.studentName || '').trim().toLowerCase();
            const dCode = (dData.code || dData.studentCode || '').trim().toLowerCase();
            const reqCode = (leaveData.studentCode || '').trim().toLowerCase();
            if ((reqCode && dCode === reqCode) || (reqName && dName === reqName)) {
              recipientTelegramId = dData.telegramId || dData.tgId;
              if (recipientTelegramId) break;
            }
          }
        } catch (findErr) {
          console.warn('Error resolving telegramId for leave requester:', findErr);
        }
      }

      // Save targeted notification for the student (received on mobile/student app)
      await db.collection('notifications').add({
        title: `✉️ የፈቃድ ጥያቄዎ ${status === 'approved' ? 'ጸድቋል' : 'አልተቀበለም'}`,
        message: `ምክንያት / ማስታወሻ: ${reason || (status === 'approved' ? 'ፈቃድዎ ጸድቋል' : 'የተጠየቀው ፈቃድ አልተፈቀደም')}`,
        senderName: adminName || 'አስተዳዳሪ',
        targetTelegramId: recipientTelegramId || '',
        leaveRequestId: id,
        createdAt: new Date().toISOString(),
        isDirectReply: true,
      }).catch(console.error);

      const bot = getBot();
      if (recipientTelegramId) {
        try {
          const statusAm = status === 'approved' ? '✅ ጸድቋል (Approved)' : '❌ አልተቀበለም (Rejected)';
          console.log(`Sending leave status notification to ${recipientTelegramId}`);
          const msgText = 
            `✉️ *የፈቃድ ጥያቄ ምላሽ (Leave Request Update)*\n` +
            `⛪ መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን\n` +
            `═══════════════════════\n\n` +
            `• *የፈቃድ ዓይነት:* ${leaveData.leaveType || 'ፈቃድ'}\n` +
            `• *ወቅት/ጊዜ:* ${leaveData.duration || 'N/A'}\n` +
            `• *አሁን ያለው ሁኔታ (Status):* *${statusAm}*\n` +
            `• *ምክንያት / አስተያየት (Reason):* ${reason || 'የለም'}\n` +
            `• *የወሰነው:* ${adminName || 'አስተዳዳሪ'}\n\n` +
            `ትኩረትዎ እናመሰግናለን!`;

          if (bot) {
            await bot.sendMessage(recipientTelegramId, msgText, { parse_mode: 'Markdown' });
          } else {
            await dispatchSendMessage(recipientTelegramId, msgText, { parse_mode: 'Markdown' });
          }
        } catch (tgErr) {
          console.error('Failed to notify student on Telegram for leave request:', tgErr);
        }
      } else {
        console.warn(`Cannot send leave notification. TelegramId not found.`);
      }

      res.json({ success: true, message: 'Leave request status updated and student notified with reason.' });
    } catch (error) {
      console.error('Failed to update leave request status:', error);
      res.status(500).json({ error: 'Failed to update leave request status' });
    }
  });

  // Support ticket status update API (Approve/Reject/Resolve + notify user on Telegram with reason)
  app.post(['/api/support_tickets/:id/status', '/api/support-tickets/:id/status'], async (req, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { status, adminName, reason } = req.body;

      const ticketRef = db.collection('support_tickets').doc(id);
      const ticketDoc = await ticketRef.get();
      if (!ticketDoc.exists) return res.status(404).json({ error: 'Support ticket not found' });

      const ticketData = ticketDoc.data()!;
      await ticketRef.update({
        status,
        reason: reason || ticketData.reason || '',
        approvedBy: adminName || 'አስተዳዳሪ',
        updatedAt: new Date().toISOString()
      });

      let recipientTelegramId = ticketData.telegramId;
      if (!recipientTelegramId && (ticketData.phone || ticketData.requesterName)) {
        try {
          const cleanPhone = (ticketData.phone || '').replace(/\D/g, '').slice(-9);
          const [studentSnap, regSnap] = await Promise.all([
            db.collection('students').get(),
            db.collection('registrations').get(),
          ]);
          const allDocs = [...studentSnap.docs, ...regSnap.docs];
          for (const d of allDocs) {
            const dData = d.data();
            const dPhone = (dData.phone || '').replace(/\D/g, '').slice(-9);
            const dName = (dData.fullNameAm || dData.fullNameEn || '').trim().toLowerCase();
            const reqName = (ticketData.requesterName || '').trim().toLowerCase();
            if ((cleanPhone && dPhone === cleanPhone) || (reqName && dName === reqName)) {
              recipientTelegramId = dData.telegramId || dData.tgId;
              if (recipientTelegramId) break;
            }
          }
        } catch (findErr) {
          console.warn('Error resolving telegramId for support requester:', findErr);
        }
      }

      const bot = getBot();
      if (recipientTelegramId) {
        try {
          const statusAm = status === 'approved' ? '✅ ጸድቋል (Approved)' : status === 'rejected' ? '❌ አልተቀበለም (Rejected)' : status === 'resolved' ? '✅ ተፈትቷል (Resolved)' : status === 'in_contact' ? '📞 በሂደት ላይ (In Progress)' : '📌 ታይቷል (Updated)';
          console.log(`Sending support ticket notification to ${recipientTelegramId}`);
          const msgText = 
            `💬 *የድጋፍ ጥያቄ ምላሽ (Support Ticket Update)*\n` +
            `⛪ መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን\n` +
            `═══════════════════════\n\n` +
            `• *ቲኬት ቁጥር:* \`${ticketData.ticketNumber || id}\`\n` +
            `• *ርዕስ/ጉዳይ:* ${ticketData.title || ticketData.category}\n` +
            `• *አሁን ያለው ሁኔታ (Status):* *${statusAm}*\n` +
            `• *ምክንያት / አስተያየት:* ${reason || ticketData.reason || 'የለም'}\n` +
            `• *አስተዳዳሪ:* ${adminName || 'አስተዳዳሪ'}\n\n` +
            `ጥያቄዎ ትኩረት አግኝቷል!`;

          if (bot) {
            await bot.sendMessage(recipientTelegramId, msgText, { parse_mode: 'Markdown' });
          } else {
            await dispatchSendMessage(recipientTelegramId, msgText, { parse_mode: 'Markdown' });
          }
        } catch (tgErr) {
          console.error('Failed to notify student on Telegram for support ticket:', tgErr);
        }
      } else {
        console.warn(`Cannot send support notification. TelegramId not found.`);
      }

      res.json({ success: true, message: 'Support ticket status updated and student notified with reason.' });
    } catch (error) {
      console.error('Failed to update support ticket status:', error);
      res.status(500).json({ error: 'Failed to update support ticket status' });
    }
  });

  // Support ticket note/reply API (Add note + notify requester directly on Telegram and targeted notifications)
  app.post(['/api/support_tickets/:id/note', '/api/support-tickets/:id/note'], async (req, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { author, text } = req.body;

      const ticketRef = db.collection('support_tickets').doc(id);
      const ticketDoc = await ticketRef.get();
      if (!ticketDoc.exists) return res.status(404).json({ error: 'Support ticket not found' });

      const ticketData = ticketDoc.data()!;
      const currentNotes = ticketData.notes || [];
      const newNote = {
        id: `n-${Date.now()}`,
        author: author || 'አስተባባሪ',
        text: text,
        date: new Date().toISOString().replace('T', ' ').slice(0, 16),
      };

      await ticketRef.update({
        notes: [...currentNotes, newNote],
        updatedAt: new Date().toISOString()
      });

      // Find Telegram ID if missing on ticket
      let recipientTelegramId = ticketData.telegramId;
      if (!recipientTelegramId && (ticketData.phone || ticketData.requesterName)) {
        try {
          const cleanPhone = (ticketData.phone || '').replace(/\D/g, '').slice(-9);
          const [studentSnap, regSnap] = await Promise.all([
            db.collection('students').get(),
            db.collection('registrations').get(),
          ]);
          const allDocs = [...studentSnap.docs, ...regSnap.docs];
          for (const d of allDocs) {
            const dData = d.data();
            const dPhone = (dData.phone || '').replace(/\D/g, '').slice(-9);
            const dName = (dData.fullNameAm || dData.fullNameEn || '').trim().toLowerCase();
            const reqName = (ticketData.requesterName || '').trim().toLowerCase();
            if ((cleanPhone && dPhone === cleanPhone) || (reqName && dName === reqName)) {
              recipientTelegramId = dData.telegramId || dData.tgId;
              if (recipientTelegramId) break;
            }
          }
        } catch (findErr) {
          console.warn('Error resolving telegramId for support requester:', findErr);
        }
      }

      // Send direct Telegram notification to requester
      let sentToTg = false;
      const bot = getBot();
      if (bot && recipientTelegramId) {
        try {
          await bot.sendMessage(
            recipientTelegramId,
            `💬 *የድጋፍ ጥያቄ ምላሽ (Support Desk Response)*\n` +
            `⛪ መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን\n` +
            `═══════════════════════\n\n` +
            `• *ቲኬት ቁጥር:* \`${ticketData.ticketNumber || id}\`\n` +
            `• *ርዕስ/ጉዳይ:* ${ticketData.title || ticketData.category}\n\n` +
            `✍️ *ከአስተዳዳሪው የተላከ ምላሽ (Admin Reply):*\n` +
            `"${text}"\n\n` +
            `⏰ *ሰዓት:* ${newNote.date}\n` +
            `═══════════════════════\n` +
            `እግዚአብሔር ይባርክዎ!`,
            { parse_mode: 'Markdown' }
          );
          sentToTg = true;
          console.log(`✅ Direct support reply sent to Telegram user ${recipientTelegramId}`);
        } catch (tgErr: any) {
          console.error('Failed to notify student on Telegram for support note:', tgErr.message);
        }
      }

      // Save targeted notification for the requester (received on mobile/student app)
      await db.collection('notifications').add({
        title: `💬 ለድጋፍ ጥያቄዎ (${ticketData.ticketNumber || id}) የተሰጠ ምላሽ`,
        message: `ከ${author || 'አስተባባሪ'}: "${text}"`,
        senderName: author || 'አስተባባሪ',
        targetRequesterName: ticketData.requesterName || '',
        targetPhone: ticketData.phone || '',
        targetTelegramId: recipientTelegramId || '',
        ticketId: id,
        ticketNumber: ticketData.ticketNumber || id,
        createdAt: new Date().toISOString(),
        isDirectReply: true,
      }).catch(console.error);

      res.json({ success: true, sentToTelegram: sentToTg, message: 'Support ticket note added and dispatched directly to requester.' });
    } catch (error) {
      console.error('Failed to add support ticket note:', error);
      res.status(500).json({ error: 'Failed to add support ticket note' });
    }
  });

  app.delete('/api/leave_requests/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const ref = db.collection('leave_requests').doc(id);
      const snap = await ref.get();
      if (snap.exists) {
        await ref.delete();
      }
      res.json({ success: true, message: 'Leave request deleted.' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete leave request' });
    }
  });

  app.delete(['/api/support_tickets/:id', '/api/support-tickets/:id'], async (req, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const ref = db.collection('support_tickets').doc(id);
      const snap = await ref.get();
      if (snap.exists) {
        await ref.delete();
      }
      const querySnap = await db.collection('support_tickets').where('ticketNumber', '==', id).get();
      for (const d of querySnap.docs) {
        await db.collection('support_tickets').doc(d.id).delete();
      }
      res.json({ success: true, message: 'Support ticket deleted.' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete support ticket' });
    }
  });

  app.delete(['/api/leave_requests/:id', '/api/leave-requests/:id'], async (req, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const ref = db.collection('leave_requests').doc(id);
      await ref.delete();
      res.json({ success: true, message: 'Leave request deleted.' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete leave request' });
    }
  });

  // Telegram File Proxy Route (to show student profile photos from Telegram)
  app.get('/api/telegram/file/:fileId', async (req, res) => {
    try {
      const { fileId } = req.params;
      const bot = getBot();
      if (!bot) return res.status(503).json({ error: 'Bot not initialized' });

      const file = await bot.getFile(fileId);
      const filePath = file.file_path;
      const tgToken = process.env.TELEGRAM_BOT_TOKEN;
      const url = `https://api.telegram.org/file/bot${tgToken}/${filePath}`;

      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      res.set('Content-Type', contentType);
      res.send(Buffer.from(buffer));
    } catch (err) {
      console.error('Error proxying Telegram file:', err);
      res.status(500).json({ error: 'Failed to fetch file' });
    }
  });

  const distPath = path.resolve(process.cwd(), 'dist');
  const isProduction = process.env.NODE_ENV === 'production' && fs.existsSync(distPath);

  if (isProduction) {
    console.log('📦 Serving production build from dist folder...');
    app.use(express.static(distPath));
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // Initialize Vite middleware for frontend development with HMR disabled to prevent port conflicts
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const portArgIdx = process.argv.indexOf('--port');
  const cliPort =
    portArgIdx !== -1 && process.argv[portArgIdx + 1]
      ? parseInt(process.argv[portArgIdx + 1], 10)
      : NaN;
  const envPort = process.env.PORT ? parseInt(process.env.PORT, 10) : NaN;
  const PORT = !Number.isNaN(cliPort)
    ? cliPort
    : process.env.NODE_ENV === 'production'
      ? (!Number.isNaN(envPort) ? envPort : 3000)
      : 3000;

  // Keep-alive mechanism to prevent Render instance from idling in production
  if (process.env.NODE_ENV === 'production') {
    const externalUrl = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || 'https://wold-wahid-sunday-school-app.vercel.app';
    setInterval(async () => {
      try {
        const pingUrl = externalUrl ? `${externalUrl.replace(/\/$/, '')}/api/health` : `http://localhost:${PORT}/api/health`;
        const response = await fetch(pingUrl, { headers: { 'User-Agent': 'Render-Self-Ping/1.0' } });
        if (response.ok) {
          console.log(`⏱️ Keep-alive ping succeeded (${response.status}) at ${new Date().toISOString()}`);
        }
      } catch (error: any) {
        console.warn('Keep-alive ping notice:', error?.message || error);
      }
    }, 4 * 60 * 1000);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
