import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { db } from './services/firebase';
import { getBot, handleTelegramUpdate, dispatchSendMessage } from './services/bot';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// API Routes & Health Checks (UptimeRobot, Render, and monitoring)
app.get(['/api/health', '/health', '/ping'], (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'wold-wahid-sunday-school-backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root route
app.get('/', (req, res) => {
  const parentDist = path.resolve(process.cwd(), '../dist');
  if (fs.existsSync(parentDist) && fs.existsSync(path.join(parentDist, 'index.html'))) {
    return res.sendFile(path.join(parentDist, 'index.html'));
  }
  res.status(200).json({
    service: 'wold-wahid-sunday-school-backend',
    status: 'online',
    timestamp: new Date().toISOString()
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
    path.resolve(process.cwd(), '../public/WoldWahid.apk'),
    path.resolve(process.cwd(), '../dist/WoldWahid.apk'),
    path.resolve(__dirname, '../../public/WoldWahid.apk'),
    path.resolve(__dirname, '../public/WoldWahid.apk'),
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

    const cleanCode = String(memberCode).trim().toUpperCase();

    // Look up student details to enrich attendance record
    let studentName = memberNameAm || memberNameEn || '';
    let studentDept = department || '';
    let studentTgId = '';

    try {
      const [studentsSnap, regSnap] = await Promise.all([
        db.collection('students').get(),
        db.collection('registrations').get(),
      ]);
      const allDocs = [...studentsSnap.docs, ...regSnap.docs];
      const foundDoc = allDocs.find(d => {
        const dData = d.data();
        const dCode = String(dData.code || dData.studentCode || '').trim().toUpperCase();
        const dPhone = String(dData.phone || '').replace(/\D/g, '').slice(-9);
        const codeDigits = cleanCode.replace(/\D/g, '').slice(-9);
        return dCode === cleanCode || (codeDigits && dPhone && dPhone === codeDigits);
      });

      if (foundDoc) {
        const dData = foundDoc.data();
        studentName = studentName || dData.fullNameAm || dData.fullNameEn || '';
        studentDept = studentDept || dData.department || '';
        studentTgId = dData.telegramId || dData.tgId || '';
      }
    } catch (e) {
      console.warn('Error resolving student for attendance:', e);
    }

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
    const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    records.sort((a: any, b: any) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime());
    res.json(records);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch attendance records' });
  }
});

// Telegram Webhook Endpoint (optional if using webhook instead of polling)
app.post('/api/telegram/webhook', async (req, res) => {
  try {
    await handleTelegramUpdate(req.body);
    res.sendStatus(200);
  } catch (err) {
    console.error('Error in Telegram webhook endpoint:', err);
    res.sendStatus(200);
  }
});

// Student Profile Lookup by ID or Phone
// Student Profile Lookup by ID or Phone (handles students, registrations, and admins)
app.get(['/api/students/:identifier', '/api/student/:identifier'], async (req, res) => {
  try {
    const rawIdentifier = String(req.params.identifier || '').trim();
    const identifierUpper = rawIdentifier.toUpperCase();
    const cleanPhone = rawIdentifier.replace(/\D/g, '').slice(-9);

    // 1. Search in students collection by code, studentCode, id, or phone
    try {
      const studentsSnap = await db.collection('students').get();
      for (const doc of studentsSnap.docs) {
        const data = doc.data();
        const docId = doc.id;
        const code = String(data.code || data.studentCode || '').trim().toUpperCase();
        const phone = String(data.phone || '').replace(/\D/g, '').slice(-9);

        if (
          docId === rawIdentifier ||
          (code && code === identifierUpper) ||
          (cleanPhone && phone === cleanPhone)
        ) {
          return res.json({
            id: docId,
            ...data,
            code: data.code || data.studentCode || code || identifierUpper,
            role: data.role || 'student',
          });
        }
      }
    } catch (e) {
      console.warn('Error reading students collection:', e);
    }

    // 2. Search in registrations collection by studentCode or phone
    try {
      const regSnap = await db.collection('registrations').get();
      for (const doc of regSnap.docs) {
        const data = doc.data();
        const code = String(data.studentCode || data.code || '').trim().toUpperCase();
        const phone = String(data.phone || '').replace(/\D/g, '').slice(-9);

        if ((code && code === identifierUpper) || (cleanPhone && phone === cleanPhone)) {
          return res.json({
            id: doc.id,
            ...data,
            code: data.studentCode || data.code || identifierUpper,
            status: data.status || 'approved',
            role: 'student',
          });
        }
      }
    } catch (e) {
      console.warn('Error reading registrations collection:', e);
    }

    // 3. Search in admins collection as fallback
    try {
      const adminsSnap = await db.collection('admins').get();
      for (const doc of adminsSnap.docs) {
        const data = doc.data();
        const adminPhone = String(data.phone || '').replace(/\D/g, '').slice(-9);
        if (cleanPhone && adminPhone === cleanPhone) {
          return res.json({
            id: doc.id,
            ...data,
            role: data.role || 'admin',
          });
        }
      }
    } catch (e) {
      console.warn('Error reading admins collection:', e);
    }

    return res.status(404).json({ error: 'Student not found in database' });
  } catch (error) {
    console.error('Error in student profile lookup:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Admin Login Lookup by Phone (checks admins collection and students with admin role in Firestore)
app.get(['/api/admins/:phone', '/api/admin/:phone'], async (req, res) => {
  try {
    const rawPhone = String(req.params.phone || '').trim();
    const phoneInput = rawPhone.replace(/\D/g, '').slice(-9);

    if (!phoneInput) {
      return res.status(400).json({ error: 'Valid phone number is required' });
    }

    // 1. Check admins collection in Firestore
    try {
      const adminsSnap = await db.collection('admins').get();
      for (const doc of adminsSnap.docs) {
        const data = doc.data();
        const adminPhone = String(data.phone || '').replace(/\D/g, '').slice(-9);
        if (adminPhone && phoneInput && adminPhone === phoneInput) {
          return res.json({
            id: doc.id,
            ...data,
            role: data.role || 'admin',
            password: data.password || '',
          });
        }
      }
    } catch (e) {
      console.warn('Error reading admins collection for admin lookup:', e);
    }

    // 2. Check students collection for records with admin / super_admin role
    try {
      const studentsSnap = await db.collection('students').get();
      for (const doc of studentsSnap.docs) {
        const data = doc.data();
        const sPhone = String(data.phone || '').replace(/\D/g, '').slice(-9);
        if (sPhone && phoneInput && sPhone === phoneInput && (data.role === 'admin' || data.role === 'super_admin')) {
          return res.json({
            id: doc.id,
            ...data,
            role: data.role,
            password: data.password || '',
          });
        }
      }
    } catch (e) {
      console.warn('Error reading students collection for admin lookup:', e);
    }

    return res.status(404).json({ error: 'Admin not found in database' });
  } catch (error) {
    console.error('Error in admin lookup:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Admin Login Endpoint (Verifies password against Firestore admins collection)
app.post('/api/admins/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone and password are required' });
    }
    const cleanPhone = String(phone).replace(/\D/g, '').slice(-9);
    const cleanPass = String(password).trim();

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
        if (cleanPass !== storedPassword) {
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
        if (storedPassword && cleanPass !== storedPassword) {
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

    return res.status(404).json({ error: 'ይህ ስልክ ቁጥር በአስተዳዳሪዎች ዝርዝር ውስጥ አልተገኘም (Admin phone not found)' });
  } catch (error) {
    console.error('Error in /api/admins/login:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Student Direct Login (Phone or StudentCode - No password required initially)
app.post('/api/students/login', async (req, res) => {
  try {
    const { identifier, phone, code } = req.body;
    const rawInput = String(identifier || phone || code || '').trim();
    if (!rawInput) {
      return res.status(400).json({ error: 'Phone number or Student ID is required' });
    }

    const upperCode = rawInput.toUpperCase();
    const cleanPhone = rawInput.replace(/\D/g, '').slice(-9);

    // 1. Search in students collection
    const studentsSnap = await db.collection('students').get();
    for (const doc of studentsSnap.docs) {
      const data = doc.data();
      const dCode = String(data.code || data.studentCode || '').trim().toUpperCase();
      const dPhone = String(data.phone || '').replace(/\D/g, '').slice(-9);

      if (
        doc.id === rawInput ||
        (dCode && dCode === upperCode) ||
        (cleanPhone && dPhone && dPhone === cleanPhone)
      ) {
        return res.json({
          success: true,
          student: {
            id: doc.id,
            code: data.code || data.studentCode || upperCode,
            role: 'student',
            ...data
          }
        });
      }
    }

    // 2. Search in registrations collection
    const regSnap = await db.collection('registrations').get();
    for (const doc of regSnap.docs) {
      const data = doc.data();
      const dCode = String(data.studentCode || data.code || '').trim().toUpperCase();
      const dPhone = String(data.phone || '').replace(/\D/g, '').slice(-9);

      if (
        doc.id === rawInput ||
        (dCode && dCode === upperCode) ||
        (cleanPhone && dPhone && dPhone === cleanPhone)
      ) {
        return res.json({
          success: true,
          student: {
            id: doc.id,
            code: data.studentCode || data.code || upperCode,
            status: data.status || 'pending',
            role: 'student',
            ...data
          }
        });
      }
    }

    return res.status(404).json({ error: 'የተማሪ መታወቂያ ወይም ስልክ ቁጥር አልተገኘም (Student ID or phone not found)' });
  } catch (error) {
    console.error('Error in /api/students/login:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Student Support Tickets Lookup
app.get('/api/students/:code/tickets', async (req, res) => {
  try {
    const { code } = req.params;
    const snap = await db.collection('support_tickets')
      .where('memberCode', '==', code)
      .get();
    
    if (snap.empty) {
      // Try by phone if code fails (some might not have code yet)
      const studentDoc = await db.collection('students').where('code', '==', code).get();
      if (!studentDoc.empty) {
        const phone = studentDoc.docs[0].data().phone;
        const phoneSnap = await db.collection('support_tickets').where('phone', '==', phone).get();
        return res.json(phoneSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    }
    
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Student Attendance History Lookup
app.get('/api/students/:code/attendance', async (req, res) => {
  try {
    const { code } = req.params;
    const snap = await db.collection('attendance')
      .where('memberCode', '==', code)
      .get();
    
    const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(records.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

// Create Support Ticket from Mobile
app.post('/api/support_tickets', async (req, res) => {
  try {
    const ticket = {
      ...req.body,
      createdAt: new Date().toISOString(),
      status: 'new',
      priority: 'medium',
      notes: [],
    };
    const docRef = await db.collection('support_tickets').add(ticket);
    res.json({ id: docRef.id, ticketNumber: ticket.ticketNumber });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// Admin: List all support tickets
app.get('/api/support_tickets', async (req, res) => {
  try {
    const snap = await db.collection('support_tickets').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Admin: List all registrations
app.get('/api/registrations', async (req, res) => {
  try {
    const snap = await db.collection('registrations').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// Admin: List all leave requests
app.get('/api/leave_requests', async (req, res) => {
  try {
    const snap = await db.collection('leave_requests').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
});

// Registrations lookup
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

// Registration Approval
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

// Notifications Broadcast
app.post('/api/notifications/broadcast', async (req, res) => {
  try {
    const { title, message, senderName, targetIds } = req.body;
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

    let sentCount = 0;
    const bot = getBot();
    let tgIds = new Set<string>();

    if (targetIds && Array.isArray(targetIds) && targetIds.length > 0) {
      targetIds.forEach((id: any) => {
        if (id) tgIds.add(String(id));
      });
    } else {
      console.log('📣 Starting universal broadcast search...');
      const collections = ['students', 'registrations', 'support_tickets', 'leave_requests', 'bot_subscribers', 'members'];
      
      const results = await Promise.allSettled(
        collections.map(c => db.collection(c).get())
      );

      results.forEach((res, idx) => {
        if (res.status === 'fulfilled') {
          res.value.docs.forEach(d => {
            const data = d.data();
            const tId = data.telegramId || data.tgId || data.telegram_id || data.chatId || data.chat_id;
            if (tId) tgIds.add(String(tId));
          });
          console.log(`✅ Collected IDs from ${collections[idx]}`);
        } else {
          console.warn(`❌ Failed to fetch IDs from ${collections[idx]}:`, res.reason);
        }
      });
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

// Leave request status update
app.post(['/api/leave_requests/:id/status', '/api/leave-requests/:id/status'], async (req, res) => {
  try {
    const id = String(req.params.id);
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

    console.log(`✉️ Leave request ${id} updated to ${status} by ${adminName}`);

    let recipientTelegramId = leaveData.telegramId;
    if (!recipientTelegramId && (leaveData.studentName || leaveData.studentCode || leaveData.phone)) {
      try {
        console.log(`🔍 Searching for telegramId for student: ${leaveData.studentName || leaveData.studentCode || leaveData.phone}`);
        const cleanPhone = (leaveData.phone || '').replace(/\D/g, '').slice(-9);
        
        const [studentSnap, regSnap] = await Promise.all([
          db.collection('students').get(),
          db.collection('registrations').get(),
        ]);
        
        const allDocs = [...studentSnap.docs, ...regSnap.docs];
        for (const d of allDocs) {
          const dData = d.data();
          const dPhone = (dData.phone || '').replace(/\D/g, '').slice(-9);
          const dNameAm = (dData.fullNameAm || '').trim().toLowerCase();
          const dNameEn = (dData.fullNameEn || '').trim().toLowerCase();
          const reqName = (leaveData.studentName || '').trim().toLowerCase();
          const dCode = (dData.code || dData.studentCode || '').trim().toLowerCase();
          const reqCode = (leaveData.studentCode || '').trim().toLowerCase();
          
          if (
            (reqCode && dCode === reqCode) || 
            (reqName && (dNameAm === reqName || dNameEn === reqName)) ||
            (cleanPhone && dPhone === cleanPhone)
          ) {
            recipientTelegramId = dData.telegramId || dData.tgId || dData.chatId;
            if (recipientTelegramId) {
              console.log(`✅ Found telegramId: ${recipientTelegramId} for student ${dNameAm}`);
              break;
            }
          }
        }
      } catch (findErr) {
        console.warn('Error resolving telegramId for leave requester:', findErr);
      }
    }

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
    }

    res.json({ success: true, message: 'Leave request status updated and student notified with reason.' });
  } catch (error) {
    console.error('Failed to update leave request status:', error);
    res.status(500).json({ error: 'Failed to update leave request status' });
  }
});

// Support ticket status update
app.post(['/api/support_tickets/:id/status', '/api/support-tickets/:id/status'], async (req, res) => {
  try {
    const id = String(req.params.id);
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
    }

    res.json({ success: true, message: 'Support ticket status updated and student notified with reason.' });
  } catch (error) {
    console.error('Failed to update support ticket status:', error);
    res.status(500).json({ error: 'Failed to update support ticket status' });
  }
});

// Support ticket note/reply
app.post(['/api/support_tickets/:id/note', '/api/support-tickets/:id/note'], async (req, res) => {
  try {
    const id = String(req.params.id);
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
      lastRepliedAt: new Date().toISOString(),
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
        const msgText = 
          `💬 *የድጋፍ ጥያቄ ምላሽ (Support Desk Response)*\n` +
          `⛪ መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን\n` +
          `═══════════════════════\n\n` +
          `• *ቲኬት ቁጥር:* \`${ticketData.ticketNumber || id}\`\n` +
          `• *ርዕስ/ጉዳይ:* ${ticketData.title || ticketData.category}\n\n` +
          `✍️ *ከአስተዳዳሪው የተላከ ምላሽ (Admin Reply):*\n` +
          `${newNote.text}\n\n` +
          `⏰ *ሰዓት:* ${newNote.date}\n` +
          `👤 *መልስ የሰጠው:* ${newNote.author}\n\n` +
          `ተጨማሪ ጥያቄ ካለዎት እዚህ መልሰው መጻፍ ይችላሉ።`;

        if (bot) {
          await bot.sendMessage(recipientTelegramId, msgText, { parse_mode: 'Markdown' });
        } else {
          await dispatchSendMessage(recipientTelegramId, msgText, { parse_mode: 'Markdown' });
        }
      } catch (tgErr) {
        console.error('Failed to notify student on Telegram for support reply:', tgErr);
      }
    }

    res.json({ success: true, message: 'Note added to support ticket and notification dispatched.' });
  } catch (error) {
    console.error('Failed to add note to support ticket:', error);
    res.status(500).json({ error: 'Failed to add note to support ticket' });
  }
});

// Delete Support Ticket
app.delete(['/api/support_tickets/:id', '/api/support-tickets/:id'], async (req, res) => {
  try {
    const id = String(req.params.id);
    const ticketRef = db.collection('support_tickets').doc(id);
    const docSnap = await ticketRef.get();
    if (docSnap.exists) {
      await ticketRef.delete();
      return res.json({ success: true, message: 'Support ticket deleted.' });
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

// Delete Leave Request
app.delete(['/api/leave_requests/:id', '/api/leave-requests/:id'], async (req, res) => {
  try {
    const id = String(req.params.id);
    const ref = db.collection('leave_requests').doc(id);
    await ref.delete();
    res.json({ success: true, message: 'Leave request deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete leave request' });
  }
});

// Telegram File Proxy Route
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

// Fallback handler for unmatched routes
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' });
  }
  const parentDist = path.resolve(process.cwd(), '../dist');
  if (fs.existsSync(parentDist) && fs.existsSync(path.join(parentDist, 'index.html'))) {
    return res.sendFile(path.join(parentDist, 'index.html'));
  }
  res.status(200).json({
    service: 'wold-wahid-sunday-school-backend',
    status: 'online',
    path: req.path
  });
});

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 10000;

// Keep-alive mechanism to prevent Render free instance from idling
const externalUrl = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || 'https://wold-wahid-sunday-school.onrender.com';
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
}, 4 * 60 * 1000); // 4 minutes

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Wold-Wahid Backend running on http://0.0.0.0:${PORT}`);
});
