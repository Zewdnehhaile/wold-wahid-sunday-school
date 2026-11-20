import { db } from './firebase';
import { formatEthiopianDate } from '../utils/ethiopianCalendar';
import { renderDualIdCardPngs } from '../utils/idCardRenderer';
import QRCode from 'qrcode';
import * as dotenv from 'dotenv';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN || '8611581813:AAHadIUrYIkmVzz90WfvcpTduj-ubCZCL8w';

// In-memory conversation state for multi-step wizards
export interface UserSession {
  action: 'register' | 'support' | 'leave' | 'edit';
  step: string;
  data: Record<string, any>;
}

export const userSessions = new Map<string, UserSession>();

export const mainMenuKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: '📝 የተማሪ ምዝገባ' }, { text: '🔍 የምዝገባ ሁኔታ' }],
      [{ text: '👤 የኔ መታወቂያና QR' }, { text: '📊 የመገኘት ታሪክ' }],
      [{ text: '📅 የትምህርት መርሐ ግብር' }, { text: '✉️ የፈቃድ መጠየቂያ' }],
      [{ text: '✏️ መረጃ አስተካክል' }, { text: '💬 ድጋፍና እርዳታ' }]
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

// Session helper syncs to local map and persistent database storage
export async function getSession(telegramId: number | string): Promise<UserSession | null> {
  const key = String(telegramId);
  if (userSessions.has(key)) {
    return userSessions.get(key)!;
  }
  try {
    const docSnap = await db.collection('bot_sessions').doc(key).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      if (data && data.action && data.step) {
        const sess: UserSession = {
          action: data.action,
          step: data.step,
          data: data.data || {},
        };
        userSessions.set(key, sess);
        return sess;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch session from bot_sessions:', err);
  }
  // Secondary fallback to bot_subscribers
  try {
    const subSnap = await db.collection('bot_subscribers').doc(key).get();
    if (subSnap.exists) {
      const data = subSnap.data();
      const sess = data?.session || data?.data?.session;
      if (sess && sess.action && sess.step) {
        userSessions.set(key, sess);
        return sess;
      }
    }
  } catch {}
  return null;
}

export async function setSession(telegramId: number | string, session: UserSession | null) {
  const key = String(telegramId);
  if (session) {
    userSessions.set(key, { ...session });
  } else {
    userSessions.delete(key);
  }
  try {
    if (session) {
      await Promise.all([
        db.collection('bot_sessions').doc(key).set({
          action: session.action,
          step: session.step,
          data: session.data || {},
          updatedAt: new Date().toISOString(),
        }),
        db.collection('bot_subscribers').doc(key).set({
          session: session,
          lastActiveAt: new Date().toISOString(),
        }, { merge: true }),
      ]);
    } else {
      await Promise.all([
        db.collection('bot_sessions').doc(key).delete().catch(() => {}),
        db.collection('bot_subscribers').doc(key).set({
          session: null,
          lastActiveAt: new Date().toISOString(),
        }, { merge: true }).catch(() => {}),
      ]);
    }
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

  // 1. Search students collection (skip deleted)
  try {
    const snap = await db.collection('students')
      .where('telegramId', '==', tgStr)
      .limit(5)
      .get();
    
    const validStuds = snap.docs.filter((d: any) => d.data()?.status !== 'deleted');
    if (validStuds.length > 0) {
      allCandidates.push({ type: 'student', data: { id: validStuds[0].id, ...validStuds[0].data() } });
    } else if (username) {
      const userSnap = await db.collection('students')
        .where('telegramUsername', '==', username)
        .limit(5)
        .get();
      const validUserStuds = userSnap.docs.filter((d: any) => d.data()?.status !== 'deleted');
      if (validUserStuds.length > 0) {
        allCandidates.push({ type: 'student', data: { id: validUserStuds[0].id, ...validUserStuds[0].data() } });
      }
    }
  } catch (e) {
    console.warn('Notice querying students collection:', e);
  }

  // 2. Search registrations collection (skip deleted)
  try {
    const snap = await db.collection('registrations')
      .where('telegramId', '==', tgStr)
      .limit(5)
      .get();
    
    const validRegs = snap.docs.filter((d: any) => d.data()?.status !== 'deleted');
    if (validRegs.length > 0) {
      allCandidates.push({ type: 'registration', data: { id: validRegs[0].id, ...validRegs[0].data() } });
    } else if (username) {
      const userSnap = await db.collection('registrations')
        .where('telegramUsername', '==', username)
        .limit(5)
        .get();
      const validUserRegs = userSnap.docs.filter((d: any) => d.data()?.status !== 'deleted');
      if (validUserRegs.length > 0) {
        allCandidates.push({ type: 'registration', data: { id: validUserRegs[0].id, ...validUserRegs[0].data() } });
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
    const snap = await db.collection('students')
      .where('phone', '==', phoneInput)
      .limit(1)
      .get();
    if (!snap.empty) {
      allCandidates.push({ type: 'student', data: { id: snap.docs[0].id, ...snap.docs[0].data() } });
    } else {
      // Try fuzzy phone match if exact fails
      const allStuds = await db.collection('students').get(); // Fallback for phone is harder without full text search
      for (const d of allStuds.docs) {
        if (matchesPhone(d.data())) {
          allCandidates.push({ type: 'student', data: { id: d.id, ...d.data() } });
          break; 
        }
      }
    }
  } catch (e) {
    console.warn('Notice searching student by phone:', e);
  }

  try {
    const snap = await db.collection('registrations')
      .where('phone', '==', phoneInput)
      .limit(1)
      .get();
    if (!snap.empty) {
      allCandidates.push({ type: 'registration', data: { id: snap.docs[0].id, ...snap.docs[0].data() } });
    } else {
      const allRegs = await db.collection('registrations').get();
      for (const d of allRegs.docs) {
        if (matchesPhone(d.data())) {
          allCandidates.push({ type: 'registration', data: { id: d.id, ...d.data() } });
          break;
        }
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

// In-memory deduplication caches and per-user execution locks to eliminate race conditions & repeating messages
const processedUpdateIds = new Set<number>();
const processedMessageKeys = new Set<string>();
const userLocks = new Map<string, Promise<any>>();

// Process update for webhook or polling with per-user mutex locking
export async function handleTelegramUpdate(update: any) {
  if (!update || typeof update !== 'object') return;

  const msg = update.message || update.edited_message;
  const telegramId = msg?.from?.id || update.callback_query?.from?.id;
  if (!telegramId) {
    return handleTelegramUpdateInner(update);
  }

  const lockKey = String(telegramId);
  const previousLock = userLocks.get(lockKey) || Promise.resolve();
  let releaseLock!: () => void;
  const nextLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  userLocks.set(lockKey, nextLock);

  await previousLock;
  try {
    await handleTelegramUpdateInner(update);
  } finally {
    releaseLock();
    if (userLocks.get(lockKey) === nextLock) {
      userLocks.delete(lockKey);
    }
  }
}

async function handleTelegramUpdateInner(update: any) {
  if (!update || typeof update !== 'object') return;

  const updateId = update.update_id;
  if (updateId) {
    if (processedUpdateIds.has(updateId)) {
      return; // Skip duplicate update delivery
    }
    processedUpdateIds.add(updateId);
    if (processedUpdateIds.size > 5000) {
      const first = processedUpdateIds.values().next().value;
      if (first !== undefined) processedUpdateIds.delete(first);
    }
  }

  // Callback query handling (Inline buttons)
  if (update.callback_query) {
    const cq = update.callback_query;
    const data = cq.data;
    const chatId = cq.message?.chat?.id;
    const cqFrom = cq.from;
    const cqId = cq.id;

    if (cqId) {
      fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: cqId }),
      }).catch(() => {});
    }

    if (!data || !chatId) return;

    if (data === 'edit_reg_menu') {
      const cqTgId = cqFrom?.id || chatId;
      const cqUsername = cqFrom?.username || '';
      await sendEditFieldMenu(chatId, cqTgId, cqUsername);
      return;
    }

    if (data.startsWith('edit_field:')) {
      const field = data.replace('edit_field:', '').trim();
      const cqTgId = cqFrom?.id || chatId;
      const cqUsername = cqFrom?.username || '';
      await startFieldEditPrompt(chatId, cqTgId, cqUsername, field);
      return;
    }

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

  // Deduplicate repeated message IDs for the same chat
  if (msg.message_id) {
    const msgKey = `${chatId}_${msg.message_id}`;
    if (processedMessageKeys.has(msgKey)) {
      return; // Skip duplicate message
    }
    processedMessageKeys.add(msgKey);
    if (processedMessageKeys.size > 5000) {
      const first = processedMessageKeys.values().next().value;
      if (first !== undefined) processedMessageKeys.delete(first);
    }
  }

  // Save subscriber details silently without overwriting active session
  db.collection('bot_subscribers').doc(String(telegramId)).set({
    telegramId: String(telegramId),
    chatId: String(chatId),
    username: username,
    firstName: msg.from?.first_name || '',
    lastName: msg.from?.last_name || '',
    lastActiveAt: new Date().toISOString(),
  }, { merge: true }).catch(() => {});

  // /start command (including Parent Web Portal login deep link: /start plogin_<token>)
  if (text.startsWith('/start')) {
    await setSession(telegramId, null);
    const startPayload = text.split(/\s+/)[1] || '';
    if (startPayload.startsWith('plogin_')) {
      const loginToken = startPayload.replace('plogin_', '').trim();
      if (loginToken) {
        try {
          await db.collection('parent_login_tokens').doc(loginToken).set({
            token: loginToken,
            status: 'verified',
            telegramId: String(telegramId),
            telegramUsername: username || '',
            firstName: msg.from?.first_name || '',
            lastName: msg.from?.last_name || '',
            verifiedAt: new Date().toISOString(),
          }, { merge: true });

          await dispatchSendMessage(
            chatId,
            `✅ *የወላጅ ፖርታል መግቢያ ተረጋግጧል!*\n` +
            `*Parent Web Login Confirmed!*\n\n` +
            `ውድ *${msg.from?.first_name || 'ወላጅ'}* ሆይ፡ የወላጅ መከታተያ ፖርታል መግቢያዎ በተሳካ ሁኔታ ተረጋግጧል።\n` +
            `👉 አሁን ወደ ከፈቱት ድረ-ገጽ (Browser) ይመለሱ — በራስ-ሰር ይገባል።`,
            mainMenuKeyboard
          );
          return;
        } catch (err) {
          console.warn('Parent login token confirm notice:', err);
        }
      }
    }

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
    '✉️ የፈቃድ መጠየቂያ', '✉️ Leave Request', 'የፈቃድ መጠየቂያ', 'ፈቃድ', '/leave',
    '✏️ መረጃ አስተካክል', '✏️ Edit Registration', 'መረጃ አስተካክል', '/edit',
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
          '✝️ *የክርስትና ስም ያስገቡ (Step 2/10):*\nPlease enter your Christian Name:\n(ምሳሌ፡ ወልደ ማርያም)',
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
          '👤 *ጾታ ይምረጡ (Step 3/10):*\nPlease select your Gender:',
          genderKeyboard
        );
      } else if (session.step === 'gender') {
        session.data.gender = text.includes('ወንድ') || text.toLowerCase().includes('male') ? 'male' : 'female';
        session.step = 'birthDate';
        await setSession(telegramId, session);

        // Generate years keyboard (Ethiopian years) - Improved list
        const currentEthYear = 2017;
        const years = [];
        // Recent 20 years one by one
        for (let y = currentEthYear; y > currentEthYear - 20; y -= 4) {
          const row = [];
          for (let i = 0; i < 4; i++) {
            if (y - i > currentEthYear - 65) row.push({ text: String(y - i) });
          }
          years.push(row);
        }
        // Then some older decades
        years.push([{ text: '1995' }, { text: '1990' }, { text: '1985' }, { text: '1980' }]);
        years.push([{ text: '1975' }, { text: '1970' }, { text: '1965' }, { text: '1960' }]);
        years.push([{ text: '❌ Cancel (ይቅር)' }]);

        await dispatchSendMessage(
          chatId,
          '📅 *የትውልድ ዘመን ወይም ዕድሜ ይምረጡ ወይም ያስገቡ (Step 4/10):*\nPlease select or enter your Birth Year / Age:\n(ምሳሌ፡ 1998 ዓ.ም)',
          { reply_markup: { keyboard: years, resize_keyboard: true } }
        );
      } else if (session.step === 'birthDate') {
        session.data.birthDate = text;
        session.step = 'phone';
        await setSession(telegramId, session);
        await dispatchSendMessage(
          chatId,
          '📱 *ስልክ ቁጥርዎን ያስገቡ (Step 5/10):*\nPlease enter your Phone Number:\n(ምሳሌ፡ 0911234567)',
          cancelKeyboard
        );
      } else if (session.step === 'phone') {
        session.data.phone = text;
        session.step = 'address';
        await setSession(telegramId, session);
        await dispatchSendMessage(
          chatId,
          '📍 *የመኖሪያ አድራሻ (ወረዳ / ሰፈር) ያስገቡ (Step 6/10):*\nPlease enter your Address (Woreda / Subcity):\n(ምሳሌ፡ ቦሌ ወረዳ 03)',
          cancelKeyboard
        );
      } else if (session.step === 'address') {
        session.data.address = text;
        session.step = 'emergencyName';
        await setSession(telegramId, session);
        await dispatchSendMessage(
          chatId,
          '🛡️ *የቅርብ ተጠሪ ስም ያስገቡ (Step 7/10):*\nPlease enter Emergency Contact Name:',
          cancelKeyboard
        );
      } else if (session.step === 'emergencyName') {
        session.data.emergencyName = text;
        session.step = 'emergencyPhone';
        await setSession(telegramId, session);
        await dispatchSendMessage(
          chatId,
          '📞 *የቅርብ ተጠሪ ስልክ ቁጥር ያስገቡ (Step 8/10):*\nPlease enter Emergency Contact Phone:',
          cancelKeyboard
        );
      } else if (session.step === 'emergencyPhone') {
        session.data.emergencyPhone = text;
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
          '⛪ *የሰንበት ት/ቤት ክፍል ይምረጡ (Step 9/10):*\nSelect your Sunday School Department:',
          deptKeyboard
        );
      } else if (session.step === 'department') {
        session.data.department = text;
        session.step = 'photo';
        await setSession(telegramId, session);
        await dispatchSendMessage(
          chatId,
          '📸 *የመገለጫ ፎቶ ይላኩ - ከ 5MB ያልበለጠ (Step 10/10):*\nPlease send your profile photo (Max 5MB):\n(ወይንም "None" ብለው መጻፍ ይችላሉ)',
          cancelKeyboard
        );
      } else if (session.step === 'photo') {
        let photoVal = text;
        const isNoneText = !photoFileId && String(text || '').trim().toLowerCase() === 'none';
        if (isNoneText) {
          photoVal = '';
        } else if (photoFileId) {
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
            emergencyName: session.data.emergencyName,
            emergencyPhone: session.data.emergencyPhone,
            emergencyContact: {
              name: session.data.emergencyName || '',
              phone: session.data.emergencyPhone || '',
              relation: 'ቤተሰብ / Family'
            },
            department: session.data.department,
            photoUrl: session.data.photo && String(session.data.photo).toLowerCase() !== 'none' ? session.data.photo : '',
            status: 'pending',
            telegramId: String(telegramId),
            telegramUsername: username,
            submittedAt: new Date().toISOString()
          });

          const savedSummary = { ...session.data };
          await setSession(telegramId, null);

          const hasPhoto = Boolean(savedSummary.photo && String(savedSummary.photo).toLowerCase() !== 'none');
          const successMsg = 
            `🎉 *የተማሪ ምዝገባ (10ቱ ደረጃዎች) በተሳካ ሁኔታ ተልኳል!*\n` +
            `*Registration Submitted Successfully!*\n\n` +
            `📋 *የመረጃ ማጠቃለያ (10 Steps Summary):*\n` +
            `1. ሙሉ ስም: ${savedSummary.name}\n` +
            `2. የክርስትና ስም: ${savedSummary.christianName}\n` +
            `3. ጾታ: ${savedSummary.gender}\n` +
            `4. የትውልድ ዘመን: ${savedSummary.birthDate}\n` +
            `5. ስልክ: ${savedSummary.phone}\n` +
            `6. አድራሻ: ${savedSummary.address}\n` +
            `7. ተጠሪ ስም: ${savedSummary.emergencyName}\n` +
            `8. ተጠሪ ስልክ: ${savedSummary.emergencyPhone}\n` +
            `9. ክፍል: ${savedSummary.department}\n` +
            `10. ፎቶ: ${hasPhoto ? 'ተካቷል (<= 5MB)' : 'አልተካተተም (None)'}\n\n` +
            `⏳ *ሁኔታ:* በመጠባበቅ ላይ (Pending Approval)\n\n` +
            `አስተዳዳሪው ሲያፀድቅ የተማሪ መታወቂያዎና QR ኮድዎ ይደርስዎታል።`;

          await dispatchSendMessage(chatId, successMsg, mainMenuKeyboard);
          await dispatchSendMessage(
            chatId,
            '✏️ ስህተት ካለ ወይም መረጃ ለማስተካከል ከታች ያለውን ቁልፍ ይጫኑ፦',
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '✏️ መረጃ አስተካክል (Edit Info)', callback_data: 'edit_reg_menu' }]
                ]
              }
            }
          );
        } catch (saveErr) {
          console.error('Failed to save registration:', saveErr);
          await dispatchSendMessage(chatId, 'ምዝገባውን ማስቀመጥ አልተቻለም። እባክዎ እንደገና ይሞክሩ።', mainMenuKeyboard);
        }
      }
      return;
    }

    if (session.action === 'edit') {
      const targetCol = session.data.collectionName || 'registrations';
      const docId = session.data.docId;
      const isApprovedEdit = Boolean(session.data.isApprovedEdit);
      const field = session.step;

      if (!docId) {
        await setSession(telegramId, null);
        await dispatchSendMessage(chatId, 'የሚስተካከል ምዝገባ አልተገኘም።', mainMenuKeyboard);
        return;
      }

      try {
        const currentDoc = await db.collection(targetCol).doc(docId).get();
        const currentData = currentDoc.exists ? currentDoc.data() || {} : {};
        const patch: Record<string, any> = { updatedAt: new Date().toISOString() };

        if (field === 'fullName') {
          if (!text) return;
          patch.fullNameAm = text;
          patch.fullNameEn = text;
        } else if (field === 'christianName') {
          if (!text) return;
          patch.christianName = text;
        } else if (field === 'gender') {
          patch.gender = text.includes('ወንድ') || text.toLowerCase().includes('male') ? 'male' : 'female';
        } else if (field === 'birthDate') {
          if (!text) return;
          patch.birthDate = text;
          patch.birthYear = text;
        } else if (field === 'phone') {
          let cleanPhone = String(text || '').replace(/[\s\-\(\)\+]/g, '');
          if (cleanPhone.startsWith('251')) cleanPhone = '0' + cleanPhone.slice(3);
          if (isApprovedEdit && (cleanPhone.length !== 10 || (!cleanPhone.startsWith('09') && !cleanPhone.startsWith('07')))) {
            await dispatchSendMessage(
              chatId,
              '⚠️ ስልክ ቁጥር በትክክል 10 አሃዝ መሆን አለበት እና በ `09` ወይም `07` መጀመር አለበት (ምሳሌ፡ `0911234567`)። እባክዎ እንደገና ያስገቡ፦',
              cancelKeyboard
            );
            return;
          }
          patch.phone = cleanPhone || text;
        } else if (field === 'address') {
          if (!text) return;
          patch.address = text;
          patch.subcity = text;
        } else if (field === 'emergencyName') {
          if (!text) return;
          patch.emergencyName = text;
          patch.emergencyContact = {
            ...(currentData.emergencyContact || {}),
            name: text,
            phone: currentData.emergencyContact?.phone || currentData.emergencyPhone || '',
            relation: currentData.emergencyContact?.relation || 'ቤተሰብ / Family',
          };
        } else if (field === 'emergencyPhone') {
          if (!text) return;
          patch.emergencyPhone = text;
          patch.emergencyContact = {
            ...(currentData.emergencyContact || {}),
            name: currentData.emergencyContact?.name || currentData.emergencyName || '',
            phone: text,
            relation: currentData.emergencyContact?.relation || 'ቤተሰብ / Family',
          };
        } else if (field === 'department') {
          if (!text) return;
          patch.department = text;
        } else if (field === 'photo') {
          let photoVal = '';
          const isNoneText = !photoFileId && String(text || '').trim().toLowerCase() === 'none';
          if (!isNoneText && photoFileId) {
            try {
              const fileInfo = await botInstance.getFile(photoFileId);
              if (fileInfo?.file_size && fileInfo.file_size > 5 * 1024 * 1024) {
                await dispatchSendMessage(
                  chatId,
                  '⚠️ *ፎቶው ከ 5MB መብለጥ የለበትም!*\nእባክዎ አነስተኛ መጠን ያለው ፎቶ እንደገና ይላኩ፦',
                  cancelKeyboard
                );
                return;
              }
              photoVal = fileInfo?.file_path
                ? `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`
                : `tg_file:${photoFileId}`;
            } catch {
              photoVal = `tg_file:${photoFileId}`;
            }
          } else if (!isNoneText) {
            photoVal = text;
          }
          patch.photoUrl = photoVal;
        }

        if (isApprovedEdit) {
          patch.hasEditedProfileOnce = true;
          patch.pendingEditSummary = {
            oldPhone: currentData.phone || '',
            newPhone: patch.phone || currentData.phone || '',
            oldBirthYear: currentData.birthYear || currentData.birthDate || '',
            newBirthYear: patch.birthYear || currentData.birthYear || currentData.birthDate || '',
            editedAt: new Date().toISOString(),
          };
          patch.status = targetCol === 'students' ? 'pending_approval' : 'pending';
        }

        await db.collection(targetCol).doc(docId).update(patch);

        // Keep matching registration/student doc in sync if both exist under the same ID
        const otherCol = targetCol === 'students' ? 'registrations' : 'students';
        const otherSnap = await db.collection(otherCol).doc(docId).get();
        if (otherSnap.exists) {
          const otherPatch = { ...patch };
          if (isApprovedEdit) {
            otherPatch.status = otherCol === 'students' ? 'pending_approval' : 'pending';
          }
          await db.collection(otherCol).doc(docId).update(otherPatch).catch(() => {});
        }

        await setSession(telegramId, null);

        const updatedSnap = await db.collection(targetCol).doc(docId).get();
        const u = updatedSnap.exists ? updatedSnap.data() || { ...currentData, ...patch } : { ...currentData, ...patch };

        await dispatchSendMessage(
          chatId,
          `✅ *መረጃዎ በተሳካ ሁኔታ ተስተካክሏል! (Profile Updated)*\n\n` +
          `1. ሙሉ ስም: ${u.fullNameAm || u.fullNameEn || 'N/A'}\n` +
          `2. የክርስትና ስም: ${u.christianName || 'N/A'}\n` +
          `3. ጾታ: ${u.gender || 'N/A'}\n` +
          `4. የትውልድ ዘመን: ${u.birthDate || u.birthYear || 'N/A'}\n` +
          `5. ስልክ: ${u.phone || 'N/A'}\n` +
          `6. አድራሻ: ${u.address || u.subcity || 'N/A'}\n` +
          `7. ተጠሪ ስም: ${u.emergencyContact?.name || u.emergencyName || 'N/A'}\n` +
          `8. ተጠሪ ስልክ: ${u.emergencyContact?.phone || u.emergencyPhone || 'N/A'}\n` +
          `9. ክፍል: ${u.department || 'N/A'}\n\n` +
          (isApprovedEdit
            ? `⏳ የስልክ/የትውልድ ዘመን ለውጥዎ ወደ አስተዳዳሪ ማረጋገጫ ተልኳል።`
            : `ዋናው ማውጫ ከታች ተመልሷል።`),
          mainMenuKeyboard
        );
        if (!isApprovedEdit) {
          await dispatchSendMessage(
            chatId,
            '✏️ ሌላ መረጃ ማስተካከል ከፈለጉ ከታች ያለውን ቁልፍ ይጫኑ፦',
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [[{ text: '✏️ ሌላ መረጃ አስተካክል (Edit Another Field)', callback_data: 'edit_reg_menu' }]],
              },
            }
          );
        }
      } catch (editErr) {
        console.error('Failed to update registration field:', editErr);
        await setSession(telegramId, null);
        await dispatchSendMessage(chatId, 'መረጃውን ማስተካከል አልተቻለም። እባክዎ እንደገና ይሞክሩ።', mainMenuKeyboard);
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
  if (['📝 የተማሪ ምዝገባ', '📝 Register as Student', 'ምዝገባ', '/register', '🔄 እንደገና መመዝገብ'].includes(text)) {
    const existing = await findUserRegistrationOrStudent(telegramId, username);
    if (existing) {
      const reg = existing.data;
      if (reg.status === 'approved' || reg.status === 'active') {
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

    const hasPriorSubmission = existing && (existing.data?.status === 'pending' || existing.data?.status === 'pending_approval');
    const updateHeader = hasPriorSubmission ? '💡 *(ማሳሰቢያ፡ የቀደመውን ማመልከቻዎን በአዲሱ 10 ደረጃ መረጃ ያድሳል)*\n\n' : '';

    await dispatchSendMessage(
      chatId,
      `📝 *የተማሪ ምዝገባ (Step 1/10)*\n*Student Registration*\n\n${updateHeader}እባክዎ ሙሉ ስምዎን በአማርኛ ወይም በእንግሊዝኛ ያስገቡ:\nPlease enter your Full Name:\n\n(ምሳሌ፡ ዮሐንስ ተስፋዬ / Yohannes Tesfaye)`,
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
          phone: '5', address: '6', emergencyName: '7', emergencyPhone: '8',
          department: '9', photo: '10'
        };
        const stepNum = stepMap[activeSession.step] || '1';

        await dispatchSendMessage(
          chatId,
          `⏳ *የምዝገባ ሂደትዎ ገና በመጠናቀቅ ላይ ነው (Draft Registration - Step ${stepNum}/10)*\n` +
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

      await dispatchSendMessage(chatId, msgText, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '✏️ መረጃ አስተካክል (Edit Info)', callback_data: 'edit_reg_menu' }]],
        },
      });
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

  // 3. 👤 MY QR & ID (Sends dual-sided Front & Back ID Card PNGs)
  if (['👤 የኔ መታወቂያና QR', '👤 My QR / Profile', 'የኔ መታወቂያ', '/qr', '/profile'].includes(text)) {
    try {
      const match = await findUserRegistrationOrStudent(telegramId, username);
      if (!match || match.data?.status === 'deleted') {
        await dispatchSendMessage(
          chatId,
          'የተመዘገበ ተማሪ አልተገኘም። እባክዎ በመጀመሪያ "📝 የተማሪ ምዝገባ" የሚለውን በመጫን ይመዝገቡ ወይንም የስልክ ቁጥርዎን (ምሳሌ፡ `0911234567`) ይላኩ።\nNo registered student profile found. Please register first or send your phone number.',
          mainMenuKeyboard
        );
        return;
      }

      const student = match.data;
      const rawCode = String(student.studentCode || student.code || '').trim();
      const hasAssignedCode = Boolean(rawCode) && !rawCode.toUpperCase().startsWith('PENDING');

      if (student.status === 'rejected') {
        await dispatchSendMessage(
          chatId,
          `❌ *የምዝገባ ጥያቄዎ አልተቀበለም*\n` +
          `ምክንያት፦ ${student.rejectionReason || 'ተጨማሪ ማብራሪያ ያስፈልጋል'}\n\n` +
          `እንደገና ለመመዝገብ *"📝 የተማሪ ምዝገባ"* የሚለውን ይጫኑ።`,
          mainMenuKeyboard
        );
        return;
      }

      if (!hasAssignedCode) {
        if (student.status === 'pending' || student.status === 'pending_approval') {
          await dispatchSendMessage(
            chatId,
            '⏳ ምዝገባዎ በአስተዳዳሪው ገና አልጸደቀም። እንደጸደቀ የተማሪ መታወቂያ እና የግል QR ኮድ ይላክሎታል።\nYour registration is still pending review.',
            mainMenuKeyboard
          );
        } else {
          await dispatchSendMessage(
            chatId,
            'የተመዘገበ ተማሪ አልተገኘም። እባክዎ በመጀመሪያ "📝 የተማሪ ምዝገባ" የሚለውን በመጫን ይመዝገቡ ወይንም የስልክ ቁጥርዎን (ምሳሌ፡ `0911234567`) ይላኩ።\nNo registered student profile found. Please register first or send your phone number.',
            mainMenuKeyboard
          );
        }
        return;
      }

      const code = rawCode.toUpperCase();
      const telegramWebAppUrl = 'https://t.me/attendanceforchurchbot/woldwahidsundayschool';

      const caption =
        `👤 *የተማሪ ዲጂታል መታወቂያ (የፊትና የጀርባ ገጽ / Front & Back ID)*\n` +
        `⛪ *መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን*\n` +
        `═══════════════════════\n` +
        `🆔 *የተማሪ መታወቂያ:* \`${code}\`\n` +
        `👤 *ስም (Name):* ${student.fullNameAm || student.fullNameEn || student.nameAm || 'ተማሪ'}\n` +
        `✝️ *የክርስትና ስም:* ${student.christianName || 'N/A'}\n` +
        `📞 *ስልክ (Phone):* ${student.phone || 'N/A'}\n` +
        `⛪ *ክፍል (Dept):* ${student.department || 'N/A'}\n` +
        `═══════════════════════\n` +
        `📲 በመገኘት ሰዓት የፊት ገጹን QR ኮድ ለአስተዳዳሪው ያሳዩ።`;

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚀 ሙሉ ዲጂታል ካርድ በዌብ አፕ ክፈት', url: telegramWebAppUrl }]
          ]
        }
      };

      try {
        const { front, back } = await renderDualIdCardPngs({
          code,
          fullNameAm: student.fullNameAm || student.nameAm,
          fullNameEn: student.fullNameEn || student.nameEn,
          department: student.department,
          phone: student.phone,
          photoUrl: student.photoUrl,
          gender: student.gender,
          bloodGroup: student.bloodGroup,
          registeredDate: student.registeredDate || student.approvedAt || student.submittedAt,
          subcity: student.subcity || student.address,
          emergencyContact: student.emergencyContact,
          emergencyName: student.emergencyName,
          emergencyPhone: student.emergencyPhone,
          emergencyRelation: student.emergencyRelation,
        });

        // Send both Front and Back PNG cards together in one media group
        const mediaForm = new FormData();
        mediaForm.append('chat_id', String(chatId));
        mediaForm.append('front_card', new Blob([new Uint8Array(front)], { type: 'image/png' }), `${code}_front.png`);
        mediaForm.append('back_card', new Blob([new Uint8Array(back)], { type: 'image/png' }), `${code}_back.png`);
        mediaForm.append(
          'media',
          JSON.stringify([
            {
              type: 'photo',
              media: 'attach://front_card',
              caption,
              parse_mode: 'Markdown',
            },
            {
              type: 'photo',
              media: 'attach://back_card',
            },
          ])
        );

        const groupRes = await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, {
          method: 'POST',
          body: mediaForm,
        });
        const groupData: any = await groupRes.json();

        if (!groupData.ok) {
          console.warn('sendMediaGroup fallback to sequential sendPhoto:', groupData);
          const f1 = new FormData();
          f1.append('chat_id', String(chatId));
          f1.append('photo', new Blob([new Uint8Array(front)], { type: 'image/png' }), `${code}_front.png`);
          f1.append('caption', caption);
          f1.append('parse_mode', 'Markdown');
          await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: f1 });

          const f2 = new FormData();
          f2.append('chat_id', String(chatId));
          f2.append('photo', new Blob([new Uint8Array(back)], { type: 'image/png' }), `${code}_back.png`);
          f2.append('caption', `🪪 የጀርባ ገጽ (Back Side) · \`${code}\``);
          f2.append('parse_mode', 'Markdown');
          f2.append('reply_markup', JSON.stringify(keyboard.reply_markup));
          await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: f2 });
        } else {
          await dispatchSendMessage(chatId, `🪪 የእርስዎ ባለ 2-ጎን መታወቂያ (\`${code}\`) ከላይ ተልኳል።`, keyboard);
        }
      } catch (err) {
        console.warn('Dual ID card render failed, fallback to QR image:', err);
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
          await dispatchSendMessage(chatId, caption, keyboard);
        }
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
      const seenIds = new Set<string>();
      const rawRecords: any[] = [];

      const byTgSnap = await db.collection('attendance')
        .where('telegramId', '==', String(telegramId))
        .limit(50)
        .get();
      for (const d of byTgSnap.docs) {
        if (!seenIds.has(d.id)) {
          seenIds.add(d.id);
          rawRecords.push({ id: d.id, ...d.data() });
        }
      }

      if (studentCode) {
        const byCodeSnap = await db.collection('attendance')
          .where('memberCode', '==', studentCode)
          .limit(50)
          .get();
        for (const d of byCodeSnap.docs) {
          if (!seenIds.has(d.id)) {
            seenIds.add(d.id);
            rawRecords.push({ id: d.id, ...d.data() });
          }
        }
      }

      records = rawRecords.sort(
        (a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
      );
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

  // 6. ✉️ LEAVE REQUEST WIZARD
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

  // 7. ✏️ EDIT REGISTRATION / PROFILE
  if (['✏️ መረጃ አስተካክል', '✏️ Edit Registration', 'መረጃ አስተካክል', '/edit'].includes(text)) {
    await sendEditFieldMenu(chatId, telegramId, username);
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
      `👉 መረጃ ለማስተካከል *"✏️ መረጃ አስተካክል"* የሚለውን ይጫኑ።\n` +
      `👉 መታወቂያዎን ለማውረድ *"👤 የኔ መታወቂያና QR"* የሚለውን ይጫኑ።`,
      mainMenuKeyboard
    );
  }
}

