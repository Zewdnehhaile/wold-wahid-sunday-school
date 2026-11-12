import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

// Firestore Trigger: When a registration is approved, send Telegram notification
export const onRegistrationApproved = functions.firestore
  .document('registrations/{regId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Check if status changed to approved
    if (before.status !== 'approved' && after.status === 'approved') {
      const telegramId = after.telegramId || after.tgId;
      const studentCode = after.studentCode || after.code;
      const fullName = after.fullNameAm || after.fullNameEn || 'ተማሪ';

      if (telegramId) {
        try {
const token = '8611581813:AAHadIUrYIkmVzz90WfvcpTduj-ubCZCL8w';
          if (!token) {
            console.error('Telegram bot token not configured in functions config');
            return null;
          }

          const message = 
            `🎉 *እንኳን ደስ አለዎት! ምዝገባዎ ጸድቋል*\n*Congratulations! Registration Approved*\n\n` +
            `በመካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን የወልደ ዋሕድ ሰንበት ት/ቤት ምዝገባዎ በአስተዳዳሪው ጸድቋል!\n\n` +
            `🆔 *የተመደበ የተማሪ መታወቂያ:* \`${studentCode}\`\n\n` +
            `አሁን በቦቱ ውስጥ "👤 የኔ መታወቂያና QR" ወይም /start የሚለውን በመጫን የእርስዎን ኦፊሴላዊ የQR ዲጂታል መታወቂያ ካርድ መቀበል ይችላሉ።`;

          const fetch = (global as any).fetch || require('node-fetch');
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: telegramId,
              text: message,
              parse_mode: 'Markdown',
            }),
          });
          console.log(`✅ Approval notification sent to telegramId: ${telegramId}`);
        } catch (err) {
          console.error('Failed to send Telegram approval notification:', err);
        }
      }
    }
    return null;
  });

// Firestore Trigger: When a new broadcast notification is added, dispatch to all Telegram subscribers
export const onBroadcastNotification = functions.firestore
  .document('notifications/{notifId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    if (!data || !data.isBroadcast) return null;

    try {
      const token = '8611581813:AAHadIUrYIkmVzz90WfvcpTduj-ubCZCL8w';
      if (!token) {
        console.error('Telegram bot token not configured');
        return null;
      }

      const broadcastMsg = 
        `📢 *አዲስ ማስታወቂያ (Announcement)*\n` +
        `⛪ *መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን*\n` +
        `═══════════════════════\n\n` +
        `📌 *${data.title || 'ወልደ ዋሕድ ሰንበት ት/ቤት ማስታወቂያ'}*\n\n` +
        `${data.message}\n\n` +
        `═══════════════════════\n` +
        `✍️ የላከው: *${data.senderName || 'አስተዳዳሪ'}*\n` +
        `⏰ ሰዓት: ${new Date().toLocaleTimeString()}`;

      // Collect unique Telegram IDs from bot_subscribers and students
      const tgIds = new Set<string>();
      const collections = ['bot_subscribers', 'students', 'registrations'];
      
      for (const col of collections) {
        const querySnap = await db.collection(col).get();
        querySnap.docs.forEach((d) => {
          const dData = d.data();
          const tId = dData.telegramId || dData.tgId || dData.chatId;
          if (tId) tgIds.add(String(tId));
        });
      }

      console.log(`📣 Dispatching Firebase Cloud Function broadcast to ${tgIds.size} users...`);
      const fetch = (global as any).fetch || require('node-fetch');

      let sentCount = 0;
      for (const chatId of tgIds) {
        try {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: broadcastMsg,
              parse_mode: 'Markdown',
            }),
          });
          sentCount++;
        } catch (e) {
          console.warn(`Failed to send to ${chatId}:`, e);
        }
      }

      console.log(`✅ Broadcast successfully sent to ${sentCount}/${tgIds.size} Telegram users.`);
    } catch (err) {
      console.error('Error in onBroadcastNotification function:', err);
    }
    return null;
  });

// Firestore Trigger: When a leave request status is updated, notify the student
export const onLeaveRequestUpdated = functions.firestore
  .document('leave_requests/{leaveId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.status !== after.status && (after.status === 'approved' || after.status === 'rejected')) {
      const telegramId = after.telegramId || after.tgId;
      const studentCode = after.studentCode;
      const statusAm = after.status === 'approved' ? '✅ ጸድቋል (Approved)' : '❌ አልተቀበለም (Rejected)';
      const reason = after.reason || (after.status === 'approved' ? 'ፈቃድዎ ጸድቋል' : 'የተጠየቀው ፈቃድ አልተፈቀደም');
      const adminName = after.approvedBy || 'አስተዳዳሪ';

      let recipientTelegramId = telegramId;
      if (!recipientTelegramId && studentCode) {
        const studentSnap = await db.collection('students').where('code', '==', studentCode).get();
        if (!studentSnap.empty) {
          recipientTelegramId = studentSnap.docs[0].data().telegramId;
        }
      }

      if (recipientTelegramId) {
        try {
          const token = '8611581813:AAHadIUrYIkmVzz90WfvcpTduj-ubCZCL8w';
          const msgText = 
            `✉️ *የፈቃድ ጥያቄ ምላሽ (Leave Request Update)*\n` +
            `⛪ መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን\n` +
            `═══════════════════════\n\n` +
            `• *የፈቃድ ዓይነት:* ${after.leaveType || 'ፈቃድ'}\n` +
            `• *ወቅት/ጊዜ:* ${after.duration || 'N/A'}\n` +
            `• *አሁን ያለው ሁኔታ (Status):* *${statusAm}*\n` +
            `• *ምክንያት / አስተያየት:* ${reason}\n` +
            `• *የወሰነው:* ${adminName}\n\n` +
            `ትኩረትዎ እናመሰግናለን!`;

          const fetch = (global as any).fetch || require('node-fetch');
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: recipientTelegramId,
              text: msgText,
              parse_mode: 'Markdown',
            }),
          });
          console.log(`✅ Leave request notification sent to ${recipientTelegramId}`);
        } catch (err) {
          console.error('Failed to send leave request notification:', err);
        }
      }
    }
    return null;
  });

