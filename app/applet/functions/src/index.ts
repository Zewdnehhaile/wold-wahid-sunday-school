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