async function sendEditFieldMenu(chatId: number | string, telegramId: number, username?: string) {
  const match = await findUserRegistrationOrStudent(telegramId, username);
  if (!match || match.data?.status === 'deleted') {
    await dispatchSendMessage(
      chatId,
      '⚠️ የሚስተካከል የተማሪ ምዝገባ አልተገኘም። እባክዎ መጀመሪያ *"📝 የተማሪ ምዝገባ"* የሚለውን በመጫን ይመዝገቡ ወይም ስልክ ቁጥርዎን ይላኩ።',
      mainMenuKeyboard
    );
    return;
  }

  const reg = match.data;
  const isApproved = reg.status === 'approved' || reg.status === 'active';

  if (isApproved) {
    if (reg.hasEditedProfileOnce) {
      await dispatchSendMessage(
        chatId,
        '⚠️ የመረጃ ማስተካከያ እድልዎን (1 ጊዜ) አስቀድመው ተጠቅመዋል። ተጨማሪ ለውጥ ካስፈለገ *"💬 ድጋፍና እርዳታ"* በመጫን አስተዳዳሪን ያነጋግሩ።',
        mainMenuKeyboard
      );
      return;
    }

    await dispatchSendMessage(
      chatId,
      `✏️ *የጸደቀ መገለጫ ማስተካከያ (1-Time Self-Edit)*\n` +
      `🆔 *መታወቂያ:* \`${reg.studentCode || reg.code || ''}\`\n\n` +
      `ከጸደቀ በኋላ *ስልክ ቁጥር* ወይም *የትውልድ ዘመን* (1 ጊዜ ብቻ) ማስተካከል ይችላሉ፤ ለውጡ በአስተዳዳሪ ዳግም ይጸድቃል።\n` +
      `የቱን ማስተካከል ይፈልጋሉ?`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📱 ስልክ ቁጥር (Phone)', callback_data: 'edit_field:phone' },
              { text: '📅 የትውልድ ዘመን (Birth Year)', callback_data: 'edit_field:birthDate' },
            ],
          ],
        },
      }
    );
    return;
  }

  await dispatchSendMessage(
    chatId,
    `✏️ *የምዝገባ መረጃ ማስተካከያ (Edit Registration)*\n` +
    `👤 *ስም:* ${reg.fullNameAm || reg.fullNameEn || 'ተማሪ'}\n` +
    `📱 *ስልክ:* ${reg.phone || 'N/A'}\n\n` +
    `ማስተካከል የሚፈልጉትን መረጃ ከታች ይምረጡ፦`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '👤 ሙሉ ስም', callback_data: 'edit_field:fullName' },
            { text: '✝️ የክርስትና ስም', callback_data: 'edit_field:christianName' },
          ],
          [
            { text: '⚧ ጾታ', callback_data: 'edit_field:gender' },
            { text: '📅 የትውልድ ዘመን', callback_data: 'edit_field:birthDate' },
          ],
          [
            { text: '📱 ስልክ ቁጥር', callback_data: 'edit_field:phone' },
            { text: '📍 አድራሻ', callback_data: 'edit_field:address' },
          ],
          [
            { text: '🛡️ የተጠሪ ስም', callback_data: 'edit_field:emergencyName' },
            { text: '📞 የተጠሪ ስልክ', callback_data: 'edit_field:emergencyPhone' },
          ],
          [
            { text: '⛪ ክፍል (Dept)', callback_data: 'edit_field:department' },
            { text: '📸 ፎቶ (Photo)', callback_data: 'edit_field:photo' },
          ],
          [{ text: '🔄 ሁሉንም 10 ደረጃዎች እንደገና ሙላ', callback_data: 'edit_field:redo_all' }],
        ],
      },
    }
  );
}

