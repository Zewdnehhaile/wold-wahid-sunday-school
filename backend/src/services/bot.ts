import { db } from './firebase';
import { formatEthiopianDate } from '../utils/ethiopianCalendar';
import QRCode from 'qrcode';
import * as dotenv from 'dotenv';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN || '';

let botInstance: any = null;

// In-memory conversation state for multi-step wizards
interface UserSession {
  action: 'register' | 'support' | 'leave';
  step: string;
  data: Record<string, any>;
}
const userSessions = new Map<number, UserSession>();
const userLastMessageTime = new Map<number, number>();

const mainMenuKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: '📝 የተማሪ ምዝገባ' }, { text: '🔍 የምዝገባ ሁኔታ' }],
      [{ text: '👤 የኔ መታወቂያና QR' }, { text: '📊 የመገኘት ታሪክ' }],
      [{ text: '📅 የትምህርት መርሐ ግብር' }, { text: '✉️ የፈቃድ መጠየቂያ' }],
      [{ text: '📱 የሞባይል መተግበሪያ' }, { text: '💬 ድጋፍና እርዳታ' }]
    ],
    resize_keyboard: true,
  }
};

const cancelKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: '❌ Cancel (ይቅር)' }]
    ],
    resize_keyboard: true,
  }
};

const scheduleMenuText = 
  `🗓️ *የወልድ ዋሕድ ሰንበት ት/ቤት መርሐ ግብር*\n\n` +
  `መርሐ ግብሩን በምን መልኩ ማየት ይፈልጋሉ?\n` +
  `ከታች ካሉት የክፍል ደረጃዎች ወይም ቀናት አንዱን ይምረጡ፡-`;

const scheduleInlineKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: '🧸 ቅድመ አንደኛ', callback_data: 'sch_pre_kg' },
        { text: '🎒 1ኛ እና 2ኛ ክፍል', callback_data: 'sch_g1_2' },
      ],
      [
        { text: '📚 3ኛ–5ኛ ክፍል', callback_data: 'sch_g3_5' },
        { text: '🎓 6ኛ–9ኛ ክፍል', callback_data: 'sch_g6_9' },
      ],
      [
        { text: '📅 አርብ', callback_data: 'sch_friday' },
        { text: '📅 ቅዳሜ', callback_data: 'sch_saturday' },
        { text: '📅 እሁድ', callback_data: 'sch_sunday' },
      ],
    ],
  },
};

const scheduleBackKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '🔙 ወደ መርሐ ግብር ማውጫ ተመለስ', callback_data: 'sch_menu' }]
    ]
  }
};

const getScheduleText = (key: string): string => {
  switch (key) {
    case 'sch_pre_kg':
      return (
        `🧸 *ቅድመ አንደኛ (Pre-KG) - እሁድ መርሐ ግብር*\n` +
        `═══════════════════════════════\n\n` +
        `• ጸሎት መክፈቻ | 3:30–3:40 (10 ደቂቃ) | ስነስርዓት ክፍል\n` +
        `• ትምህርት | 3:40–4:00 (20 ደቂቃ) | ትምህርት ክፍል\n` +
        `• መዝሙር | 4:00–4:15 (15 ደቂቃ) | መዝሙር ክፍል\n` +
        `• አብነት | 4:15–4:30 (15 ደቂቃ) | አብነት ክፍል\n` +
        `• ኪነ ጥበብ | 4:25–4:50 (25 ደቂቃ) | ኪነ ጥበብ ክፍል\n` +
        `• ማስታወቂያና መዝጊያ ጸሎት | 4:55–5:00 (5 ደቂቃ) | ስነስርዓት ክፍል\n\n` +
        `⏰ *የክፍለ-ጊዜ ቆይታ:* 3:30 - 5:00`
      );
    case 'sch_g1_2':
      return (
        `🎒 *1ኛ እና 2ኛ ክፍል - እሁድ መርሐ ግብር*\n` +
        `═══════════════════════════════\n\n` +
        `• ጸሎት መክፈቻ | 3:30–3:35 (5 ደቂቃ) | ስነስርዓት ክፍል\n` +
        `• ትምህርት | 3:35–4:05 (30 ደቂቃ) | ትምህርት ክፍል\n` +
        `• ኪነጥበብ | 4:05–4:25 (20 ደቂቃ) | ኪነ ጥበብ ክፍል\n` +
        `• አብነት | 4:25–4:50 (25 ደቂቃ) | አብነት ክፍል\n` +
        `• መዝሙር | 4:50–5:20 (30 ደቂቃ) | መዝሙር ክፍል\n` +
        `• ማስታወቂያና መዝጊያ ጸሎት | 5:20–5:30 (10 ደቂቃ) | ስነስርዓት ክፍል\n\n` +
        `⏰ *የክፍለ-ጊዜ ቆይታ:* 3:30 - 5:30`
      );
    case 'sch_g3_5':
      return (
        `📚 *3ኛ–5ኛ ክፍል (ማዕከላዊያን) - የሳምንቱ መርሐ ግብር*\n` +
        `═══════════════════════════════\n\n` +
        `📅 *ቅዳሜ (Saturday):*\n` +
        `• መክፈቻ ጸሎት | 8:00–8:05 (5 ደቂቃ) | ስነስርዓት ክፍል\n` +
        `• ትምህርት | 8:05–9:00 (55 ደቂቃ) | ትምህርት ክፍል\n` +
        `• ኪነ ጥበብ | 9:00–9:45 (45 ደቂቃ) | ኪነ ጥበብ ክፍል\n` +
        `• ማስታወቂያና መዝጊያ ጸሎት | 9:50–10:00 (10 ደቂቃ) | ስነስርዓት ክፍል\n\n` +
        `📅 *እሁድ (Sunday):*\n` +
        `• መክፈቻ ጸሎት | 5:30–5:55 (25 ደቂቃ) | ስነስርዓት ክፍል\n` +
        `• ትምህርት | 5:55–6:35 (40 ደቂቃ) | ትምህርት ክፍል\n` +
        `• መዝሙር | 6:35–7:15 (40 ደቂቃ) | መዝሙር ክፍል\n` +
        `• አብነት | 7:15–7:30 (15 ደቂቃ) | አብነት ክፍል\n` +
        `• ማስታወቂያና መዝጊያ ጸሎት | 7:30–7:40 (10 ደቂቃ) | ስነስርዓት ክፍል`
      );
    case 'sch_g6_9':
      return (
        `🎓 *6ኛ–9ኛ ክፍል (አበው) - የሳምንቱ መርሐ ግብር*\n` +
        `═══════════════════════════════\n\n` +
        `📅 *አርብ (Friday):*\n` +
        `• ጸሎት | 11:30–11:50 (20 ደቂቃ) | ኪነ ጥበብ ክፍል\n` +
        `• ኪነ ጥበብ | 11:50–12:30 (40 ደቂቃ) | ኪነ ጥበብ ክፍል\n\n` +
        `📅 *ቅዳሜ (Saturday):*\n` +
        `• መክፈቻ ጸሎት | 9:00–9:05 (5 ደቂቃ) | ስነስርዓት ክፍል\n` +
        `• ትምህርት | 9:05–10:05 (60 ደቂቃ) | ትምህርት ክፍል\n` +
        `• አብነት | 10:05–10:35 (30 ደቂቃ) | አብነት ክፍል\n` +
        `• መዝሙር እና ወረብ | 10:35–11:50 (75 ደቂቃ) | መዝሙር ክፍል\n` +
        `• መዝጊያ ጸሎት | 11:50–11:55 (5 ደቂቃ) | ስነስርዓት ክፍል\n\n` +
        `📅 *እሁድ (Sunday):*\n` +
        `• መክፈቻ ጸሎት | 8:00–8:20 (20 ደቂቃ) | ስነስርዓት ክፍል\n` +
        `• ትምህርት | 8:20–9:20 (60 ደቂቃ) | ትምህርት ክፍል\n` +
        `• አብነት | 9:20–9:50 (30 ደቂቃ) | አብነት ክፍል\n` +
        `• መዝሙር እና ወረብ | 9:50–10:55 (65 ደቂቃ) | መዝሙር ክፍል\n` +
        `• ማስታወቂያና መዝጊያ ጸሎት | 10:55–11:00 (5 ደቂቃ) | ስነስርዓት ክፍል`
      );
    case 'sch_friday':
      return (
        `📅 *የአርብ (Friday) ክፍለ-ጊዜያት*\n` +
        `═══════════════════════════════\n\n` +
        `🎓 *6ኛ–9ኛ ክፍል:*\n` +
        `• ጸሎት | 11:30–11:50 | ኪነ ጥበብ ክፍል\n` +
        `• ኪነ ጥበብ | 11:50–12:30 | ኪነ ጥበብ ክፍል`
      );
    case 'sch_saturday':
      return (
        `📅 *የቅዳሜ (Saturday) ክፍለ-ጊዜያት*\n` +
        `═══════════════════════════════\n\n` +
        `📚 *3ኛ–5ኛ ክፍል (ማዕከላዊያን):*\n` +
        `• 8:00–10:00 (ጸሎት፣ ትምህርት፣ ኪነ ጥበብና ማስታወቂያ)\n\n` +
        `🎓 *6ኛ–9ኛ ክፍል (አበው):*\n` +
        `• 9:00–11:55 (ጸሎት፣ ትምህርት፣ አብነት፣ መዝሙርና ወረብ)`
      );
    case 'sch_sunday':
      return (
        `📅 *የእሁድ (Sunday) ክፍለ-ጊዜያት*\n` +
        `═══════════════════════════════\n\n` +
        `🧸 *ቅድመ አንደኛ:* 3:30 - 5:00\n` +
        `🎒 *1ኛ እና 2ኛ ክፍል:* 3:30 - 5:30\n` +
        `📚 *3ኛ–5ኛ ክፍል:* 5:30 - 7:40\n` +
        `🎓 *6ኛ–9ኛ ክፍል:* 8:00 - 11:00\n` +
        `🕊️ *ወርሃዊ የጋራ አገልግሎት (በ7 እና 14):* 3:30 - 10:00`
      );
    default:
      return '';
  }
};

