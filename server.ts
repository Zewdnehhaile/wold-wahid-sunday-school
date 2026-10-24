import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { db } from './backend/src/services/firebase.ts';
import { getBot, handleTelegramUpdate, dispatchSendMessage } from './backend/src/services/bot.ts';
import { doc, deleteDoc } from 'firebase/firestore';

dotenv.config();

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

      // Collect all student & registration telegram IDs
      let sentCount = 0;
      const bot = getBot();
      if (bot) {
        const { targetIds } = req.body;
        let tgIds = new Set<string>();

        if (targetIds && Array.isArray(targetIds) && targetIds.length > 0) {
          targetIds.forEach(id => {
            if (id) tgIds.add(String(id));
          });
        } else {
          const studentSnap = await db.collection('students').get();
          const regSnap = await db.collection('registrations').get();

          console.log(`📣 Broadcasting: Found ${studentSnap.size} students and ${regSnap.size} registrations.`);
          studentSnap.docs.forEach((d) => {
            const data = d.data();
            const tId = data.telegramId || data.tgId;
            if (tId) tgIds.add(String(tId));
          });

          regSnap.docs.forEach((d) => {
            const data = d.data();
            const tId = data.telegramId || data.tgId;
            if (tId) tgIds.add(String(tId));
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
            await bot.sendMessage(chatId, broadcastMsg, { parse_mode: 'Markdown' });
            sentCount++;
          } catch (sendErr: any) {
            console.warn(`Failed to send broadcast to ${chatId}:`, sendErr.message);
          }
        }
      }

      res.json({
        success: true,
        sentToTelegram: sentCount,
        message: 'Notification dispatched to mobile apps and Telegram students.',
      });
    } catch (err: any) {
      console.error('Error broadcasting notification:', err);
      res.status(500).json({ error: 'Failed to broadcast notification: ' + (err.message || 'Unknown error') });
    }
  });

  // Leave request status update API (Approve/Reject + notify user on Telegram & notifications)
  app.post('/api/leave_requests/:id/status', async (req, res) => {
    try {
      const { id } = req.params;
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

      // Save targeted notification for the student (received on mobile/student app)
      await db.collection('notifications').add({
        title: `✉️ የፈቃድ ጥያቄዎ ${status === 'approved' ? 'ጸድቋል' : 'አልተቀበለም'}`,
        message: `ምክንያት / ማስታወሻ: ${reason || (status === 'approved' ? 'ፈቃድዎ ጸድቋል' : 'የተጠየቀው ፈቃድ አልተፈቀደም')}`,
        senderName: adminName || 'አስተዳዳሪ',
        targetTelegramId: leaveData.telegramId || '',
        leaveRequestId: id,
        createdAt: new Date().toISOString(),
        isDirectReply: true,
      }).catch(console.error);

      const bot = getBot();
      if (bot && leaveData.telegramId) {
        try {
          const statusAm = status === 'approved' ? '✅ ጸድቋል (Approved)' : '❌ አልተቀበለም (Rejected)';
          console.log(`Sending leave status notification to ${leaveData.telegramId}`);
          await bot.sendMessage(
            leaveData.telegramId,
            `✉️ *የፈቃድ ጥያቄ ምላሽ (Leave Request Update)*\n` +
            `⛪ መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን\n` +
            `═══════════════════════\n\n` +
            `• *የፈቃድ ዓይነት:* ${leaveData.leaveType || 'ፈቃድ'}\n` +
            `• *ወቅት/ጊዜ:* ${leaveData.duration || 'N/A'}\n` +
            `• *አሁን ያለው ሁኔታ (Status):* *${statusAm}*\n` +
            `• *ምክንያት / አስተያየት (Reason):* ${reason || 'የለም'}\n` +
            `• *የወሰነው:* ${adminName || 'አስተዳዳሪ'}\n\n` +
            `ትኩረትዎ እናመሰግናለን!`,
            { parse_mode: 'Markdown' }
          );
        } catch (tgErr) {
          console.error('Failed to notify student on Telegram for leave request:', tgErr);
        }
      } else {
        console.warn(`Cannot send leave notification. Bot: ${!!bot}, TelegramId: ${leaveData.telegramId}`);
      }

      res.json({ success: true, message: 'Leave request status updated and student notified with reason.' });
    } catch (error) {
      console.error('Failed to update leave request status:', error);
      res.status(500).json({ error: 'Failed to update leave request status' });
    }
  });

  // Support ticket status update API (Resolve/Update + notify user on Telegram)
  app.post('/api/support_tickets/:id/status', async (req, res) => {
    try {
      const { id } = req.params;
      const { status, adminName } = req.body;

      const ticketRef = db.collection('support_tickets').doc(id);
      const ticketDoc = await ticketRef.get();
      if (!ticketDoc.exists) return res.status(404).json({ error: 'Support ticket not found' });

      const ticketData = ticketDoc.data()!;
      await ticketRef.update({
        status,
        updatedAt: new Date().toISOString()
      });

      const bot = getBot();
      if (bot && ticketData.telegramId) {
        try {
          const statusAm = status === 'resolved' ? '✅ ተፈትቷል (Resolved)' : status === 'in_contact' ? '📞 በሂደት ላይ (In Progress)' : '📌 ታይቷል (Updated)';
          console.log(`Sending support ticket notification to ${ticketData.telegramId}`);
          await bot.sendMessage(
            ticketData.telegramId,
            `💬 *የድጋፍ ጥያቄ ምላሽ (Support Ticket Update)*\n` +
            `⛪ መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን\n` +
            `═══════════════════════\n\n` +
            `• *ቲኬት ቁጥር:* \`${ticketData.ticketNumber || id}\`\n` +
            `• *ርዕስ/ጉዳይ:* ${ticketData.title || ticketData.category}\n` +
            `• *አሁን ያለው ሁኔታ (Status):* *${statusAm}*\n` +
            `• *አስተዳዳሪ:* ${adminName || 'አስተዳዳሪ'}\n\n` +
            `ጥያቄዎ ትኩረት አግኝቷል!`,
            { parse_mode: 'Markdown' }
          );
        } catch (tgErr) {
          console.error('Failed to notify student on Telegram for support ticket:', tgErr);
        }
      } else {
        console.warn(`Cannot send support notification. Bot: ${!!bot}, TelegramId: ${ticketData.telegramId}`);
      }

      res.json({ success: true, message: 'Support ticket status updated and student notified.' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update support ticket status' });
    }
  });

  // Support ticket note/reply API (Add note + notify requester directly on Telegram and targeted notifications)
  app.post('/api/support_tickets/:id/note', async (req, res) => {
    try {
      const { id } = req.params;
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

  app.delete('/api/support_tickets/:id', async (req, res) => {
    try {
      const { id } = req.params;
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

  // Initialize Vite middleware for frontend development with HMR disabled to prevent port 24678 conflicts
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: false,
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);

  // Keep-alive mechanism to prevent the server from sleeping
  setInterval(async () => {
    try {
      const response = await fetch('http://localhost:3000/api/health');
      const data = await response.json();
      console.log('Keep-alive ping:', data.timestamp);
    } catch (error) {
      console.error('Keep-alive ping failed:', error);
    }
  }, 5 * 60 * 1000); // 5 minutes

  const PORT = 3000;
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