async function startFieldEditPrompt(chatId: number | string, telegramId: number, username: string, field: string) {
  const match = await findUserRegistrationOrStudent(telegramId, username);
  if (!match || match.data?.status === 'deleted') {
    await dispatchSendMessage(chatId, '⚠️ የሚስተካከል ምዝገባ አልተገኘም።', mainMenuKeyboard);
    return;
  }

  const reg = match.data;
  const isApproved = reg.status === 'approved' || reg.status === 'active';
  const collectionName = match.type === 'student' ? 'students' : 'registrations';

  if (field === 'redo_all' && !isApproved) {
    await setSession(telegramId, { action: 'register', step: 'name', data: {} });
    await dispatchSendMessage(
      chatId,
      '📝 *የተማሪ ምዝገባ (Step 1/10)*\nእባክዎ አዲሱን ሙሉ ስምዎን ያስገቡ፦',
      cancelKeyboard
    );
    return;
  }

  if (isApproved) {
    if (reg.hasEditedProfileOnce) {
      await dispatchSendMessage(chatId, '⚠️ የ1 ጊዜ ማስተካከያ እድልዎን አስቀድመው ተጠቅመዋል።', mainMenuKeyboard);
      return;
    }
    if (field !== 'phone' && field !== 'birthDate') {
      await dispatchSendMessage(chatId, '⚠️ ከጸደቀ በኋላ ስልክ ቁጥር ወይም የትውልድ ዘመን ብቻ ማስተካከል ይቻላል።', mainMenuKeyboard);
      return;
    }
  }

  await setSession(telegramId, {
    action: 'edit',
    step: field,
    data: { docId: reg.id, collectionName, isApprovedEdit: isApproved },
  });

  if (field === 'gender') {
    await dispatchSendMessage(chatId, '👤 *አዲስ ጾታ ይምረጡ፦*', {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [[{ text: 'ወንድ (Male)' }, { text: 'ሴት (Female)' }], [{ text: '❌ Cancel (ይቅር)' }]],
        resize_keyboard: true,
      },
    });
    return;
  }

  if (field === 'department') {
    await dispatchSendMessage(chatId, '⛪ *አዲስ ክፍል ይምረጡ፦*', {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [{ text: 'ትምህርት ክፍል (Education)' }, { text: 'መዝሙር ክፍል (Choir)' }],
          [{ text: 'ኪነ-ጥበብ ክፍል (Arts)' }, { text: 'አብነት ክፍል (Abnet)' }],
          [{ text: 'ስነ-ስርዓት ክፍል (Discipline)' }, { text: 'አጠቃላይ አባል (General)' }],
          [{ text: '❌ Cancel (ይቅር)' }],
        ],
        resize_keyboard: true,
      },
    });
    return;
  }

  const promptMap: Record<string, string> = {
    fullName: '👤 *አዲስ ሙሉ ስም ያስገቡ፦*',
    christianName: '✝️ *አዲስ የክርስትና ስም ያስገቡ፦*',
    birthDate: '📅 *አዲስ የትውልድ ዘመን ያስገቡ፦* (ምሳሌ፡ 1995)',
    phone: '📱 *አዲስ ስልክ ቁጥር ያስገቡ፦* (ምሳሌ፡ 0911234567)',
    address: '📍 *አዲስ የመኖሪያ አድራሻ ያስገቡ፦*',
    emergencyName: '🛡️ *አዲስ የቅርብ ተጠሪ ስም ያስገቡ፦*',
    emergencyPhone: '📞 *አዲስ የቅርብ ተጠሪ ስልክ ቁጥር ያስገቡ፦*',
    photo: '📸 *አዲስ ፎቶ ይላኩ (ከ 5MB ያልበለጠ) ወይም "None" ብለው ይጻፉ፦*',
  };

  await dispatchSendMessage(chatId, promptMap[field] || '✏️ *አዲሱን መረጃ ያስገቡ፦*', cancelKeyboard);
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

  // Clean initialization: Drop webhook and acknowledge backlog to prevent replaying old messages on restart
  try {
    await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`);
    const initRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=-1&limit=1`);
    const initData: any = await initRes.json();
    if (initData.ok && Array.isArray(initData.result) && initData.result.length > 0) {
      currentOffset = initData.result[initData.result.length - 1].update_id + 1;
      console.log(`🤖 Telegram polling offset synced to ${currentOffset}`);
    }
  } catch (initErr) {
    console.warn('Telegram polling offset init notice:', initErr);
  }

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
            currentOffset = Math.max(currentOffset, update.update_id + 1);
            try {
              await handleTelegramUpdate(update);
            } catch (err) {
              console.error('Error processing update in bot:', err);
            }
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

// Start polling on startup only in production to prevent multiple instances from processing the same updates
if (token && !token.startsWith('PASTE_')) {
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_BOT_POLLING === 'true') {
    startPolling().catch((err) => console.error('Failed to start Telegram polling:', err));
  } else {
    console.log('ℹ️ Telegram bot polling is disabled in development mode (NODE_ENV != production). Set ENABLE_BOT_POLLING=true to override.');
  }
}
