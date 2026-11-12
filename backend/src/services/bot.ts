import { db } from './firebase';
import { formatEthiopianDate } from '../utils/ethiopianCalendar';
import QRCode from 'qrcode';
import * as dotenv from 'dotenv';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN || '8611581813:AAHadIUrYIkmVzz90WfvcpTduj-ubCZCL8w';

// In-memory conversation state for multi-step wizards
export interface UserSession {
  action: 'register' | 'support' | 'leave';
  step: string;
  data: Record<string, any>;
}

export const userSessions = new Map<number, UserSession>();

export const mainMenuKeyboard = {
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

export const cancelKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: '❌ Cancel (ይቅር)' }]
    ],
    resize_keyboard: true,
  }
};

export const scheduleMenuText = 
  `🗓️ *የወልድ ዋሕድ ሰንበት ት/ቤት መርሐ ግብር*\n\n` +
  `መርሐ ግብሩን በምን መልኩ ማየት ይፈልጋሉ?\n` +
  `ከታች ካሉት የክፍል ደረጃዎች አንዱን ይምረጡ፡-`;

export const scheduleInlineKeyboard = {
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

export const scheduleBackKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '🔙 ወደ መርሐ ግብር ማውጫ ተመለስ', callback_data: 'sch_menu' }]
    ]
  }
};

export const getScheduleText = (key: string): string => {
  switch (key) {
    case 'sch_pre_kg':
      return (
        `🧸 *ቅድመ አንደኛ (Pre-KG) - እሁድ መርሐ ግብር*\n` +
        `═══════════════════════════════\n\n` +
        `• ጸሎት መክፈቻ | 3:30–3:40 (10 ደቂቃ) | ስነ ስርዓት ክፍል\n` +
        `• ትምህርት | 3:40–4:00 (20 ደቂቃ) | ትምህርት ክፍል\n` +
        `• መዝሙር | 4:00–4:15 (15 ደቂቃ) | መዝሙር ክፍል\n` +
        `• አብነት | 4:15–4:30 (15 ደቂቃ) | አብነት ክፍል\n` +
        `• ኪነ ጥበብ | 4:25–4:50 (25 ደቂቃ) | ኪነ ጥበብ ክፍል\n` +
        `• ማስታወቂያ | 4:55–5:00 (5 ደቂቃ) | ስነስርዓት ክፍል\n\n` +
        `⏰ *የክፍለ-ጊዜ ቆይታ:* 3:30 - 5:00`
      );
    case 'sch_g1_2':
      return (
        `🎒 *1ኛ እና 2ኛ ክፍል - እሁድ መርሐ ግብር*\n` +
        `═══════════════════════════════\n\n` +
        `• ጸሎት መክፈቻ | 3:30–3:35 (5 ደቂቃ) | ስነስርዓት ክፍል\n` +
        `• ትምህርት | 3:35–4:05 (30 ደቂቃ) | ትምህርት ክፍል\n` +
        `• ኪነጥበብ | 4:05–4:25 (20 ደቂቃ) | ኪነጥበብ ክፍል\n` +
        `• አብነት | 4:25–4:50 (25 ደቂቃ) | አብነት ክፍል\n` +
        `• መዝሙር | 4:50–5:20 (30 ደቂቃ) | መዝሙር ክፍል\n` +
        `• ማስታወቂያ | 5:20–5:30 (10 ደቂቃ) | ስነስርዓት ክፍል\n\n` +
        `⏰ *የክፍለ-ጊዜ ቆይታ:* 3:30 - 5:30`
      );
    case 'sch_g3_5':
      return (
        `📚 *3ኛ–5ኛ ክፍል - የሳምንቱ መርሐ ግብር*\n` +
        `═══════════════════════════════\n\n` +
        `📅 *ቅዳሜ (Saturday):*\n` +
        `• መክፈቻ ጸሎት | 8:00–8:05 (5 ደቂቃ) | ስነስርዓት ክፍል\n` +
        `• ትምህርት | 8:05–9:00 (55 ደቂቃ) | ትምህርት ክፍል\n` +
        `• ኪነ ጥበብ | 9:00–9:45 (45 ደቂቃ) | ኪነ ጥበብ ክፍል\n` +
        `• ማስታወቂያ | 9:50–10:00 (10 ደቂቃ) | ስነስርዓት ክፍል\n\n` +
        `📅 *እሁድ (Sunday):*\n` +
        `• መክፈቻ ጸሎት | 5:30–5:55 (25 ደቂቃ) | ስነስርዓት ክፍል\n` +
        `• ትምህርት | 5:55–6:45 (50 ደቂቃ) | ትምህርት ክፍል\n` +
        `• መዝሙር | 6:45–7:35 (50 ደቂቃ) | መዝሙር ክፍል\n` +
        `• አብነት | 7:35–7:50 (15 ደቂቃ) | አብነት ክፍል`
      );
    case 'sch_g6_9':
      return (
        `🎓 *6ኛ–9ኛ ክፍል - የሳምንቱ መርሐ ግብር*\n` +
        `═══════════════════════════════\n\n` +
        `📅 *አርብ (Friday):*\n` +
        `• ጸሎት | 11:30–11:50 (20 ደቂቃ) | ስነስርዓት ክፍል\n` +
        `• ኪነጥበብ | 11:50–12:30 (40 ደቂቃ) | ኪነጥበብ ክፍል\n\n` +
        `📅 *ቅዳሜ (Saturday):*\n` +
        `• መክፈቻ ጸሎት | 10:30–10:35 (5 ደቂቃ) | ስነስርዓት ክፍል\n` +
        `• ትምህርት | 10:35–11:25 (50 ደቂቃ) | ትምህርት ክፍል\n` +
        `• ማስታወቂያ | 11:25–11:30 (5 ደቂቃ) | ስነስርዓት ክፍል\n\n` +
        `📅 *እሁድ (Sunday):*\n` +
        `• ጸሎት | 8:00–8:20 (20 ደቂቃ) | ስነስርዓት ክፍል\n` +
        `• ትምህርት | 8:20–9:20 (60 ደቂቃ) | ትምህርት ክፍል\n` +
        `• አብነት | 9:20–9:50 (30 ደቂቃ) | አብነት ክፍል\n` +
        `• መዝሙር እና ወረብ | 9:50–10:55 (65 ደቂቃ) | መዝሙር ክፍል`
      );
    case 'sch_friday':
      return (
        `📅 *የአርብ (Friday) ክፍለ-ጊዜያት*\n` +
        `═══════════════════════════════\n\n` +
        `🎓 *6ኛ–9ኛ ክፍል:*\n` +
        `• ጸሎት | 11:30–11:50 | ስነስርዓት ክፍል\n` +
        `• ኪነ ጥበብ | 11:50–12:30 | ኪነ ጥበብ ክፍል\n\n` +
        `🕊️ *የጋራ ጸሎት:*\n` +
        `• በየወሩ በ7 እና 14 ጸሎት (11:30–12:00)`
      );
    case 'sch_saturday':
      return (
        `📅 *የቅዳሜ (Saturday) ክፍለ-ጊዜያት*\n` +
        `═══════════════════════════════\n\n` +
        `📚 *3ኛ–5ኛ ክፍል:*\n` +
        `• 8:00–10:00 (ጸሎት፣ ትምህርትና ኪነ ጥበብ)\n\n` +
        `🎓 *6ኛ–9ኛ ክፍል:*\n` +
        `• 10:30–11:30 (ጸሎት፣ ትምህርትና ማስታወቂያ)`
      );
    case 'sch_sunday':
      return (
        `📅 *የእሁድ (Sunday) ክፍለ-ጊዜያት*\n` +
        `═══════════════════════════════\n\n` +
        `🧸 *ቅድመ አንደኛ:* 3:30 - 5:00\n` +
        `🎒 *1ኛ እና 2ኛ ክፍል:* 3:30 - 5:30\n` +
        `📚 *3ኛ–5ኛ ክፍል:* 5:30 - 7:50\n` +
        `🎓 *6ኛ–9ኛ ክፍል:* 8:00 - 10:55`
      );
    default:
      return '';
  }
};

