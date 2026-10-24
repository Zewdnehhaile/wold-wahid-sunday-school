import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { db } from './services/firebase';
import { bot, dispatchSendMessage } from './services/bot';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Registration endpoint: Get registration status
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

// Admin approval trigger with Telegram notification
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

    if (!regDoc.exists) return res.status(404).json({ error: 'Registration not found' });

    const regData = regDoc.data()!;
    
    // Update registration
    await regRef.update({
      status: 'approved',
      studentCode,
      code: studentCode,
      approvedBy: approvedBy || 'ዋና አስተዳዳሪ',
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Check if student profile already exists in students collection
    const studentQuery = await db.collection('students').where('code', '==', studentCode).get();
    if (studentQuery.empty) {
      await db.collection('students').add({
        code: studentCode,
        studentCode,
        fullNameAm: regData.fullNameAm || 'ተማሪ',
        fullNameEn: regData.fullNameEn || 'Student',
        phone: regData.phone || '',
        gender: regData.gender || 'male',
        department: regData.department || 'education',
        gradeLevel: regData.gradeLevel || 'general',
        telegramId: regData.telegramId || '',
        status: 'active',
        registeredDate: new Date().toISOString().split('T')[0],
        approvedBy: approvedBy || 'ዋና አስተዳዳሪ',
        approvedAt: new Date().toISOString()
      });
    }

    // Send real Telegram notification if telegramId exists
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
    console.error('Backend approval failed:', error);
    res.status(500).json({ error: 'Approval failed' });
  }
});

// Telegram Webhook endpoint (alternative to polling)
app.post('/api/telegram/webhook', (req, res) => {
  if (bot) {
    bot.processUpdate(req.body);
  }
  res.sendStatus(200);
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