// Dispatch Telegram sendMessage with raw fetch API
export async function dispatchSendMessage(chatId: number | string, text: string, options?: any) {
  try {
    console.log(`📤 Sending Telegram message to ${chatId}...`);
    const payload: Record<string, any> = {
      chat_id: chatId,
      text: text,
      parse_mode: options?.parse_mode || 'Markdown',
      ...options,
    };
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data: any = await response.json();
    if (!data.ok) {
      console.warn(`⚠️ Telegram API sendMessage warning (Status ${response.status}):`, data);
      // If Telegram failed due to markdown formatting/special chars, retry immediately as plain text
      if (data.description && (data.description.includes("can't parse entities") || data.description.includes('entity') || data.description.includes('format'))) {
        console.log(`🔄 Retrying message to ${chatId} as plain text due to formatting error...`);
        const plainPayload = { ...payload };
        delete plainPayload.parse_mode;
        const retryRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(plainPayload),
        });
        const retryData: any = await retryRes.json();
        console.log(`✅ Plain text retry result:`, retryData.ok ? 'Success' : 'Failed');
        return retryData;
      }
    } else {
      console.log(`✅ Telegram message sent successfully to ${chatId}`);
    }
    return data;
  } catch (sendErr) {
    console.error('❌ Failed to dispatch Telegram message:', sendErr);
    throw sendErr;
  }
}

const processedUpdateIds = new Set<number>();