// Raw fetch message dispatcher for full-stack API calls
export async function dispatchSendMessage(chatId: number | string, text: string, options?: any) {
  try {
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
      if (data.description && (data.description.includes("can't parse entities") || data.description.includes('entity') || data.description.includes('format'))) {
        const plainPayload = { ...payload };
        delete plainPayload.parse_mode;
        const retryRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(plainPayload),
        });
        return await retryRes.json();
      }
    }
    return data;
  } catch (sendErr) {
    console.error('Failed to dispatch Telegram message:', sendErr);
    return { ok: false, error: sendErr };
  }
}

// Session helper syncs to local map and database
export async function getSession(telegramId: number): Promise<UserSession | null> {
  if (userSessions.has(telegramId)) {
    return userSessions.get(telegramId)!;
  }
  try {
    const docSnap = await db.collection('bot_subscribers').doc(String(telegramId)).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      const sess = data?.session || data?.data?.session;
      if (sess && sess.action && sess.step) {
        userSessions.set(telegramId, sess);
        return sess;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch session from db:', err);
  }
  return null;
}

export async function setSession(telegramId: number, session: UserSession | null) {
  if (session) {
    userSessions.set(telegramId, session);
  } else {
    userSessions.delete(telegramId);
  }
  try {
    await db.collection('bot_subscribers').doc(String(telegramId)).set({
      session: session || null,
      lastActiveAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Failed to sync session to db:', err);
  }
}

// Helper to look up student registration / profile flexibly across collections
export async function findUserRegistrationOrStudent(telegramId: number, username?: string): Promise<{ type: 'student' | 'registration'; data: any } | null> {
  const tgStr = String(telegramId);
  const allCandidates: Array<{ type: 'student' | 'registration'; data: any }> = [];

  const matchesUser = (data: any) => {
    if (!data || data.status === 'deleted') return false;
    const dTg = String(data.telegramId || data.telegram_id || data.tgId || '');
    const dUser = String(data.telegramUsername || data.telegram_username || '').toLowerCase();
    return (dTg && dTg === tgStr) || (username && dUser && dUser === username.toLowerCase());
  };

  // 1. Search students collection
  try {
    const snap = await db.collection('students').get();
    for (const d of snap.docs) {
      const data = d.data();
      if (matchesUser(data)) {
        allCandidates.push({ type: 'student', data });
      }
    }
  } catch (e) {
    console.warn('Notice querying students collection:', e);
  }

  // 2. Search registrations collection
  try {
    const snap = await db.collection('registrations').get();
    for (const d of snap.docs) {
      const data = d.data();
      if (matchesUser(data)) {
        allCandidates.push({ type: 'registration', data });
      }
    }
  } catch (e) {
    console.warn('Notice querying registrations collection:', e);
  }

  if (allCandidates.length > 0) {
    allCandidates.sort((a, b) => {
      const isApprovedA = a.data.status === 'approved' || a.data.status === 'active';
      const isApprovedB = b.data.status === 'approved' || b.data.status === 'active';
      if (isApprovedA && !isApprovedB) return -1;
      if (!isApprovedA && isApprovedB) return 1;

      // Newest submission or decision timestamp takes precedence
      const timeA = new Date(a.data.rejectedAt || a.data.submittedAt || a.data.submitted_at || a.data.createdAt || 0).getTime();
      const timeB = new Date(b.data.rejectedAt || b.data.submittedAt || b.data.submitted_at || b.data.createdAt || 0).getTime();
      return timeB - timeA;
    });

    return allCandidates[0];
  }

  return null;
}

// Helper to look up student or registration by phone number
export async function findStudentOrRegistrationByPhone(phoneInput: string): Promise<{ type: 'student' | 'registration'; data: any } | null> {
  const cleanPhone = phoneInput.replace(/[\s\-\+]/g, '');
  const digits9 = cleanPhone.replace(/\D/g, '').slice(-9);
  if (!digits9 || digits9.length < 9) return null;

  const allCandidates: Array<{ type: 'student' | 'registration'; data: any }> = [];

  const matchesPhone = (data: any) => {
    if (!data || data.status === 'deleted') return false;
    const p = String(data.phone || '').replace(/\D/g, '').slice(-9);
    return p && p === digits9;
  };

  try {
    const snap = await db.collection('students').get();
    for (const d of snap.docs) {
      const data = d.data();
      if (matchesPhone(data)) {
        allCandidates.push({ type: 'student', data });
      }
    }
  } catch (e) {
    console.warn('Notice searching student by phone:', e);
  }

  try {
    const snap = await db.collection('registrations').get();
    for (const d of snap.docs) {
      const data = d.data();
      if (matchesPhone(data)) {
        allCandidates.push({ type: 'registration', data });
      }
    }
  } catch (e) {
    console.warn('Notice searching registration by phone:', e);
  }

  if (allCandidates.length > 0) {
    allCandidates.sort((a, b) => {
      const isApprovedA = a.data.status === 'approved' || a.data.status === 'active';
      const isApprovedB = b.data.status === 'approved' || b.data.status === 'active';
      if (isApprovedA && !isApprovedB) return -1;
      if (!isApprovedA && isApprovedB) return 1;

      const timeA = new Date(a.data.rejectedAt || a.data.submittedAt || a.data.submitted_at || a.data.createdAt || 0).getTime();
      const timeB = new Date(b.data.rejectedAt || b.data.submittedAt || b.data.submitted_at || b.data.createdAt || 0).getTime();
      return timeB - timeA;
    });

    return allCandidates[0];
  }

  return null;
}

// Process update for webhook or polling
export async function handleTelegramUpdate(update: any) {
  if (!update) return;

  // Callback query handling (Inline buttons)
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

  const msg = update.message || update.edited_message;
  if (!msg) return;

  const text = msg.text?.trim() || msg.caption?.trim() || '';
  const telegramId = msg.from?.id;
  const chatId = msg.chat?.id;
  const username = msg.from?.username || '';
  let photoFileId = '';
  if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
    const highest = msg.photo[msg.photo.length - 1];
    photoFileId = highest.file_id;
  }

  if (!chatId || !telegramId) return;

  // Save subscriber details silently without overwriting active session
  db.collection('bot_subscribers').doc(String(telegramId)).set({
    telegramId: String(telegramId),
    chatId: String(chatId),
    username: username,
    firstName: msg.from?.first_name || '',
    lastName: msg.from?.last_name || '',
    lastActiveAt: new Date().toISOString(),
  }, { merge: true }).catch(() => {});

  // /start command
  if (text.startsWith('/start')) {
    await setSession(telegramId, null);
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

  // Cancel command
  if (text.includes('Cancel') || text.includes('ይቅር') || text === '/cancel') {
    await setSession(telegramId, null);
    await dispatchSendMessage(chatId, 'ኦፕሬሽኑ ተሰርዟል / Operation cancelled.', mainMenuKeyboard);
    return;
  }

  // Check active session
  let session = await getSession(telegramId);

  // If user clicks a top-level menu button, handle top-level action & clear session if needed
  const isMenuButton = [
    '📝 የተማሪ ምዝገባ', '📝 Register as Student', 'ምዝገባ', '/register',
    '🔍 የምዝገባ ሁኔታ', '🔍 My Registration', 'የምዝገባ ሁኔታ', '/status',
    '👤 የኔ መታወቂያና QR', '👤 My QR / Profile', 'የኔ መታወቂያ', '/qr', '/profile',
    '📊 የመገኘት ታሪክ', '📊 My Attendance', 'የመገኘት ታሪክ', '/attendance',
    '📅 የትምህርት መርሐ ግብር', '📅 Class Schedule', 'መርሐ ግብር', 'የክፍል መርሐ ግብር', '/schedule',
    '📱 የሞባይል መተግበሪያ', '📱 Download Wold Wahid APK', 'መተግበሪያ', '/apk', '/app',
    '✉️ የፈቃድ መጠየቂያ', '✉️ Leave Request', 'የፈቃድ መጠየቂያ', 'ፈቃድ', '/leave',
    '💬 ድጋፍና እርዳታ', '💬 Support & Help', 'ድጋፍና እርዳታ', 'ድጋፍ', '/support'
  ].includes(text);

  if (isMenuButton) {
    await setSession(telegramId, null);
    session = null;
  }

  // ─── IF SESSION ACTIVE, ADVANCE WIZARD ───
  if (session) {
    if (session.action === 'register') {
      if (session.step === 'name') {
        session.data.name = text;
        session.step = 'christianName';
        await setSession(telegramId, session);
        await dispatchSendMessage(
          chatId,
          '✝️ *የክርስትና ስም ያስገቡ (Step 2/9):*\nPlease enter your Christian Name:\n(ምሳሌ፡ ወልደ ማርያም)',
          cancelKeyboard
        );
      } else if (session.step === 'christianName') {
        session.data.christianName = text;
        session.step = 'gender';
        await setSession(telegramId, session);
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
          '👤 *ጾታ ይምረጡ (Step 3/9):*\nPlease select your Gender:',
          genderKeyboard
        );
      } else if (session.step === 'gender') {
        session.data.gender = text.includes('ወንድ') || text.toLowerCase().includes('male') ? 'male' : 'female';
        session.step = 'birthDate';
        await setSession(telegramId, session);
        await dispatchSendMessage(
          chatId,
          '📅 *የትውልድ ዘመን ወይም ዕድሜ ያስገቡ (Step 4/9):*\nPlease enter your Birth Date / Age:\n(ምሳሌ፡ 1998 ዓ.ም)',
          cancelKeyboard
        );
      } else if (session.step === 'birthDate') {
        session.data.birthDate = text;
        session.step = 'phone';
        await setSession(telegramId, session);
        await dispatchSendMessage(
          chatId,
          '📱 *ስልክ ቁጥርዎን ያስገቡ (Step 5/9):*\nPlease enter your Phone Number:\n(ምሳሌ፡ 0911234567)',
          cancelKeyboard
        );
      } else if (session.step === 'phone') {
        session.data.phone = text;
        session.step = 'address';
        await setSession(telegramId, session);
        await dispatchSendMessage(
          chatId,
          '📍 *የመኖሪያ አድራሻ (ወረዳ / ሰፈር) ያስገቡ (Step 6/9):*\nPlease enter your Address (Woreda / Subcity):\n(ምሳሌ፡ ቦሌ ወረዳ 03)',
          cancelKeyboard
        );
      } else if (session.step === 'address') {
        session.data.address = text;
        session.step = 'emergencyContact';
        await setSession(telegramId, session);
        await dispatchSendMessage(
          chatId,
          '🛡️ *የቅርብ ተጠሪ ስም እና ስልክ ቁጥር ያስገቡ (Step 7/9):*\nPlease enter Emergency Contact Name & Phone:\n(ምሳሌ፡ አበበ ከበደ - 0911234567)',
          cancelKeyboard
        );
      } else if (session.step === 'emergencyContact') {
        session.data.emergencyContactStr = text;
        session.step = 'department';
        await setSession(telegramId, session);
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
          '⛪ *የሰንበት ት/ቤት ክፍል ይምረጡ (Step 8/9):*\nSelect your Sunday School Department:',
          deptKeyboard
        );
      } else if (session.step === 'department') {
        session.data.department = text;
        session.step = 'photo';
        await setSession(telegramId, session);
        await dispatchSendMessage(
          chatId,
          '📸 *የመገለጫ ፎቶ ይላኩ - ከ 5MB ያልበለጠ (Step 9/9):*\nPlease send your profile photo (Max 5MB):\n(ወይንም "None" ብለው መጻፍ ይችላሉ)',
          cancelKeyboard
        );
      } else if (session.step === 'photo') {
        let photoVal = text;
        if (photoFileId) {
          try {
            const fileInfo = await botInstance.getFile(photoFileId);
            if (fileInfo?.file_size && fileInfo.file_size > 5 * 1024 * 1024) {
              await dispatchSendMessage(
                chatId,
                '⚠️ *ፎቶው ከ 5MB መብለጥ የለበትም! (Photo exceeds 5MB limit)*\nእባክዎ አነስተኛ መጠን ያለው ፎቶ እንደገና ይላኩ:',
                cancelKeyboard
              );
              return;
            }
            if (fileInfo?.file_path) {
              photoVal = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;
            } else {
              photoVal = `tg_file:${photoFileId}`;
            }
          } catch {
            photoVal = `tg_file:${photoFileId}`;
          }
        }
        session.data.photo = photoVal;

        try {
          // Clean up any previous registration for this user so only the new submission remains
          const prevDocs = await db.collection('registrations').where('telegramId', '==', String(telegramId)).get();
          for (const pd of prevDocs.docs) {
            await db.collection('registrations').doc(pd.id).delete().catch(() => {});
          }

          await db.collection('registrations').add({
            fullNameAm: session.data.name,
            fullNameEn: session.data.name,
            christianName: session.data.christianName,
            gender: session.data.gender,
            birthDate: session.data.birthDate,
            phone: session.data.phone,
            address: session.data.address,
            subcity: session.data.address,
            emergencyContactStr: session.data.emergencyContactStr,
            emergencyContact: {
              name: session.data.emergencyContactStr || '',
              phone: '',
              relation: 'ቤተሰብ / Family'
            },
            department: session.data.department,
            photoUrl: session.data.photo && session.data.photo !== 'None' ? session.data.photo : '',
            status: 'pending',
            telegramId: String(telegramId),
            telegramUsername: username,
            submittedAt: new Date().toISOString()
          });

          await setSession(telegramId, null);

          const successMsg = 
            `🎉 *የተማሪ ምዝገባ (9ቱ ደረጃዎች) በተሳካ ሁኔታ ተልኳል!*\n` +
            `*Registration Submitted Successfully!*\n\n` +
            `📋 *የመረጃ ማጠቃለያ (9 Steps Summary):*\n` +
            `1. ሙሉ ስም: ${session.data.name}\n` +
            `2. የክርስትና ስም: ${session.data.christianName}\n` +
            `3. ጾታ: ${session.data.gender}\n` +
            `4. የትውልድ ዘመን: ${session.data.birthDate}\n` +
            `5. ስልክ: ${session.data.phone}\n` +
            `6. አድራሻ: ${session.data.address}\n` +
            `7. ተጠሪ: ${session.data.emergencyContactStr}\n` +
            `8. ክፍል: ${session.data.department}\n` +
            `9. ፎቶ: ተካቷል (<= 5MB)\n\n` +
            `⏳ *ሁኔታ:* በመጠባበቅ ላይ (Pending Review - Not in active DB until approved)\n\n` +
            `አስተዳዳሪው ሲያፀድቅ የተማሪ መታወቂያዎና QR ኮድዎ ይደርስዎታል።`;

          await dispatchSendMessage(chatId, successMsg, mainMenuKeyboard);
        } catch (saveErr) {
          console.error('Failed to save registration:', saveErr);
          await dispatchSendMessage(chatId, 'ምዝገባውን ማስቀመጥ አልተቻለም። እባክዎ እንደገና ይሞክሩ።', mainMenuKeyboard);
        }
      }
      return;
    }

    if (session.action === 'support') {
      if (session.step === 'category') {
        session.data.category = text;
        session.step = 'description';
        await setSession(telegramId, session);
        await dispatchSendMessage(
          chatId,
          '📝 *የጥያቄዎን ወይም የድጋፍ ፍላጎትዎን ዝርዝር ይጻፉ:*\nPlease describe your request or message in detail:',
          cancelKeyboard
        );
      } else if (session.step === 'description') {
        session.data.description = text;
        const ticketNumber = 'WW-SPT-' + Math.floor(1000 + Math.random() * 9000);

        try {
          await db.collection('support_tickets').add({
            ticketNumber,
            category: session.data.category,
            description: session.data.description,
            requesterName: msg.from?.first_name || 'Sunday School Member',
            telegramId: String(telegramId),
            telegramUsername: username,
            status: 'new',
            priority: 'medium',
            createdAt: new Date().toISOString()
          });

          await setSession(telegramId, null);

          await dispatchSendMessage(
            chatId,
            `✅ *የድጋፍ ጥያቄዎ ተመዝግቧል!*\n` +
            `*Support Ticket Created!*\n\n` +
            `🎫 *Ticket #:* \`${ticketNumber}\`\n` +
            `📂 *Category:* ${session.data.category}\n\n` +
            `የሰንበት ት/ቤት አመራሮች ጥያቄዎን ተመልክተው በአጭር ጊዜ ውስጥ ያነጋግሩዎታል።`,
            mainMenuKeyboard
          );
        } catch (err) {
          console.error('Failed to create ticket:', err);
          await dispatchSendMessage(chatId, 'ጥያቄውን ማስተናገድ አልተቻለም። እባክዎ ቆይተው ይሞክሩ።', mainMenuKeyboard);
        }
      }
      return;
    }

    if (session.action === 'leave') {
      if (session.step === 'type') {
        session.data.leaveType = text;
        session.step = 'duration';
        await setSession(telegramId, session);
        await dispatchSendMessage(
          chatId,
          '📅 *የፈቃድ ጊዜውን ያስገቡ:*\nPlease enter the duration or dates of leave:\n(ምሳሌ፡ ለ 2 ሳምንት / ከጥቅምት 10 እስከ 24)',
          cancelKeyboard
        );
      } else if (session.step === 'duration') {
        session.data.duration = text;
        session.step = 'reason';
        await setSession(telegramId, session);
        await dispatchSendMessage(
          chatId,
          '📝 *የፈቃዱን ዝርዝር ምክንያት ይግለጹ:*\nPlease provide the detailed reason for your leave:',
          cancelKeyboard
        );
      } else if (session.step === 'reason') {
        session.data.reason = text;
        const requestNumber = 'WW-LV-' + Math.floor(100 + Math.random() * 900);

        try {
          await db.collection('leave_requests').add({
            requestNumber,
            studentName: msg.from?.first_name || 'Student',
            telegramId: String(telegramId),
            telegramUsername: username,
            leaveType: session.data.leaveType,
            duration: session.data.duration,
            reason: session.data.reason,
            status: 'pending',
            submittedAt: new Date().toISOString()
          });

          await setSession(telegramId, null);

          await dispatchSendMessage(
            chatId,
            `✅ *የፈቃድ ጥያቄዎ ተመዝግቧል!*\n` +
            `*Leave Request Submitted!*\n\n` +
            `📋 *Request #:* \`${requestNumber}\`\n` +
            `⏳ *Status:* በመጠባበቅ ላይ (Pending Review)\n\n` +
            `የክፍል ኃላፊዎ ጥያቄዎን መርምረው ውሳኔውን ያሳውቁዎታል።`,
            mainMenuKeyboard
          );
        } catch (err) {
          console.error('Failed to submit leave request:', err);
          await dispatchSendMessage(chatId, 'የፈቃድ ጥያቄውን ማስገባት አልተቻለም።', mainMenuKeyboard);
        }
      }
      return;
    }
  }

  // ─── CHECK IF USER IS ENTERING A PHONE NUMBER TO LINK ACCOUNT ───
  const cleanInputDigits = text.replace(/\D/g, '');
  if (!session && (cleanInputDigits.length === 9 || cleanInputDigits.length === 10 || cleanInputDigits.length === 12)) {
    const digits9 = cleanInputDigits.slice(-9);
    if (digits9.startsWith('9') || digits9.startsWith('7')) {
      const match = await findStudentOrRegistrationByPhone(text);
      if (match) {
        const student = match.data;
        const table = match.type === 'student' ? 'students' : 'registrations';
        try {
          await db.collection(table).doc(student.id).update({
            telegramId: String(telegramId),
            telegramUsername: username,
          });
        } catch (e) {
          console.warn('Notice updating student telegram id:', e);
        }

        const isApproved = student.status === 'approved' || student.status === 'active';
        const statusAm = isApproved
          ? '✅ ጸድቋል (Approved)'
          : student.status === 'rejected'
          ? '❌ አልተቀበለም (Rejected)'
          : '⏳ በመጠባበቅ ላይ (Pending Review)';

        let reply = 
          `✅ *የቴሌግራም አካውንትዎ ከመገለጫዎ ጋር ተገናኝቷል!*\n` +
          `*Profile Linked Successfully!*\n\n` +
          `📋 *የተማሪ መረጃ:*\n` +
          `• *ስም (Name):* ${student.fullNameAm || student.fullNameEn || student.nameAm}\n` +
          `• *የክርስትና ስም:* ${student.christianName || 'N/A'}\n` +
          `• *ስልክ (Phone):* ${student.phone}\n` +
          `• *ክፍል (Dept):* ${student.department || 'N/A'}\n` +
          `• *ሁኔታ (Status):* ${statusAm}\n`;

        if (isApproved) {
          reply += `• *የተማሪ መታወቂያ:* \`${student.studentCode || student.code}\`\n\nዲጂታል መታወቂያዎንና QR ኮድዎን ለማውረድ "👤 የኔ መታወቂያና QR" የሚለውን ይጫኑ።`;
        } else {
          reply += `\nማመልከቻዎ በአስተዳዳሪው እየታየ ነው፤ እንደጸደቀ የተማሪ መታወቂያዎ ይላክሎታል።`;
        }

        await dispatchSendMessage(chatId, reply, mainMenuKeyboard);
        return;
      }
    }
  }

  // ─── TOP LEVEL MENU ACTIONS (No session active) ───

  // 1. 📝 REGISTER AS STUDENT WIZARD
  if (['📝 የተማሪ ምዝገባ', '📝 Register as Student', 'ምዝገባ', '/register'].includes(text)) {
    const existing = await findUserRegistrationOrStudent(telegramId, username);
    if (existing) {
      const reg = existing.data;
      if (reg.status === 'pending' || reg.status === 'pending_approval') {
        await dispatchSendMessage(
          chatId,
          `⚠️ ማመልከቻዎ አስቀድሞ ተመዝግቧል (Submitted: ${reg.submittedAt?.split('T')[0] || 'በቅርቡ'}).\n\nሁኔታውን ለማወቅ "🔍 የምዝገባ ሁኔታ" የሚለውን ይጫኑ።`,
          mainMenuKeyboard
        );
        return;
      } else if (reg.status === 'approved' || reg.status === 'active') {
        await dispatchSendMessage(
          chatId,
          `🎉 ምዝገባዎ የጸደቀ ተማሪ ኖት!\nየተማሪ መታወቂያዎ: \`${reg.studentCode || reg.code}\`\n\nየግል መታወቂያዎንና QR ኮድዎን ለመቀበል "👤 የኔ መታወቂያና QR" የሚለውን ይጫኑ።`,
          mainMenuKeyboard
        );
        return;
      }
    }

    await setSession(telegramId, {
      action: 'register',
      step: 'name',
      data: {}
    });

    await dispatchSendMessage(
      chatId,
      '📝 *የተማሪ ምዝገባ (Step 1/10)*\n*Student Registration*\n\nእባክዎ ሙሉ ስምዎን በአማርኛ ወይም በእንግሊዝኛ ያስገቡ:\nPlease enter your Full Name:\n\n(ምሳሌ፡ ዮሐንስ ተስፋዬ / Yohannes Tesfaye)',
      cancelKeyboard
    );
    return;
  }

  // 2. 🔍 MY REGISTRATION STATUS
  if (['🔍 የምዝገባ ሁኔታ', '🔍 My Registration', 'የምዝገባ ሁኔታ', '/status'].includes(text)) {
    try {
      const activeSession = await getSession(telegramId);
      if (activeSession && activeSession.action === 'register') {
        const stepMap: Record<string, string> = {
          name: '1', christianName: '2', gender: '3', birthDate: '4',
          phone: '5', address: '6', emergencyContact: '7',
          department: '8', photo: '9'
        };
        const stepNum = stepMap[activeSession.step] || '1';

        await dispatchSendMessage(
          chatId,
          `⏳ *የምዝገባ ሂደትዎ ገና በመጠናቀቅ ላይ ነው (Draft Registration - Step ${stepNum}/9)*\n` +
          `⛪ መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን\n═══════════════════════\n` +
          `• ሙሉ ስም: ${activeSession.data.name || 'አልገባም'}\n` +
          `• ስልክ: ${activeSession.data.phone || 'አልገባም'}\n` +
          `• ክፍል: ${activeSession.data.department || 'አልገባም'}\n\n` +
          `👉 እባክዎ የቀረውን ቅጽ በመሙላት ምዝገባዎን ይጨርሱ።`,
          cancelKeyboard
        );
        return;
      }

      const match = await findUserRegistrationOrStudent(telegramId, username);
      if (!match || match.data?.status === 'deleted') {
        await dispatchSendMessage(
          chatId,
          '📋 *የምዝገባ ሁኔታ / Registration Status*\n' +
          '⛪ መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን\n═══════════════════════\n' +
          'በዚህ የቴሌግራም አካውንት የተገኘ የተማሪ ምዝገባ የለም።\n\n' +
          '👉 አዲስ ለመመዝገብ ከታች *"📝 የተማሪ ምዝገባ"* የሚለውን ይጫኑ።\n' +
          '👉 አስቀድመው በስልክ ቁጥር ተመዝግበው ከሆነ የስልክ ቁጥርዎን (ምሳሌ፡ `0911234567`) እዚህ ይላኩ፤ መለያዎ ወዲያውኑ ይገናኛል።',
          mainMenuKeyboard
        );
        return;
      }

      const reg = match.data;
      let statusAm = (reg.status === 'approved' || reg.status === 'active')
        ? '✅ ጸድቋል (Approved)'
        : reg.status === 'rejected'
        ? '❌ አልተቀበለም (Rejected)'
        : '⏳ በመጠባበቅ ላይ (Pending Review)';
      
      let msgText = `📋 *የምዝገባ ሁኔታ / Registration Status*\n` +
        `⛪ መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን\n═══════════════════════\n` +
        `• *ስም (Name):* ${reg.fullNameAm || reg.fullNameEn || reg.nameAm || 'ተማሪ'}\n` +
        `• *የክርስትና ስም:* ${reg.christianName || 'N/A'}\n` +
        `• *ስልክ (Phone):* ${reg.phone || 'N/A'}\n` +
        `• *ክፍል (Dept):* ${reg.department || 'N/A'}\n` +
        `• *ሁኔታ (Status):* ${statusAm}\n`;

      if (reg.status === 'approved' || reg.status === 'active') {
        msgText += `• *የተማሪ መታወቂያ (Student ID):* \`${reg.studentCode || reg.code}\`\n\nመታወቂያዎንና QR ኮድዎን በቀጥታ በቴሌግራም ለማውረድ "👤 የኔ መታወቂያና QR" ን ይጫኑ።`;
      } else if (reg.status === 'rejected') {
        msgText += `• *ምክንያት (Reason):* ${reg.rejectionReason || 'ተጨማሪ ማብራሪያ ያስፈልጋል'}\n\nእንደገና ለማመልከት "📝 የተማሪ ምዝገባ" የሚለውን ይጫኑ።`;
      } else {
        msgText += `\nማመልከቻዎ በአስተዳዳሪው እየታየ ነው፤ እንደጸደቀ የተማሪ መታወቂያዎ ይላክሎታል።`;
      }

      await dispatchSendMessage(chatId, msgText, mainMenuKeyboard);
    } catch (err) {
      console.error('Error fetching registration status:', err);
      await dispatchSendMessage(
        chatId,
        '📋 *የምዝገባ ሁኔታ / Registration Status*\n' +
        '⛪ መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን\n═══════════════════════\n' +
        'በዚህ የቴሌግራም አካውንት የተገኘ የተማሪ ምዝገባ የለም።\n\n' +
        '👉 አዲስ ለመመዝገብ ከታች *"📝 የተማሪ ምዝገባ"* የሚለውን ይጫኑ።\n' +
        '👉 አስቀድመው በስልክ ቁጥር ተመዝግበው ከሆነ የስልክ ቁጥርዎን (ምሳሌ፡ `0911234567`) እዚህ ይላኩ፤ መለያዎ ወዲያውኑ ይገናኛል።',
        mainMenuKeyboard
      );
    }
    return;
  }

  // 3. 👤 MY QR & ID
  if (['👤 የኔ መታወቂያና QR', '👤 My QR / Profile', 'የኔ መታወቂያ', '/qr', '/profile'].includes(text)) {
    try {
      const match = await findUserRegistrationOrStudent(telegramId, username);
      if (!match) {
        await dispatchSendMessage(
          chatId,
          'የተመዘገበ ተማሪ አልተገኘም። እባክዎ በመጀመሪያ "📝 የተማሪ ምዝገባ" የሚለውን በመጫን ይመዝገቡ ወይንም የስልክ ቁጥርዎን (ምሳሌ፡ `0911234567`) ይላኩ።\nNo active student profile found. Please register first or send your phone number.',
          mainMenuKeyboard
        );
        return;
      }

      const student = match.data;
      const code = student.studentCode || student.code;

      if (!code) {
        await dispatchSendMessage(
          chatId,
          '⏳ ምዝገባዎ በአስተዳዳሪው ገና አልጸደቀም። እንደጸደቀ የተማሪ መታወቂያ እና የግል QR ኮድ ይላክሎታል።\nYour registration is still pending review.',
          mainMenuKeyboard
        );
        return;
      }

      const telegramWebAppUrl = 'https://t.me/attendanceforchurchbot/woldwahidsundayschool';

      const caption = 
        `👤 *የተማሪ ዲጂታል መታወቂያ (Official Student ID)*\n` +
        `⛪ *መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን*\n` +
        `═══════════════════════\n` +
        `🆔 *የተማሪ መታወቂያ:* \`${code}\`\n` +
        `👤 *ስም (Name):* ${student.fullNameAm || student.fullNameEn || student.nameAm || 'ተማሪ'}\n` +
        `✝️ *የክርስትና ስም:* ${student.christianName || 'N/A'}\n` +
        `📞 *ስልክ (Phone):* ${student.phone || 'N/A'}\n` +
        `⛪ *ክፍል (Dept):* ${student.department || 'N/A'}\n` +
        `🟢 *ሁኔታ (Status):* ${student.status || 'Active'}\n` +
        `═══════════════════════\n\n` +
        `📲 *ይህ የእርስዎ የግል መታወቂያ QR ኮድ ነው!*\n` +
        `በሰንበት ት/ቤት የመገኘት መመዝገቢያ ሰዓት ይህንን QR ኮድ ለአስተዳዳሪው ያሳዩ።`;

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚀 ሙሉ ዲጂታል ካርድ በዌብ አፕ ክፈት', url: telegramWebAppUrl }]
          ]
        }
      };

      try {
        const qrDataUrl = await QRCode.toDataURL(code, { width: 400, margin: 2 });
        const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        const formData = new FormData();
        formData.append('chat_id', String(chatId));
        formData.append('photo', new Blob([new Uint8Array(buffer)], { type: 'image/png' }), `${code}_qr.png`);
        formData.append('caption', caption);
        formData.append('parse_mode', 'Markdown');
        formData.append('reply_markup', JSON.stringify(keyboard.reply_markup));

        const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
          method: 'POST',
          body: formData,
        });
        const data: any = await res.json();
        if (!data.ok) {
          console.warn('sendPhoto notice:', data);
          await dispatchSendMessage(chatId, caption, keyboard);
        }
      } catch (err) {
        console.warn('Photo dispatch notice, fallback to text:', err);
        await dispatchSendMessage(chatId, caption, keyboard);
      }
    } catch (err) {
      console.error('Error in QR & ID handler:', err);
      await dispatchSendMessage(chatId, 'የተማሪ መታወቂያዎን ለማውጣት አልተቻለም። እባክዎ እንደገና ይሞክሩ።', mainMenuKeyboard);
    }
    return;
  }

  // 4. 📊 MY ATTENDANCE
  if (['📊 የመገኘት ታሪክ', '📊 My Attendance', 'የመገኘት ታሪክ', '/attendance'].includes(text)) {
    const telegramWebAppUrl = 'https://t.me/attendanceforchurchbot/woldwahidsundayschool';

    const match = await findUserRegistrationOrStudent(telegramId, username);
    const student = match?.data || {};
    const studentCode = student.studentCode || student.code || '';
    const studentName = student.fullNameAm || student.fullNameEn || student.nameAm || msg.from?.first_name || 'ተማሪ';

    let records: any[] = [];
    try {
      const attSnap = await db.collection('attendance').get();
      records = attSnap.docs
        .map((d: any) => ({ id: d.id, ...d.data() }))
        .filter((a: any) => 
          String(a.telegramId) === String(telegramId) || 
          String(a.telegram_id) === String(telegramId) ||
          (studentCode && (a.memberCode === studentCode || a.member_code === studentCode || a.code === studentCode))
        )
        .sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    } catch (e) {
      console.warn('Notice loading attendance:', e);
    }

    if (records.length === 0) {
      const emptyMsg = 
        `📊 *የመገኘት መረጃ / Attendance Records*\n` +
        `═══════════════════════\n\n` +
        `በአሁኑ ሰዓት በእርስዎ ስም የተመዘገበ የመገኘት ታሪክ አልተገኘም።\n` +
        `No attendance records logged yet.\n\n` +
        (studentCode ? `🆔 የእርስዎ መታወቂያ: \`${studentCode}\`\n\n` : `💡 ማሳሰቢያ፡ መታወቂያዎን ለማረጋገጥ በመጀመሪያ "📝 Register as Student" ን ይጫኑ።\n\n`) +
        `የተሟላ መረጃዎን በቴሌግራም ዌብ አፕ ለማየት ከታች ያለውን ቁልፍ ይጠቀሙ።`;

      await dispatchSendMessage(chatId, emptyMsg, {
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

    const recentSessions = records.slice(0, 4);

    let report = 
      `📊 *የመገኘት መረጃና ክትትል (Attendance Overview)*\n` +
      `👤 *ተማሪ:* ${studentName} ${studentCode ? `(\`${studentCode}\`)` : ''}\n` +
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
      const ethDate = formatEthiopianDate(rec.date);
      const gregDate = rec.date ? rec.date.split('T')[0] : 'N/A';
      const isAbsent = rec.status === 'absent';
      const isExcused = rec.status === 'excused';
      const statusIcon = isAbsent ? '🔴' : isExcused ? '🟡' : '🟢';
      const statusText = isAbsent ? 'አልተገኘም (Absent)' : isExcused ? 'በፈቃድ (Excused)' : 'ተገኝቷል (Present)';
      const sessionName = rec.sessionName || rec.session_name || 'የሰንበት ት/ቤት ክፍለ-ጊዜ';
      const time = rec.timestamp || 'N/A';

      report += 
        `${idx + 1}. 📅 *${ethDate}* (${gregDate})\n` +
        `   ${statusIcon} *ሁኔታ:* ${statusText}\n` +
        `   ⏰ *ሰዓት:* ${time} | 📖 ${sessionName}\n\n`;
    });

    report += 
      `────────────────────────\n` +
      `💡 *የሁሉንም ቀናት ሙሉ ታሪክ* በቴሌግራም ዌብ አፕ ላይ በዝርዝር ማየት ይችላሉ፦`;

    await dispatchSendMessage(chatId, report, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚀 ሙሉ ታሪክ በዌብ አፕ ይመልከቱ (View Full History)', url: telegramWebAppUrl }]
        ]
      }
    });
    return;
  }

  // 5. 📅 CLASS SCHEDULE
  if (['📅 የትምህርት መርሐ ግብር', '📅 Class Schedule', 'መርሐ ግብር', 'የክፍል መርሐ ግብር', '/schedule'].includes(text)) {
    await dispatchSendMessage(chatId, scheduleMenuText, { parse_mode: 'Markdown', ...scheduleInlineKeyboard });
    return;
  }

  // Direct Schedule Text Button Matchers
  if (['🧸 ቅድመ አንደኛ', 'ቅድመ አንደኛ', 'Pre-KG'].includes(text)) {
    await dispatchSendMessage(chatId, getScheduleText('sch_pre_kg'), { parse_mode: 'Markdown', ...scheduleBackKeyboard });
    return;
  }
  if (['🎒 1ኛ እና 2ኛ ክፍል', '1ኛ እና 2ኛ ክፍል', '1ኛ እና 2ኛ'].includes(text)) {
    await dispatchSendMessage(chatId, getScheduleText('sch_g1_2'), { parse_mode: 'Markdown', ...scheduleBackKeyboard });
    return;
  }
  if (['📚 3ኛ–5ኛ ክፍል', '3ኛ–5ኛ ክፍል', '3ኛ–5ኛ'].includes(text)) {
    await dispatchSendMessage(chatId, getScheduleText('sch_g3_5'), { parse_mode: 'Markdown', ...scheduleBackKeyboard });
    return;
  }
  if (['🎓 6ኛ–9ኛ ክፍል', '6ኛ–9ኛ ክፍል', '6ኛ–9ኛ'].includes(text)) {
    await dispatchSendMessage(chatId, getScheduleText('sch_g6_9'), { parse_mode: 'Markdown', ...scheduleBackKeyboard });
    return;
  }
  if (['📅 አርብ', 'አርብ', 'Friday'].includes(text)) {
    await dispatchSendMessage(chatId, getScheduleText('sch_friday'), { parse_mode: 'Markdown', ...scheduleBackKeyboard });
    return;
  }
  if (['📅 ቅዳሜ', 'ቅዳሜ', 'Saturday'].includes(text)) {
    await dispatchSendMessage(chatId, getScheduleText('sch_saturday'), { parse_mode: 'Markdown', ...scheduleBackKeyboard });
    return;
  }
  if (['📅 እሁድ', 'እሁድ', 'Sunday'].includes(text)) {
    await dispatchSendMessage(chatId, getScheduleText('sch_sunday'), { parse_mode: 'Markdown', ...scheduleBackKeyboard });
    return;
  }
  if (['🔙 ወደ መርሐ ግብር ማውጫ ተመለስ', 'ወደ መርሐ ግብር ማውጫ ተመለስ', 'መርሐ ግብር ማውጫ'].includes(text)) {
    await dispatchSendMessage(chatId, scheduleMenuText, { parse_mode: 'Markdown', ...scheduleInlineKeyboard });
    return;
  }

  // 6. 📱 DOWNLOAD WOLD WAHID APK & WEB APP
  if (['📱 የሞባይል መተግበሪያ', '📱 Download Wold Wahid APK', 'መተግበሪያ', '/apk', '/app'].includes(text)) {
    const telegramWebAppUrl = 'https://t.me/attendanceforchurchbot/woldwahidsundayschool';
    const webUrl = 'https://wold-wahid-sunday-school-app.vercel.app';
    const apkUrl = `${webUrl}/WoldWahid.apk`;
    const appMsgText = 
      `📱 *የወልድ ዋሕድ ሰንበት ት/ቤት መተግበሪያ (Wold Wahid App)*\n` +
      `⛪ *መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን*\n` +
      `═══════════════════════════════\n\n` +
      `የሰንበት ትምህርት ቤቱን መተግበሪያ በስልክዎ ለመጠቀም ያሉ አማራጮች፦\n\n` +
      `✨ *1. በቴሌግራም ዌብ አፕ (Telegram Web App):*\n` +
      `ምንም አይነት ጭነት ሳያስፈልግዎት በቀጥታ በቴሌግራም ዲጂታል መታወቂያዎን፣ የመገኘት ታሪክዎንና ሳምንታዊ መርሐ ግብርዎን ለመክፈት ከታች ያለውን *"ቴሌግራም ዌብ አፕ ክፈት"* ቁልፍ ይጫኑ።\n\n` +
      `🍏 *2. ለአይፎን (iOS iPhone / iPad):*\n` +
      `በ Safari ብሮውዘር ሊንኩን ይክፈቱ ➔ የ Share ምልክቱን ይጫኑ ➔ *"Add to Home Screen (ወደ መነሻ ገጽ ጨምር)"* የሚለውን ይምረጡ። እንደ ማንኛውም የተጫነ መተግበሪያ ከመስመር ውጭ (Offline) ይሰራል።\n\n` +
      `🤖 *3. ለአንድሮይድ (Android APK):*\n` +
      `የ Android መተግበሪያውን በቀጥታ በስልክዎ ላይ ለመጫን ከታች ያለውን *"WoldWahid.apk አውርድ"* ቁልፍ ይጫኑ።`;

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚀 ቴሌግራም ዌብ አፕ ክፈት (Open Web App)', url: telegramWebAppUrl }],
          [{ text: '📥 WoldWahid.apk አውርድ (Direct APK)', url: apkUrl }],
        ],
      },
    };

    await dispatchSendMessage(chatId, appMsgText, keyboard);
    return;
  }

  // 7. ✉️ LEAVE REQUEST WIZARD
  if (['✉️ የፈቃድ መጠየቂያ', '✉️ Leave Request', 'የፈቃድ መጠየቂያ', 'ፈቃድ', '/leave'].includes(text)) {
    await setSession(telegramId, {
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

  // 8. 💬 SUPPORT & HELP WIZARD
  if (['💬 ድጋፍና እርዳታ', '💬 Support & Help', 'ድጋፍና እርዳታ', 'ድጋፍ', '/support'].includes(text)) {
    await setSession(telegramId, {
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

  // Fallback for unhandled input when no session is active
  if (text) {
    await dispatchSendMessage(
      chatId,
      `👋 ሰላም! እባክዎ ከታች ካሉት አማራጮች አንዱን ይምረጡ፦\n\n` +
      `👉 አዲስ ተማሪ ለመመዝገብ *"📝 የተማሪ ምዝገባ"* የሚለውን ይጫኑ።\n` +
      `👉 የምዝገባ ሁኔታዎን ለማየት *"🔍 የምዝገባ ሁኔታ"* የሚለውን ይጫኑ።\n` +
      `👉 መታወቂያዎን ለማውረድ *"👤 የኔ መታወቂያና QR"* የሚለውን ይጫኑ።`,
      mainMenuKeyboard
    );
  }
}

// ─── RESILIENT NATIVE TELEGRAM LONG-POLLING ENGINE ───
let isPollingActive = false;
let pollingAbortController: AbortController | null = null;
let currentOffset = 0;

export async function startPolling() {
  if (isPollingActive) return;
  if (!token || token.startsWith('PASTE_')) {
    console.warn('Telegram bot token not configured; polling not started.');
    return;
  }

  isPollingActive = true;
  console.log('🤖 Telegram bot native long-polling engine started successfully.');

  (async () => {
    while (isPollingActive) {
      try {
        pollingAbortController = new AbortController();
        const timeoutId = setTimeout(() => {
          try { pollingAbortController?.abort(); } catch {}
        }, 50000);

        const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${currentOffset}&timeout=30&allowed_updates=["message","edited_message","callback_query"]`;
        const res = await fetch(url, { signal: pollingAbortController.signal });
        clearTimeout(timeoutId);

        if (!res.ok) {
          const errData: any = await res.json().catch(() => ({}));
          if (errData?.error_code === 409) {
            // Another instance is polling (e.g. server reload overlap) - wait before next poll
            await new Promise((r) => setTimeout(r, 5000));
          } else {
            console.warn('Telegram polling warning:', errData?.description || res.statusText);
            await new Promise((r) => setTimeout(r, 2000));
          }
          continue;
        }

        const data: any = await res.json();
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            currentOffset = update.update_id + 1;
            handleTelegramUpdate(update).catch((err) => {
              console.error('Error processing update in bot:', err);
            });
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }
  })();
}

export const botInstance = {
  sendMessage: (chatId: number | string, text: string, options?: any) => dispatchSendMessage(chatId, text, options),
  getFile: async (fileId: string) => {
    const res = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const data: any = await res.json();
    if (data.ok && data.result) return data.result;
    throw new Error(data.description || 'Failed to get file from Telegram');
  },
  on: () => {},
  hears: () => {},
  command: () => {},
};

export function getBot() {
  return botInstance;
}

// Start polling on startup
if (token && !token.startsWith('PASTE_')) {
  startPolling().catch((err) => console.error('Failed to start Telegram polling:', err));
}