// Firestore Trigger: When a support ticket status is updated, notify the student
export const onSupportTicketUpdated = functions.firestore
  .document('support_tickets/{ticketId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    const statusChanged = before.status !== after.status;
    const notesChanged = JSON.stringify(before.notes || []) !== JSON.stringify(after.notes || []);

    if (statusChanged || notesChanged) {
      const telegramId = after.telegramId || after.tgId;
      const studentPhone = after.phone;
      const studentCode = after.memberCode;

      let recipientTelegramId = telegramId;
      if (!recipientTelegramId && (studentPhone || studentCode)) {
        const cleanPhone = (studentPhone || '').replace(/\D/g, '').slice(-9);
        const [studentSnap, regSnap] = await Promise.all([
          db.collection('students').get(),
          db.collection('registrations').get(),
        ]);
        const allDocs = [...studentSnap.docs, ...regSnap.docs];
        for (const d of allDocs) {
          const dData = d.data();
          const dPhone = (dData.phone || '').replace(/\D/g, '').slice(-9);
          const dCode = (dData.code || dData.studentCode || '').trim().toLowerCase();
          if ((cleanPhone && dPhone === cleanPhone) || (studentCode && dCode === String(studentCode).trim().toLowerCase())) {
            recipientTelegramId = dData.telegramId || dData.tgId;
            if (recipientTelegramId) break;
          }
        }
      }

      if (recipientTelegramId) {
        try {
          const token = '8611581813:AAHadIUrYIkmVzz90WfvcpTduj-ubCZCL8w';
          let msgText = '';

          if (notesChanged && after.notes && after.notes.length > (before.notes || []).length) {
            const latestNote = after.notes[after.notes.length - 1];
            msgText = 
              `💬 *የድጋፍ ጥያቄ ምላሽ (Support Desk Response)*\n` +
              `⛪ መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን\n` +
              `═══════════════════════\n\n` +
              `• *ቲኬት ቁጥር:* \`${after.ticketNumber || context.params.ticketId}\`\n` +
              `• *ርዕስ/ጉዳይ:* ${after.title || after.category}\n\n` +
              `✍️ *ከአስተዳዳሪው የተላከ ምላሽ (Admin Reply):*\n` +
              `${latestNote.text}\n\n` +
              `⏰ *ሰዓት:* ${latestNote.date}\n` +
              `👤 *መልስ የሰጠው:* ${latestNote.author}\n\n` +
              `ተጨማሪ ጥያቄ ካለዎት እዚህ መልሰው መጻፍ ይችላሉ።`;
          } else if (statusChanged) {
            const statusAm = after.status === 'approved' ? '✅ ጸድቋል (Approved)' : after.status === 'rejected' ? '❌ አልተቀበለም (Rejected)' : after.status === 'resolved' ? '✅ ተፈትቷል (Resolved)' : after.status === 'in_contact' ? '📞 በሂደት ላይ (In Progress)' : '📌 ታይቷል (Updated)';
            msgText = 
              `💬 *የድጋፍ ጥያቄ ምላሽ (Support Ticket Update)*\n` +
              `⛪ መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን\n` +
              `═══════════════════════\n\n` +
              `• *ቲኬት ቁጥር:* \`${after.ticketNumber || context.params.ticketId}\`\n` +
              `• *ርዕስ/ጉዳይ:* ${after.title || after.category}\n` +
              `• *አሁን ያለው ሁኔታ (Status):* *${statusAm}*\n` +
              `• *ምክንያት / አስተያየት:* ${after.reason || 'የለም'}\n` +
              `• *አስተዳዳሪ:* ${after.approvedBy || 'አስተዳዳሪ'}\n\n` +
              `ጥያቄዎ ትኩረት አግኝቷል!`;
          }

          if (msgText) {
            const fetch = (global as any).fetch || require('node-fetch');
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: recipientTelegramId,
                text: msgText,
                parse_mode: 'Markdown',
              }),
            });
            console.log(`✅ Support ticket notification sent to ${recipientTelegramId}`);
          }
        } catch (err) {
          console.error('Failed to send support ticket notification:', err);
        }
      }
    }
    return null;
  });