// MAIN TELEGRAM UPDATE PROCESSOR
export async function handleTelegramUpdate(update: any) {
  if (!update || !update.update_id) return;
  if (processedUpdateIds.has(update.update_id)) {
    console.log(`⏩ Skipping duplicate update_id: ${update.update_id}`);
    return;
  }
  processedUpdateIds.add(update.update_id);
  if (processedUpdateIds.size > 1000) {
    const firstVal = processedUpdateIds.values().next().value;
    if (firstVal !== undefined) processedUpdateIds.delete(firstVal);
  }

  // Handle Callback Queries (Inline button clicks)
  if (update.callback_query) {
    const cq = update.callback_query;
    const data = cq.data;
    const chatId = cq.message?.chat?.id;
    const cqId = cq.id;

    if (cqId) {
      fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: cqId }),
      }).catch(() => {});
    }

    if (!data || !chatId) return;

    if (data === 'sch_menu') {
      await dispatchSendMessage(chatId, scheduleMenuText, { parse_mode: 'Markdown', ...scheduleInlineKeyboard });
    } else {
      const text = getScheduleText(data);
      if (text) {
        await dispatchSendMessage(chatId, text, { parse_mode: 'Markdown', ...scheduleBackKeyboard });
      }
    }
    return;
  }

  // Handle Incoming Text Messages
  const msg = update.message || update.edited_message;
  if (!msg) return;

  const text = msg.text?.trim() || '';
  const telegramId = msg.from?.id;
  const chatId = msg.chat?.id;

  if (!chatId || !telegramId) return;

  const now = Date.now();
  const lastTime = userLastMessageTime.get(telegramId) || 0;
  if (now - lastTime < 400) {
    console.log(`⏩ Debounced rapid duplicate message from ${telegramId}`);
    return;
  }
  userLastMessageTime.set(telegramId, now);

  // Persist all bot users/subscribers for universal broadcasting
  db.collection('bot_subscribers').doc(String(telegramId)).set({
    telegramId: String(telegramId),
    chatId: String(chatId),
    username: msg.from?.username || '',
    firstName: msg.from?.first_name || '',
    lastName: msg.from?.last_name || '',
    lastActiveAt: new Date().toISOString(),
  }, { merge: true }).catch(console.warn);

  const textLower = text.toLowerCase();

  // 1. /START COMMAND & WELCOME MENU
  if (textLower.startsWith('/start') || textLower.startsWith('/help') || textLower === 'መነሻ' || textLower === 'menu') {
    userSessions.delete(telegramId);
    await dispatchSendMessage(
      chatId,
      'እንኳን ወደ ወልደ ዋሕድ ሰንበት ት/ቤት ቦት በደህና መጡ! ✝️\n' +
      'መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን\n' +
      'Welcome to Wold Wahid Sunday School Bot.\n\n' +
      'ከዚህ በታች ካሉት አማራጮች አንዱን ይምረጡ / Please select an option:',
      mainMenuKeyboard
    );
    return;
  }

  // 2. CANCEL COMMAND
  if (text.includes('❌ Cancel') || text.includes('ይቅር') || textLower === '/cancel') {
    userSessions.delete(telegramId);
    await dispatchSendMessage(chatId, 'ኦፕሬሽኑ ተሰርዟል / Operation cancelled.', mainMenuKeyboard);
    return;
  }

  // Helper to check if student exists in active `students` or approved `registrations`
  const checkActiveStudent = async (tgId: number) => {
    // 1. Check by telegramId (number or string) in students collection
    const snap1 = await db.collection('students').where('telegramId', '==', tgId).get();
    if (!snap1.empty) {
      return { exists: true, data: snap1.docs[0].data(), docId: snap1.docs[0].id };
    }
    const snap2 = await db.collection('students').where('telegramId', '==', String(tgId)).get();
    if (!snap2.empty) {
      return { exists: true, data: snap2.docs[0].data(), docId: snap2.docs[0].id };
    }

    // 2. Check registrations collection for approved status or assigned studentCode across all docs
    let regDocs: any[] = [];
    const snapNum = await db.collection('registrations').where('telegramId', '==', tgId).get();
    const snapStr = await db.collection('registrations').where('telegramId', '==', String(tgId)).get();
    const docIds = new Set<string>();
    [...snapNum.docs, ...snapStr.docs].forEach((d) => {
      if (!docIds.has(d.id)) {
        docIds.add(d.id);
        regDocs.push(d);
      }
    });

    if (regDocs.length > 0) {
      const approvedDoc = regDocs.find((d) => {
        const reg = d.data();
        return reg.status === 'approved' || Boolean(reg.studentCode);
      });

      if (approvedDoc) {
        const reg = approvedDoc.data();
        return {
          exists: true,
          data: {
            ...reg,
            code: reg.studentCode || reg.code || 'WW-2026-ACTIVE',
            studentCode: reg.studentCode || reg.code || 'WW-2026-ACTIVE',
          },
          docId: approvedDoc.id,
        };
      }

      for (const d of regDocs) {
        const reg = d.data();
        if (reg.phone) {
          const phoneClean = reg.phone.replace(/\D/g, '').slice(-9);
          if (phoneClean) {
            const allStudents = await db.collection('students').get();
            const found = allStudents.docs.find((sd: any) => (sd.data().phone || '').replace(/\D/g, '').slice(-9) === phoneClean);
            if (found) {
              return { exists: true, data: found.data(), docId: found.id };
            }
          }
        }
      }
    }

    return { exists: false, data: null, docId: null };
  };

  // 3. MY REGISTRATION STATUS (Checked BEFORE registration so "ሁኔታ" is never hijacked)
  const isStatusQuery =
    text.includes('🔍 የምዝገባ ሁኔታ') ||
    text.includes('የምዝገባ ሁኔታ') ||
    text.includes('ሁኔታ') ||
    text.includes('Registration Status') ||
    text.includes('My Registration') ||
    textLower === '/status';

  if (isStatusQuery) {
    userSessions.delete(telegramId);
    try {
      // 1. Check active students collection first
      const activeStudent = await checkActiveStudent(telegramId);
      if (activeStudent.exists && activeStudent.data) {
        const s = activeStudent.data;
        const msgText =
          `📋 *የምዝገባ ሁኔታ / Registration Status*\n` +
          `⛪ መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን\n═══════════════════════\n` +
          `• *ስም (Name):* ${s.fullNameAm || s.fullNameEn}\n` +
          `• *ስልክ (Phone):* ${s.phone || 'N/A'}\n` +
          `• *ክፍል (Dept):* ${s.department || 'N/A'}\n` +
          `• *ሁኔታ (Status):* ✅ ጸድቋል (Approved)\n` +
          `• *የተማሪ መታወቂያ (Student ID):* \`${s.code || s.studentCode || 'WW-2026-ACTIVE'}\`\n\n` +
          `መታወቂያዎንና QR ኮድዎን በቀጥታ በቴሌግራም ለማውረድ "👤 የኔ መታወቂያና QR" ን ይጫኑ።`;
        await dispatchSendMessage(chatId, msgText, mainMenuKeyboard);
        return;
      }

      // 2. Check registrations collection (both numeric and string telegramId, plus username)
      let regDocs: any[] = [];
      const snapNum = await db.collection('registrations').where('telegramId', '==', telegramId).get();
      const snapStr = await db.collection('registrations').where('telegramId', '==', String(telegramId)).get();
      const docIds = new Set<string>();
      [...snapNum.docs, ...snapStr.docs].forEach((d) => {
        if (!docIds.has(d.id)) {
          docIds.add(d.id);
          regDocs.push(d);
        }
      });

      if (msg.from?.username) {
        const snapUser = await db.collection('registrations').where('telegramUsername', '==', msg.from.username).get();
        snapUser.docs.forEach((d) => {
          if (!docIds.has(d.id)) {
            docIds.add(d.id);
            regDocs.push(d);
          }
        });
      }

      if (regDocs.length > 0) {
        // Prioritize approved first
        const approvedDoc = regDocs.find((d) => {
          const r = d.data();
          return r.status === 'approved' || Boolean(r.studentCode);
        });

        if (approvedDoc) {
          const reg = approvedDoc.data();
          const studentCode = reg.studentCode || reg.code || 'WW-2026-ACTIVE';
          const msgText =
            `📋 *የምዝገባ ሁኔታ / Registration Status*\n` +
            `⛪ መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን\n═══════════════════════\n` +
            `• *ስም (Name):* ${reg.fullNameAm || reg.fullNameEn}\n` +
            `• *ስልክ (Phone):* ${reg.phone || 'N/A'}\n` +
            `• *ክፍል (Dept):* ${reg.department || 'N/A'}\n` +
            `• *ሁኔታ (Status):* ✅ ጸድቋል (Approved)\n` +
            `• *የተማሪ መታወቂያ (Student ID):* \`${studentCode}\`\n\n` +
            `መታወቂያዎንና QR ኮድዎን በቀጥታ በቴሌግራም ለማውረድ "👤 የኔ መታወቂያና QR" ን ይጫኑ።`;
          await dispatchSendMessage(chatId, msgText, mainMenuKeyboard);
          return;
        }

        // Check for pending
        const pendingDoc = regDocs.find((d) => d.data().status === 'pending');
        if (pendingDoc) {
          const reg = pendingDoc.data();
          const subDate = reg.submittedAt ? reg.submittedAt.split('T')[0] : 'በቅርቡ';
          const msgText =
            `📋 *የምዝገባ ሁኔታ / Registration Status*\n` +
            `⛪ መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን\n═══════════════════════\n` +
            `• *ስም (Name):* ${reg.fullNameAm || reg.fullNameEn}\n` +
            `• *ስልክ (Phone):* ${reg.phone || 'N/A'}\n` +
            `• *ክፍል (Dept):* ${reg.department || 'N/A'}\n` +
            `• *የተመዘገበበት ቀን:* ${subDate}\n` +
            `• *ሁኔታ (Status):* ⏳ በመጠባበቅ ላይ (Pending Review)\n\n` +
            `ማመልከቻዎ በአስተዳዳሪው እየተገመገመ ነው። ሲጸድቅ የተማሪ መታወቂያዎና QR ኮድዎ በቴሌግራም መልእክት ይደርስዎታል።`;
          await dispatchSendMessage(chatId, msgText, mainMenuKeyboard);
          return;
        }

        // All are rejected
        const lastReg = regDocs[regDocs.length - 1].data();
        const msgText =
          `📋 *የምዝገባ ሁኔታ / Registration Status*\n` +
          `⛪ መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን\n═══════════════════════\n` +
          `• *ስም (Name):* ${lastReg.fullNameAm || lastReg.fullNameEn}\n` +
          `• *ሁኔታ (Status):* ❌ ውድቅ ተደርጓል (Not Accepted)\n\n` +
          `እንደገና ለማመልከት ከታች "📝 የተማሪ ምዝገባ" የሚለውን ይጫኑ ወይም ለበለጠ መረጃ በ "💬 ድጋፍና እርዳታ" ያነጋግሩን።`;
        await dispatchSendMessage(chatId, msgText, mainMenuKeyboard);
        return;
      }

      await dispatchSendMessage(
        chatId,
        '📋 *የምዝገባ ሁኔታ / Registration Status*\n' +
        '⛪ መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን\n═══════════════════════\n' +
        'በዚህ የቴሌግራም አካውንት የተገኘ የተማሪ ምዝገባ የለም።\n\n' +
        '👉 አዲስ ለመመዝገብ ከታች *"📝 የተማሪ ምዝገባ"* የሚለውን ይጫኑ።\n' +
        '👉 አስቀድመው በስልክ ቁጥር ተመዝግበው ከሆነ የስልክ ቁጥርዎን (ምሳሌ፡ `0911223344`) እዚህ ይላኩ።',
        mainMenuKeyboard
      );
    } catch (err) {
      console.error('Error fetching registration status:', err);
      await dispatchSendMessage(chatId, 'መረጃውን ማግኘት አልተቻለም። እባክዎ ቆይተው እንደገና ይሞክሩ።', mainMenuKeyboard);
    }
    return;
  }

  // 4. STUDENT REGISTRATION (Only triggers if NOT a status query)
  const isRegisterCommand =
    !text.includes('ሁኔታ') &&
    (text.includes('📝 የተማሪ ምዝገባ') ||
      text.includes('Register as Student') ||
      text === 'ተማሪ ምዝገባ' ||
      text === 'ምዝገባ' ||
      textLower === '/register');

  if (isRegisterCommand) {
    userSessions.delete(telegramId);

    // Verify active existence in students or approved registrations first
    const activeStudent = await checkActiveStudent(telegramId);
    if (activeStudent.exists && activeStudent.data) {
      await dispatchSendMessage(
        chatId,
        `🎉 ምዝገባዎ አስቀድሞ የጸደቀ ተማሪ ኖት!\nየተማሪ መታወቂያዎ: \`${activeStudent.data.code || activeStudent.data.studentCode || 'Active'}\`\n\nየግል መታወቂያዎንና QR ኮድዎን ለመቀበል "👤 የኔ መታወቂያና QR" የሚለውን ይጫኑ።`,
        mainMenuKeyboard
      );
      return;
    }

    // Check if there is an active pending registration
    let regDocs: any[] = [];
    const snapNum = await db.collection('registrations').where('telegramId', '==', telegramId).get();
    const snapStr = await db.collection('registrations').where('telegramId', '==', String(telegramId)).get();
    const docIds = new Set<string>();
    [...snapNum.docs, ...snapStr.docs].forEach((d) => {
      if (!docIds.has(d.id)) {
        docIds.add(d.id);
        regDocs.push(d);
      }
    });

    const pendingDoc = regDocs.find((d) => d.data().status === 'pending');
    if (pendingDoc) {
      const reg = pendingDoc.data();
      await dispatchSendMessage(
        chatId,
        `⚠️ ማመልከቻዎ አስቀድሞ ተመዝግቧል (Submitted: ${reg.submittedAt?.split('T')[0] || 'በቅርቡ'}).\n` +
        `ማመልከቻዎ በአስተዳዳሪው እየተገመገመ ነው።\n\n` +
        `ሁኔታውን ለማወቅ ከታች "🔍 የምዝገባ ሁኔታ" የሚለውን ይጫኑ።`,
        mainMenuKeyboard
      );
      return;
    }

    // Allow registration
    userSessions.set(telegramId, {
      action: 'register',
      step: 'name',
      data: {}
    });

    await dispatchSendMessage(
      chatId,
      '📝 *የተማሪ ምዝገባ (Step 1/10)*\n*Student Registration*\n\n' +
      'እባክዎ ሙሉ ስምዎን በአማርኛ ወይም በእንግሊዝኛ ያስገቡ:\n' +
      'Please enter your Full Name:\n\n' +
      '(ምሳሌ፡ ዮሐንስ ተስፋዬ ገብሬ / Yohannes Tesfaye Gebre)',
      cancelKeyboard
    );
    return;
  }

  // 5. MY ID CARD & QR CODE
  if (text.includes('👤 የኔ መታወቂያና QR') || text.includes('My QR') || text.includes('የኔ መታወቂያ') || textLower === '/qr' || textLower === '/profile') {
    try {
      const activeStudent = await checkActiveStudent(telegramId);
      let student = activeStudent.exists ? activeStudent.data : null;

      if (!student) {
        await dispatchSendMessage(
          chatId,
          'የተመዘገበ ተማሪ አልተገኘም። እባክዎ በመጀመሪያ "📝 የተማሪ ምዝገባ" የሚለውን በመጫን ይመዝገቡ።\nNo active student profile found. Please register first.',
          mainMenuKeyboard
        );
        return;
      }

      const telegramWebAppUrl = 'https://t.me/attendanceforchurchbot/woldwahidsundayschool';
      const studentCode = student.code || student.studentCode || 'WW-2026-0001';

      const caption = 
        `👤 *የተማሪ ዲጂታል መታወቂያ (Official Student ID)*\n` +
        `⛪ *መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን*\n` +
        `═══════════════════════\n` +
        `🆔 *የተማሪ መታወቂያ:* \`${studentCode}\`\n` +
        `👤 *ስም (Name):* ${student.fullNameAm || student.fullNameEn}\n` +
        `📞 *ስልክ (Phone):* ${student.phone || 'N/A'}\n` +
        `⛪ *ክፍል (Dept):* ${student.department || 'N/A'}\n` +
        `🎓 *ደረጃ (Grade):* ${student.gradeLevel || 'N/A'}\n` +
        `🟢 *ሁኔታ (Status):* Active\n` +
        `═══════════════════════\n\n` +
        `📲 *ይህ የእርስዎ የግል መታወቂያ QR ኮድ ነው!*\n` +
        `በሰንበት ት/ቤት የመገኘት መመዝገቢያ ሰዓት ይህንን QR ኮድ ለአስተዳዳሪው ያሳዩ።`;

      const keyboard = {
        inline_keyboard: [
          [{ text: '🚀 ሙሉ ዲጂታል ካርድ በዌብ አፕ ክፈት', url: telegramWebAppUrl }]
        ]
      };

      try {
        const qrBuffer = await QRCode.toBuffer(studentCode, {
          width: 500,
          margin: 2,
          color: { dark: '#062414', light: '#ffffff' },
        });

        const formData = new FormData();
        formData.append('chat_id', String(telegramId));
        formData.append('photo', new Blob([new Uint8Array(qrBuffer)], { type: 'image/png' }), `${studentCode}_qr.png`);
        formData.append('caption', caption);
        formData.append('parse_mode', 'Markdown');
        formData.append('reply_markup', JSON.stringify(keyboard));

        const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
          method: 'POST',
          body: formData,
        });

        const jsonRes = (await res.json()) as any;
        if (!jsonRes.ok) {
          await dispatchSendMessage(chatId, caption, { parse_mode: 'Markdown', reply_markup: keyboard });
        }
      } catch (qrErr) {
        await dispatchSendMessage(chatId, caption, { parse_mode: 'Markdown', reply_markup: keyboard });
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      await dispatchSendMessage(chatId, 'መታወቂያዎን ማውጣት አልተቻለም። እባክዎ ቆይተው እንደገና ይሞክሩ።', mainMenuKeyboard);
    }
    return;
  }

  // 6. MY ATTENDANCE HISTORY (Multi-field match guarantees finding logged records)
  if (text.includes('📊 የመገኘት ታሪክ') || text.includes('My Attendance') || textLower === '/attendance') {
    try {
      const telegramWebAppUrl = 'https://t.me/attendanceforchurchbot/woldwahidsundayschool';

      // 1. Get student details from students and registrations
      const activeStudent = await checkActiveStudent(telegramId);
      let studentCode = (activeStudent.exists && activeStudent.data) ? (activeStudent.data.code || activeStudent.data.studentCode || '') : '';
      let studentPhone = (activeStudent.exists && activeStudent.data) ? (activeStudent.data.phone || '') : '';
      let studentName = (activeStudent.exists && activeStudent.data) ? (activeStudent.data.fullNameAm || activeStudent.data.fullNameEn || '') : '';

      if (!studentCode) {
        const regSnap = await db.collection('registrations').where('telegramId', '==', telegramId).get();
        if (!regSnap.empty) {
          const rData = regSnap.docs[0].data();
          studentCode = rData.studentCode || '';
          studentPhone = rData.phone || '';
          studentName = rData.fullNameAm || rData.fullNameEn || '';
        }
      }

      // 2. Fetch all attendance logs and filter comprehensively
      const attSnap = await db.collection('attendance').get();
      const cleanTgId = String(telegramId);

      const records = attSnap.docs
        .map((d: any) => ({ id: d.id, ...d.data() }))
        .filter((a: any) => {
          const aTgId = String(a.telegramId || a.tgId || '');
          const aCode = String(a.memberCode || a.studentCode || a.studentId || a.code || '').trim().toLowerCase();
          const targetCode = String(studentCode).trim().toLowerCase();
          const aPhone = String(a.phone || a.phoneNumber || '').replace(/\D/g, '');
          const targetPhone = String(studentPhone).replace(/\D/g, '');

          // Check matches across Telegram ID, Student ID, Phone, or Name
          const matchTg = cleanTgId && aTgId === cleanTgId;
          const matchCode = targetCode && aCode && (aCode === targetCode || aCode.includes(targetCode));
          const matchPhone = targetPhone && aPhone && aPhone.endsWith(targetPhone.slice(-9));
          const matchName = studentName && (a.memberNameAm === studentName || a.memberNameEn === studentName);

          return matchTg || matchCode || matchPhone || matchName;
        })
        .sort((a: any, b: any) => new Date(b.date || b.timestamp || 0).getTime() - new Date(a.date || a.timestamp || 0).getTime());

      if (records.length === 0) {
        const emptyMsg = 
          `📊 *የመገኘት መረጃ / Attendance Records*\n` +
          `👤 *ተማሪ:* ${studentName || msg.from?.first_name || 'ተማሪ'} ${studentCode ? `(\`${studentCode}\`)` : ''}\n` +
          `═══════════════════════\n\n` +
          `በአሁኑ ሰዓት በእርስዎ ስም የተመዘገበ የመገኘት ታሪክ አልተገኘም።\n` +
          `No attendance records logged yet.\n\n` +
          (studentCode ? `🆔 የእርስዎ መታወቂያ: \`${studentCode}\`\n\n` : `💡 ማሳሰቢያ፡ መታወቂያዎን ለማረጋገጥ በመጀመሪያ "📝 የተማሪ ምዝገባ" ን ይጫኑ።\n\n`) +
          `የተሟላ መረጃዎን በቴሌግራም ዌብ አፕ ለማየት ከታች ያለውን ቁልፍ ይጠቀሙ።`;

        await dispatchSendMessage(chatId, emptyMsg, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🚀 ቴሌግራም ዌብ አፕ ክፈት (Open Web App)', url: telegramWebAppUrl }]
            ]
          }
        });
        return;
      }

      const total = records.length;
      const presentCount = records.filter((r: any) => r.status !== 'absent').length;
      const absentCount = records.filter((r: any) => r.status === 'absent').length;
      const excusedCount = records.filter((r: any) => r.status === 'excused').length;
      const rate = Math.round((presentCount / total) * 100);

      const filled = Math.min(10, Math.max(0, Math.round(rate / 10)));
      const progressBar = '🟩'.repeat(filled) + '⬜'.repeat(10 - filled);
      const recentSessions = records.slice(0, 5);

      let report = 
        `📊 *የመገኘት መረጃና ክትትል (Attendance Overview)*\n` +
        `👤 *ተማሪ:* ${studentName || msg.from?.first_name || 'ተማሪ'} ${studentCode ? `(\`${studentCode}\`)` : ''}\n` +
        `═══════════════════════\n` +
        `📈 *የተገኝነት ምጣኔ (Attendance Rate):* *${rate}%*\n` +
        `${progressBar}\n\n` +
        `📋 *አጠቃላይ ማጠቃለያ (Summary):*\n` +
        `  • 🟢 የተገኙበት (Present): *${presentCount}*\n` +
        `  • 🔴 የቀሩበት (Absent): *${absentCount}*\n` +
        `  • 🟡 በፈቃድ (Excused): *${excusedCount}*\n` +
        `  • 📌 ጠቅላላ ክፍለ-ጊዜያት: *${total}*\n\n` +
        `🗓️ *የቅርብ ቀናት ዝርዝር ሁኔታ (Recent Sessions):*\n` +
        `────────────────────────\n`;

      recentSessions.forEach((rec: any, idx: number) => {
        const ethDate = formatEthiopianDate(rec.date || rec.timestamp);
        const gregDate = rec.date ? rec.date.split('T')[0] : 'N/A';
        const isAbsent = rec.status === 'absent';
        const isExcused = rec.status === 'excused';
        const statusIcon = isAbsent ? '🔴' : isExcused ? '🟡' : '🟢';
        const statusText = isAbsent ? 'አልተገኘም (Absent)' : isExcused ? 'በፈቃድ (Excused)' : 'ተገኝቷል (Present)';
        const sessionName = rec.sessionName || 'የሰንበት ት/ቤት ክፍለ-ጊዜ';
        const time = rec.timestamp || 'N/A';

        report += 
          `${idx + 1}. 📅 *${ethDate}* (${gregDate})\n` +
          `   ${statusIcon} *ሁኔታ:* ${statusText}\n` +
          `   ⏰ *ሰዓት:* ${time} | 📖 ${sessionName}\n\n`;
      });

      report += 
        `────────────────────────\n` +
        `💡 *የሁሉንም ቀናት ሙሉ ታሪክ* በቴሌግራም ዌብ አፕ ላይ በዝርዝር ማየት ይችላሉ፦`;

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚀 ሙሉ ታሪክ በዌብ አፕ ይመልከቱ (View Full History)', url: telegramWebAppUrl }]
          ]
        }
      };

      await dispatchSendMessage(chatId, report, { parse_mode: 'Markdown', ...keyboard });
    } catch (err) {
      console.error('Error fetching exact attendance:', err);
      await dispatchSendMessage(chatId, 'የመገኘት መረጃን ማውጣት አልተቻለም።', mainMenuKeyboard);
    }
    return;
  }

  // 7. CLASS SCHEDULE
  if (text.includes('📅 የትምህርት መርሐ ግብር') || text.includes('Class Schedule') || text.includes('መርሐ ግብር') || textLower === '/schedule') {
    await dispatchSendMessage(chatId, scheduleMenuText, { parse_mode: 'Markdown', ...scheduleInlineKeyboard });
    return;
  }

  // Schedule Sub-categories
  if (text.includes('ቅድመ አንደኛ') || textLower.includes('pre-kg')) {
    await dispatchSendMessage(chatId, getScheduleText('sch_pre_kg'), { parse_mode: 'Markdown', ...scheduleBackKeyboard });
    return;
  }
  if (text.includes('1ኛ እና 2ኛ')) {
    await dispatchSendMessage(chatId, getScheduleText('sch_g1_2'), { parse_mode: 'Markdown', ...scheduleBackKeyboard });
    return;
  }
  if (text.includes('3ኛ–5ኛ') || text.includes('3ኛ-5ኛ')) {
    await dispatchSendMessage(chatId, getScheduleText('sch_g3_5'), { parse_mode: 'Markdown', ...scheduleBackKeyboard });
    return;
  }
  if (text.includes('6ኛ–9ኛ') || text.includes('6ኛ-9ኛ')) {
    await dispatchSendMessage(chatId, getScheduleText('sch_g6_9'), { parse_mode: 'Markdown', ...scheduleBackKeyboard });
    return;
  }
  if (text.includes('አርብ') || textLower.includes('friday')) {
    await dispatchSendMessage(chatId, getScheduleText('sch_friday'), { parse_mode: 'Markdown', ...scheduleBackKeyboard });
    return;
  }
  if (text.includes('ቅዳሜ') || textLower.includes('saturday')) {
    await dispatchSendMessage(chatId, getScheduleText('sch_saturday'), { parse_mode: 'Markdown', ...scheduleBackKeyboard });
    return;
  }
  if (text.includes('እሁድ') || textLower.includes('sunday')) {
    await dispatchSendMessage(chatId, getScheduleText('sch_sunday'), { parse_mode: 'Markdown', ...scheduleBackKeyboard });
    return;
  }

  // 8. MOBILE APP & PWA
  if (text.includes('📱 የሞባይል መተግበሪያ') || text.includes('Wold Wahid App') || text.includes('መተግበሪያ') || textLower === '/app' || textLower === '/mobile') {
    const apkUrl = 'https://wold-wahid-sunday-school.onrender.com/download/wold-wahid.apk';
    const msgText = 
      `📱 *የወልድ ዋሕድ ሰንበት ት/ቤት መተግበሪያ*\n` +
      `⛪ *መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን*\n` +
      `═══════════════════════════════\n\n` +
      `የሰንበት ትምህርት ቤቱን ኦፊሴላዊ የአንድሮይድ (Android) መተግበሪያ ከታች ያለውን ቁልፍ ተጠቅመው ያውርዱ።\n\n` +
      `⚠️ *ጠቃሚ ማሳሰቢያ ለጭነት (Play Protect):*\n` +
      `መተግበሪያውን ሲጭኑ "Blocked by Play Protect" ወይም "App blocked" የሚል መልእክት ካሳየዎት፦\n` +
      `1. *"More details"* (ተጨማሪ ዝርዝሮች) የሚለውን ይጫኑ\n` +
      `2. *"Install anyway"* (ለማንኛውም ጫን) የሚለውን ይምረጡ\n\n` +
      `ይህ የሚሆነው መተግበሪያው ገና በፕሌይ ስቶር ላይ ስላልተመዘገበ እንጂ ለስልክዎ አስተማማኝ ነው።`;

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📥 መተግበሪያውን አውርድ (Download APK)', url: apkUrl }],
          [{ text: '🚀 ዌብ አፕ ክፈት (Open Web App)', url: 'https://t.me/attendanceforchurchbot/woldwahidsundayschool' }]
        ],
      },
    };

    await dispatchSendMessage(chatId, msgText, { parse_mode: 'Markdown', ...keyboard });
    return;
  }

  // 9. LEAVE REQUEST
  if (text.includes('✉️ የፈቃድ መጠየቂያ') || text.includes('Leave Request') || textLower === '/leave') {
    userSessions.set(telegramId, {
      action: 'leave',
      step: 'type',
      data: {}
    });

    const leaveTypesKeyboard = {
      reply_markup: {
        keyboard: [
          [{ text: '🏥 Medical (የጤና)' }, { text: '✈️ Travel (የጉዞ)' }],
          [{ text: '📚 Academic (የትምህርት ፈተና)' }, { text: '👨‍👩‍👧 Family (የቤተሰብ)' }],
          [{ text: '❓ Other (ሌላ)' }],
          [{ text: '❌ Cancel (ይቅር)' }]
        ],
        resize_keyboard: true,
      }
    };

    await dispatchSendMessage(
      chatId,
      '✉️ *የፈቃድ መጠየቂያ (Leave Request)*\n\nእባክዎ የፈቃድ አይነት ይምረጡ / Please select the reason for leave:',
      leaveTypesKeyboard
    );
    return;
  }

  // 10. SUPPORT & HELP
  if (text.includes('💬 ድጋፍና እርዳታ') || text.includes('Support & Help') || textLower === '/support') {
    userSessions.set(telegramId, {
      action: 'support',
      step: 'category',
      data: {}
    });

    const supportKeyboard = {
      reply_markup: {
        keyboard: [
          [{ text: '🙏 Prayer Request (የጸሎት ጥያቄ)' }, { text: '🏠 Visitation (የቤት ጥየቃ)' }],
          [{ text: '🤝 Welfare / Aid (የድጋፍ እርዳታ)' }, { text: '🗣 Counseling (ምክር)' }],
          [{ text: '❓ General Inquiry (አጠቃላይ ጥያቄ)' }],
          [{ text: '❌ Cancel (ይቅር)' }]
        ],
        resize_keyboard: true,
      }
    };

    await dispatchSendMessage(
      chatId,
      '💬 *የድጋፍ እና እርዳታ መስጫ (Support Desk)*\n\nእባክዎ የሚፈልጉትን የድጋፍ ዘርፍ ይምረጡ / Please select the category:',
      supportKeyboard
    );
    return;
  }

  // Phone number lookup (if user sends their 10-digit phone number while not in an active wizard)
  const cleanPhoneInput = text.replace(/[\s\-\(\)\+]/g, '');
  const is10DigitPhone =
    (cleanPhoneInput.startsWith('09') || cleanPhoneInput.startsWith('07')) &&
    cleanPhoneInput.length === 10;

  if (!userSessions.has(telegramId) && is10DigitPhone) {
    try {
      // 1. Check in students collection
      const allStudents = await db.collection('students').get();
      const matchedStudent = allStudents.docs.find((d: any) => {
        const p = (d.data().phone || '').replace(/\D/g, '');
        return p === cleanPhoneInput || p.endsWith(cleanPhoneInput.slice(-9));
      });

      if (matchedStudent) {
        const s = matchedStudent.data();
        if (!s.telegramId) {
          await db.collection('students').doc(matchedStudent.id).update({
            telegramId: telegramId,
            telegramUsername: msg.from?.username || '',
          }).catch(() => {});
        }

        const msgText =
          `📋 *የተማሪ መረጃ ተገኝቷል / Student Found*\n` +
          `⛪ መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን\n═══════════════════════\n` +
          `• *ስም (Name):* ${s.fullNameAm || s.fullNameEn}\n` +
          `• *ስልክ (Phone):* ${s.phone}\n` +
          `• *ክፍል (Dept):* ${s.department || 'N/A'}\n` +
          `• *ሁኔታ (Status):* ✅ ጸድቋል (Approved)\n` +
          `• *የተማሪ መታወቂያ:* \`${s.code || s.studentCode || 'WW-2026-ACTIVE'}\`\n\n` +
          `መታወቂያዎንና QR ኮድዎን በቀጥታ በቴሌግራም ለማውረድ "👤 የኔ መታወቂያና QR" ን ይጫኑ።`;
        await dispatchSendMessage(chatId, msgText, mainMenuKeyboard);
        return;
      }

      // 2. Check in registrations collection
      const allRegs = await db.collection('registrations').get();
      const matchedReg = allRegs.docs.find((d: any) => {
        const p = (d.data().phone || '').replace(/\D/g, '');
        return p === cleanPhoneInput || p.endsWith(cleanPhoneInput.slice(-9));
      });

      if (matchedReg) {
        const reg = matchedReg.data();
        if (!reg.telegramId) {
          await db.collection('registrations').doc(matchedReg.id).update({
            telegramId: telegramId,
            telegramUsername: msg.from?.username || '',
          }).catch(() => {});
        }

        if (reg.status === 'approved' || reg.studentCode) {
          const msgText =
            `📋 *የምዝገባ ሁኔታ / Registration Status*\n` +
            `⛪ መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን\n═══════════════════════\n` +
            `• *ስም (Name):* ${reg.fullNameAm || reg.fullNameEn}\n` +
            `• *ስልክ (Phone):* ${reg.phone}\n` +
            `• *ሁኔታ (Status):* ✅ ጸድቋል (Approved)\n` +
            `• *የተማሪ መታወቂያ:* \`${reg.studentCode || reg.code || 'WW-2026-ACTIVE'}\`\n\n` +
            `መታወቂያዎንና QR ኮድዎን በቀጥታ በቴሌግራም ለማውረድ "👤 የኔ መታወቂያና QR" ን ይጫኑ።`;
          await dispatchSendMessage(chatId, msgText, mainMenuKeyboard);
          return;
        } else if (reg.status === 'pending') {
          const msgText =
            `📋 *የምዝገባ ሁኔታ / Registration Status*\n` +
            `⛪ መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን\n═══════════════════════\n` +
            `• *ስም (Name):* ${reg.fullNameAm || reg.fullNameEn}\n` +
            `• *ስልክ (Phone):* ${reg.phone}\n` +
            `• *ክፍል (Dept):* ${reg.department || 'N/A'}\n` +
            `• *ሁኔታ (Status):* ⏳ በመጠባበቅ ላይ (Pending Review)\n\n` +
            `ማመልከቻዎ በአስተዳዳሪው እየተገመገመ ነው። ሲጸድቅ በቴሌግራም መልእክት ይደርስዎታል።`;
          await dispatchSendMessage(chatId, msgText, mainMenuKeyboard);
          return;
        }
      }
    } catch (err) {
      console.warn('Phone lookup notice:', err);
    }
  }

  // 11. MULTI-STEP CONVERSATIONAL WIZARDS WITH RIGID INPUT VALIDATION
  const session = userSessions.get(telegramId);
  if (session) {
    // Check if user clicked cancel or quit
    if (text.includes('❌ Cancel') || text.includes('ይቅር') || textLower === '/cancel') {
      userSessions.delete(telegramId);
      await dispatchSendMessage(chatId, 'ኦፕሬሽኑ ተሰርዟል / Operation cancelled.', mainMenuKeyboard);
      return;
    }

    // Universal check: if user clicked any main menu button or command during a wizard, escape and handle new command immediately!
    const isMenuCommand =
      text === '📝 የተማሪ ምዝገባ' ||
      text === '🔍 የምዝገባ ሁኔታ' ||
      text === '👤 የኔ መታወቂያና QR' ||
      text === '📊 የመገኘት ታሪክ' ||
      text === '📅 የትምህርት መርሐ ግብር' ||
      text === '✉️ የፈቃድ መጠየቂያ' ||
      text === '📱 የሞባይል መተግበሪያ' ||
      text === '💬 ድጋፍና እርዳታ' ||
      text.toLowerCase() === '/start' ||
      text.toLowerCase() === '/menu' ||
      text.toLowerCase() === '/register' ||
      text.toLowerCase() === '/status' ||
      text.toLowerCase() === '/qr' ||
      text.toLowerCase() === '/attendance' ||
      text.toLowerCase() === '/schedule' ||
      text.toLowerCase() === '/leave' ||
      text.toLowerCase() === '/support' ||
      text.toLowerCase() === '/app' ||
      text.startsWith('/');

    if (isMenuCommand) {
      userSessions.delete(telegramId);
      await handleTelegramUpdate(update);
      return;
    }

    // REGISTRATION WIZARD STEPS
    if (session.action === 'register') {
      if (session.step === 'name') {
        const trimmed = text.trim();
        const parts = trimmed.split(/\s+/);
        const lowerName = trimmed.toLowerCase();
        const isDummy = 
          lowerName.includes('test') || 
          lowerName.includes('demo') || 
          lowerName.includes('asdf') || 
          lowerName.includes('fake') || 
          lowerName.includes('dummy') || 
          lowerName.includes('ቴስት') || 
          lowerName.includes('ደሞ') ||
          lowerName.includes('ፈተና');

        if (!trimmed || parts.length < 2 || trimmed.length < 4 || isDummy || trimmed.startsWith('/') || trimmed.includes('ምዝገባ')) {
          await dispatchSendMessage(
            chatId,
            '⚠️ *ትክክለኛ ያልሆነ ስም!*\n"test"፣ "demo" ወይም የውሸት ስም መጠቀም በጥብቅ የተከለከለ ነው። እባክዎ ትክክለኛ የራስዎን ሙሉ ስም ያስገቡ (ምሳሌ፡ ዳንኤል ታደሰ ወልደማርያም):',
            cancelKeyboard
          );
          return;
        }
        session.data.name = trimmed;
        session.step = 'christianName';
        await dispatchSendMessage(
          chatId,
          '✝️ *የክርስትና ስም ያስገቡ (Step 2/10):*\nPlease enter your Christian Name:\n(ምሳሌ፡ ወልደ ማርያም)',
          cancelKeyboard
        );
      } else if (session.step === 'christianName') {
        const trimmed = text.trim();
        if (!trimmed || trimmed.length < 2 || trimmed.startsWith('/')) {
          await dispatchSendMessage(chatId, '⚠️ *ትክክለኛ ያልሆነ የክርስትና ስም!*\nእባክዎ ትክክለኛ የክርስትና ስም ያስገቡ:', cancelKeyboard);
          return;
        }
        session.data.christianName = trimmed;
        session.step = 'gender';
        const genderKeyboard = {
          reply_markup: {
            keyboard: [
              [{ text: 'ወንድ (Male)' }, { text: 'ሴት (Female)' }],
              [{ text: '❌ Cancel (ይቅር)' }]
            ],
            resize_keyboard: true,
          }
        };
        await dispatchSendMessage(
          chatId,
          '👤 *ጾታ ይምረጡ (Step 3/10):*\nPlease select your Gender using the buttons below:',
          genderKeyboard
        );
      } else if (session.step === 'gender') {
        if (!text.includes('ወንድ') && !text.includes('ሴት') && !text.toLowerCase().includes('male') && !text.toLowerCase().includes('female')) {
          const genderKeyboard = {
            reply_markup: {
              keyboard: [
                [{ text: 'ወንድ (Male)' }, { text: 'ሴት (Female)' }],
                [{ text: '❌ Cancel (ይቅር)' }]
              ],
              resize_keyboard: true,
            }
          };
          await dispatchSendMessage(chatId, '⚠️ እባክዎ ከታሉት የጾታ አዝራሮች አንዱን ይምረጡ:', genderKeyboard);
          return;
        }
        session.data.gender = text.includes('ወንድ') || text.toLowerCase().includes('male') ? 'male' : 'female';
        session.step = 'birthDate';

        const birthYearKeyboard = {
          reply_markup: {
            keyboard: [
              [{ text: '2010 (ዕድሜ 16)' }, { text: '2011 (ዕድሜ 15)' }, { text: '2012 (ዕድሜ 14)' }],
              [{ text: '2007 (ዕድሜ 19)' }, { text: '2008 (ዕድሜ 18)' }, { text: '2009 (ዕድሜ 17)' }],
              [{ text: '2004 (ዕድሜ 22)' }, { text: '2005 (ዕድሜ 21)' }, { text: '2006 (ዕድሜ 20)' }],
              [{ text: 'ከ2004 በፊት (Adult / 23+)' }],
              [{ text: '❌ Cancel (ይቅር)' }]
            ],
            resize_keyboard: true,
          }
        };

        await dispatchSendMessage(
          chatId,
          '📅 *የትውልድ ዘመን (ዓ.ም) ይምረጡ (Step 4/10):*\nSelect your Birth Year using the buttons below:',
          birthYearKeyboard
        );
      } else if (session.step === 'birthDate') {
        if (!text || text.length < 2 || text.startsWith('/')) {
          const birthYearKeyboard = {
            reply_markup: {
              keyboard: [
                [{ text: '2010 (ዕድሜ 16)' }, { text: '2011 (ዕድሜ 15)' }, { text: '2012 (ዕድሜ 14)' }],
                [{ text: '2007 (ዕድሜ 19)' }, { text: '2008 (ዕድሜ 18)' }, { text: '2009 (ዕድሜ 17)' }],
                [{ text: '2004 (ዕድሜ 22)' }, { text: '2005 (ዕድሜ 21)' }, { text: '2006 (ዕድሜ 20)' }],
                [{ text: 'ከ2004 በፊት (Adult / 23+)' }],
                [{ text: '❌ Cancel (ይቅር)' }]
              ],
              resize_keyboard: true,
            }
          };
          await dispatchSendMessage(chatId, '⚠️ እባክዎ ከታሉት የትውልድ ዘመን አዝራሮች ይምረጡ:', birthYearKeyboard);
          return;
        }
        session.data.birthDate = text;
        session.step = 'phone';
        await dispatchSendMessage(
          chatId,
          '📱 *ስልክ ቁጥርዎን ያስገቡ (Step 5/10):*\nPlease enter your Phone Number:\n(ምሳሌ፡ 0911234567 ወይም 0712345678 - 10 አሃዝ ብቻ)',
          cancelKeyboard
        );
      } else if (session.step === 'phone') {
        let cleanPhone = text.replace(/[\s\-\(\)\+]/g, '');
        if (cleanPhone.startsWith('251')) {
          cleanPhone = '0' + cleanPhone.slice(3);
        }
        if (cleanPhone.length !== 10 || (!cleanPhone.startsWith('09') && !cleanPhone.startsWith('07'))) {
          await dispatchSendMessage(
            chatId,
            '⚠️ *ትክክለኛ ያልሆነ ስልክ ቁጥር!*\nስልክ ቁጥር በትክክል 10 አሃዝ መሆን አለበት እና በ 09 ወይም 07 መጀመር አለበት (ምሳሌ፡ 0911234567 ወይም 0712345678):',
            cancelKeyboard
          );
          return;
        }
        session.data.phone = cleanPhone;
        session.step = 'address';
        await dispatchSendMessage(
          chatId,
          '📍 *የመኖሪያ አድራሻ (ወረዳ / ሰፈር) ያስገቡ (Step 6/10):*\nPlease enter your Address (Woreda / Subcity):\n(ምሳሌ፡ ቦሌ ወረዳ 03)',
          cancelKeyboard
        );
      } else if (session.step === 'address') {
        const trimmed = text.trim();
        if (!trimmed || trimmed.length < 2) {
          await dispatchSendMessage(chatId, '⚠️ እባክዎ ትክክለኛ የመኖሪያ አድራሻ ያስገቡ:', cancelKeyboard);
          return;
        }
        session.data.address = trimmed;
        session.step = 'emergencyName';
        await dispatchSendMessage(
          chatId,
          '🛡️ *የቅርብ ተጠሪ ስም ያስገቡ (Step 7/10):*\nPlease enter Emergency Contact Name:',
          cancelKeyboard
        );
      } else if (session.step === 'emergencyName') {
        const trimmed = text.trim();
        if (!trimmed || trimmed.length < 2) {
          await dispatchSendMessage(chatId, '⚠️ እባክዎ የቅርብ ተጠሪ ስም ያስገቡ:', cancelKeyboard);
          return;
        }
        session.data.emergencyName = trimmed;
        session.step = 'emergencyPhone';
        await dispatchSendMessage(
          chatId,
          '📞 *የቅርብ ተጠሪ ስልክ ቁጥር ያስገቡ (Step 8/10):*\nPlease enter Emergency Contact Phone:\n(ምሳሌ፡ 0911223344 - 10 አሃዝ ብቻ)',
          cancelKeyboard
        );
      } else if (session.step === 'emergencyPhone') {
        let cleanPhone = text.replace(/[\s\-\(\)\+]/g, '');
        if (cleanPhone.startsWith('251')) {
          cleanPhone = '0' + cleanPhone.slice(3);
        }
        if (cleanPhone.length !== 10 || (!cleanPhone.startsWith('09') && !cleanPhone.startsWith('07'))) {
          await dispatchSendMessage(
            chatId,
            '⚠️ *ትክክለኛ ያልሆነ የተጠሪ ስልክ ቁጥር!*\nየተጠሪ ስልክ ቁጥር በትክክል 10 አሃዝ መሆን አለበት እና በ 09 ወይም 07 መጀመር አለበት (ምሳሌ፡ 0911223344 ወይም 0711223344):',
            cancelKeyboard
          );
          return;
        }
        session.data.emergencyPhone = cleanPhone;
        session.step = 'department';
        const deptKeyboard = {
          reply_markup: {
            keyboard: [
              [{ text: 'ትምህርት ክፍል (Education)' }, { text: 'መዝሙር ክፍል (Choir)' }],
              [{ text: 'ኪነ-ጥበብ ክፍል (Arts)' }, { text: 'አብነት ክፍል (Abnet)' }],
              [{ text: 'ስነ-ስርዓት ክፍል (Discipline)' }, { text: 'አጠቃላይ አባል (General)' }],
              [{ text: '❌ Cancel (ይቅር)' }]
            ],
            resize_keyboard: true,
          }
        };
        await dispatchSendMessage(
          chatId,
          '⛪ *የሰንበት ት/ቤት ክፍል ይምረጡ (Step 9/10):*\nSelect your Sunday School Department using the buttons below:',
          deptKeyboard
        );
      } else if (session.step === 'department') {
        if (!text.includes('ክፍል') && !text.includes('አባል') && !text.includes('Education') && !text.includes('Choir') && !text.includes('Arts') && !text.includes('Abnet') && !text.includes('Discipline') && !text.includes('General')) {
          const deptKeyboard = {
            reply_markup: {
              keyboard: [
                [{ text: 'ትምህርት ክፍል (Education)' }, { text: 'መዝሙር ክፍል (Choir)' }],
                [{ text: 'ኪነ-ጥበብ ክፍል (Arts)' }, { text: 'አብነት ክፍል (Abnet)' }],
                [{ text: 'ስነ-ስርዓት ክፍል (Discipline)' }, { text: 'አጠቃላይ አባል (General)' }],
                [{ text: '❌ Cancel (ይቅር)' }]
              ],
              resize_keyboard: true,
            }
          };
          await dispatchSendMessage(chatId, '⚠️ እባክዎ ከታሉት የክፍል አዝራሮች አንዱን ይምረጡ:', deptKeyboard);
          return;
        }
        session.data.department = text;
        session.step = 'photo';
        await dispatchSendMessage(
          chatId,
          '📸 *የመገለጫ ፎቶ ሊንክ ወይም ፎቶ ይላኩ (Step 10/10):*\nPlease send your profile photo or photo link:\n(ወይንም "None" ብለው መጻፍ ይችላሉ)',
          cancelKeyboard
        );
      } else if (session.step === 'photo') {
        let photoVal = text;
        if (msg.photo && msg.photo.length > 0) {
          const largestPhoto = msg.photo[msg.photo.length - 1];
          photoVal = `tg_file:${largestPhoto.file_id}`;
        } else if (msg.document && msg.document.mime_type?.startsWith('image/')) {
          photoVal = `tg_file:${msg.document.file_id}`;
        }
        session.data.photo = photoVal && photoVal !== 'None' ? photoVal : '';

        try {
          await db.collection('registrations').add({
            fullNameAm: session.data.name,
            fullNameEn: session.data.name,
            christianName: session.data.christianName,
            gender: session.data.gender,
            birthDate: session.data.birthDate,
            phone: session.data.phone,
            address: session.data.address,
            emergencyContact: {
              name: session.data.emergencyName,
              phone: session.data.emergencyPhone,
              relation: 'ቤተሰብ / Family'
            },
            department: session.data.department,
            photoUrl: session.data.photo.startsWith('tg_file:') 
              ? `/api/telegram/file/${session.data.photo.replace('tg_file:', '')}` 
              : session.data.photo,
            status: 'pending',
            telegramId: telegramId,
            telegramUsername: msg.from?.username || '',
            submittedAt: new Date().toISOString()
          });

          userSessions.delete(telegramId);

          const successMsg = 
            `🎉 *የተማሪ ምዝገባ ማመልከቻዎ በተስኬት ተላክቷል!*\n` +
            `*Registration Application Submitted Successfully!*\n\n` +
            `👤 *ስም:* ${session.data.name}\n` +
            `✝️ *የክርስትና ስም:* ${session.data.christianName}\n` +
            `📱 *ስልክ:* ${session.data.phone}\n` +
            `⛪ *ክፍል:* ${session.data.department}\n` +
            `⏳ *ሁኔታ:* በመጠባበቅ ላይ (Pending Review)\n\n` +
            `አስተዳዳሪው ሲያፀድቅ የተማሪ መታወቂያዎ ይደርስዎታል።`;

          await dispatchSendMessage(chatId, successMsg, { parse_mode: 'Markdown', ...mainMenuKeyboard });
        } catch (saveErr) {
          console.error('Failed to save registration:', saveErr);
          await dispatchSendMessage(chatId, 'ምዝገባውን ማስቀመጥ አልተቻለም። እባክዎ እንደገና ይሞክሩ።', mainMenuKeyboard);
        }
      }
      return;
    }

    // SUPPORT TICKET WIZARD STEPS
    if (session.action === 'support') {
      if (session.step === 'category') {
        session.data.category = text;
        session.step = 'reason';
        await dispatchSendMessage(
          chatId,
          '📌 *የጥያቄውን ወይም የጉዳዩን ርዕስ/ምክንያት ያስገቡ:*\nPlease enter the reason or subject of your request:\n(ምሳሌ፡ የትምህርት ስኬት እንዲጸልዩልኝ / የቁሳቁስ ድጋፍ)',
          cancelKeyboard
        );
      } else if (session.step === 'reason') {
        session.data.reason = text;
        session.step = 'description';
        await dispatchSendMessage(
          chatId,
          '📝 *የጥያቄዎን ወይም የድጋፍ ፍላጎትዎን ዝርዝር በሰፊው ይጻፉ:*\nPlease describe your request or message in detail:',
          cancelKeyboard
        );
      } else if (session.step === 'description') {
        session.data.description = text;
        const ticketNumber = `TKT-${Math.floor(1000 + Math.random() * 9000)}`;

        try {
          await db.collection('support_tickets').add({
            ticketNumber,
            category: session.data.category,
            reason: session.data.reason,
            title: session.data.reason,
            description: session.data.description,
            requesterName: msg.from?.first_name || 'Sunday School Member',
            telegramId: telegramId,
            telegramUsername: msg.from?.username || '',
            status: 'new',
            priority: 'medium',
            createdAt: new Date().toISOString()
          });

          userSessions.delete(telegramId);

          await dispatchSendMessage(
            chatId,
            `✅ *የድጋፍ ጥያቄዎ ተመዝግቧል!*\n` +
            `*Support Ticket Created!*\n\n` +
            `🎫 *Ticket #:* \`${ticketNumber}\`\n` +
            `📌 *ዘርፍ:* ${session.data.category}\n` +
            `📋 *ምክንያት/ጉዳይ:* ${session.data.reason}\n` +
            `⏳ *ሁኔታ:* አዲስ (New)\n\n` +
            `የቤተ-ክርስቲያኑ አስተዳደር ጥያቄዎን ተመልክቶ ምላሽ ይሰጥዎታል።`,
            { parse_mode: 'Markdown', ...mainMenuKeyboard }
          );
        } catch (err) {
          console.error('Failed to create ticket:', err);
          await dispatchSendMessage(chatId, 'ጥያቄውን ማስተናገድ አልተቻለም። እባክዎ ቆይተው ይሞክሩ።', mainMenuKeyboard);
        }
      }
      return;
    }

    // LEAVE REQUEST WIZARD STEPS
    if (session.action === 'leave') {
      if (session.step === 'type') {
        session.data.leaveType = text;
        session.step = 'duration';
        await dispatchSendMessage(
          chatId,
          '📅 *የፈቃድ ጊዜውን ያስገቡ:*\nPlease enter the duration or dates of leave:\n(ምሳሌ፡ ለ 2 ሳምንት / ከጥቅምት 10 እስከ 24)',
          cancelKeyboard
        );
      } else if (session.step === 'duration') {
        session.data.duration = text;
        session.step = 'reason';
        await dispatchSendMessage(
          chatId,
          '📝 *የፈቃዱን ዝርዝር ምክንያት ይግለጹ:*\nPlease provide the detailed reason for your leave:',
          cancelKeyboard
        );
      } else if (session.step === 'reason') {
        session.data.reason = text;
        const requestNumber = `LV-${Math.floor(1000 + Math.random() * 9000)}`;

        try {
          await db.collection('leave_requests').add({
            requestNumber,
            studentName: msg.from?.first_name || 'Student',
            telegramId: telegramId,
            telegramUsername: msg.from?.username || '',
            leaveType: session.data.leaveType,
            duration: session.data.duration,
            reason: session.data.reason,
            status: 'pending',
            submittedAt: new Date().toISOString()
          });

          userSessions.delete(telegramId);

          await dispatchSendMessage(
            chatId,
            `✅ *የፈቃድ ጥያቄዎ ተመዝግቧል!*\n` +
            `*Leave Request Submitted!*\n\n` +
            `📋 *Request #:* \`${requestNumber}\`\n` +
            `⏳ *Status:* በመጠባበቅ ላይ (Pending Review)\n\n` +
            `የክፍል ኃላፊዎ ጥያቄዎን መርምረው ውሳኔውን ያሳውቁዎታል።`,
            { parse_mode: 'Markdown', ...mainMenuKeyboard }
          );
        } catch (err) {
          console.error('Failed to submit leave request:', err);
          await dispatchSendMessage(chatId, 'የፈቃድ ጥያቄውን ማስገባት አልተቻለም።', mainMenuKeyboard);
        }
      }
      return;
    }
  }

  // 12. FALLBACK DEFAULT RESPONSE
  await dispatchSendMessage(
    chatId,
    'እንኳን ወደ ወልደ ዋሕድ ሰንበት ት/ቤት ቦት በደህና መጡ! ✝️\n\n' +
    'ከዚህ በታች ካሉት አማራጮች አንዱን ይምረጡ / Please select an option:',
    mainMenuKeyboard
  );
}

// INITIALIZE TELEGRAM BOT SERVICE
if (!token || token.startsWith('PASTE_') || token === 'YOUR_TELEGRAM_BOT_TOKEN') {
  console.log('ℹ️ TELEGRAM_BOT_TOKEN is not set or placeholder in environment.');
} else {
  // Clean up any stale webhook so polling receives updates
  fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`)
    .then((res) => res.json())
    .then((data) => {
      console.log('🧹 Webhook status cleared for polling:', data);
    })
    .catch((err) => {
      console.warn('Webhook cleanup notice:', err);
    });

  botInstance = {
    sendMessage: async (chatId: number | string, text: string, options?: any) => {
      return dispatchSendMessage(chatId, text, options);
    },
    getFile: async (fileId: string) => {
      const res = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
      const data: any = await res.json();
      if (!data.ok) throw new Error(data.description || 'Failed to get file from Telegram');
      return data.result;
    }
  };

  // Resilient background long-polling loop
  (async function startPollingLoop() {
    let offset = 0;
    console.log('🤖 Real interactive Telegram bot polling active 24/7 for @attendanceforchurchbot...');
    
    while (true) {
      try {
        const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=25`;
        const res = await fetch(url);
        const data: any = await res.json();
        
        if (data && data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            offset = Math.max(offset, update.update_id + 1);
            handleTelegramUpdate(update).catch((err) => {
              console.error('Error handling Telegram update:', err);
            });
          }
        } else {
          // If temporary Telegram rate limit or conflict, wait 3s
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      } catch (err: any) {
        // Network timeout / transient blip, retry
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  })().catch((err) => {
    console.error('Fatal in Telegram polling loop:', err);
  });
}

export function getBot() {
  return botInstance;
}
