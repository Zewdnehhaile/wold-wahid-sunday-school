import { db, collection, getDocs, addDoc, query, limit } from '../firebase';

export const TELEGRAM_BOT_TOKEN =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_TELEGRAM_BOT_TOKEN) ||
  '8611581813:AAHadIUrYIkmVzz90WfvcpTduj-ubCZCL8w';

export interface TelegramSendResult {
  ok: boolean;
  chatId: string;
  error?: string;
  messageId?: number;
}

export interface BroadcastResult {
  total: number;
  delivered: number;
  failed: number;
  details: TelegramSendResult[];
}

/**
 * Send a direct Telegram message via Telegram Bot API with Markdown fallback.
 */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options?: { parseMode?: 'Markdown' | 'HTML' }
): Promise<TelegramSendResult> {
  const cleanChatId = String(chatId).trim();
  if (!cleanChatId || cleanChatId === 'undefined' || cleanChatId === 'null') {
    return { ok: false, chatId: cleanChatId, error: 'Invalid chat ID' };
  }

  const endpoint = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const payload: any = {
      chat_id: cleanChatId,
      text: text,
    };
    if (options?.parseMode) {
      payload.parse_mode = options.parseMode;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (data.ok) {
      return { ok: true, chatId: cleanChatId, messageId: data.result?.message_id };
    }

    if (options?.parseMode && data.description && data.description.includes("can't parse entities")) {
      const fallbackResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cleanChatId,
          text: text.replace(/[*_`\[\]]/g, ''),
        }),
      });
      const fallbackData = await fallbackResponse.json();
      if (fallbackData.ok) {
        return { ok: true, chatId: cleanChatId, messageId: fallbackData.result?.message_id };
      }
      return { ok: false, chatId: cleanChatId, error: fallbackData.description || 'Failed on fallback' };
    }

    return { ok: false, chatId: cleanChatId, error: data.description || 'Unknown Telegram error' };
  } catch (err: any) {
    return { ok: false, chatId: cleanChatId, error: err?.message || 'Network error' };
  }
}

function extractCleanTgId(val: any): string | null {
  if (!val) return null;
  const str = String(val).replace(/\D/g, '').trim();
  return str.length >= 6 ? str : null;
}

/**
 * Collect unique Telegram Chat IDs using cached subscribers + optional limit(200) fallback.
 */
export async function collectAllTelegramIds(knownMembers?: Array<{ telegramId?: string | number }>): Promise<string[]> {
  const idSet = new Set<string>();

  if (knownMembers && knownMembers.length > 0) {
    knownMembers.forEach((m) => {
      const id = extractCleanTgId(m.telegramId);
      if (id) idSet.add(id);
    });
  }

  // Use 30-minute cached bot_subscribers to keep Firestore reads low
  try {
    const cachedRaw = localStorage.getItem('ww_tg_subs_cache');
    const lastAt = Number(localStorage.getItem('ww_tg_subs_fetch_at') || '0');
    if (cachedRaw && Date.now() - lastAt < 30 * 60 * 1000) {
      const cachedIds: string[] = JSON.parse(cachedRaw);
      cachedIds.forEach((id) => idSet.add(id));
      return Array.from(idSet);
    }
  } catch {}

  try {
    const subsSnap = await getDocs(query(collection(db, 'bot_subscribers'), limit(200))).catch(() => null);
    const subIds: string[] = [];
    subsSnap?.docs.forEach((d) => {
      const a = extractCleanTgId(d.id);
      const b = extractCleanTgId(d.data().chatId);
      const c = extractCleanTgId(d.data().telegramId);
      [a, b, c].forEach((val) => {
        if (val) {
          idSet.add(val);
          subIds.push(val);
        }
      });
    });

    // Only read students/registrations if knownMembers wasn't passed
    if (!knownMembers || knownMembers.length === 0) {
      const [studentsSnap, regSnap] = await Promise.all([
        getDocs(query(collection(db, 'students'), limit(250))).catch(() => null),
        getDocs(query(collection(db, 'registrations'), limit(100))).catch(() => null),
      ]);
      studentsSnap?.docs.forEach((d) => {
        const data = d.data();
        const id = extractCleanTgId(data.telegramId || data.tgId || data.chatId);
        if (id) idSet.add(id);
      });
      regSnap?.docs.forEach((d) => {
        const data = d.data();
        const id = extractCleanTgId(data.telegramId || data.tgId || data.chatId);
        if (id) idSet.add(id);
      });
    }

    try {
      localStorage.setItem('ww_tg_subs_cache', JSON.stringify(Array.from(new Set(subIds))));
      localStorage.setItem('ww_tg_subs_fetch_at', String(Date.now()));
    } catch {}
  } catch {}

  return Array.from(idSet);
}

export interface BroadcastTargetOptions {
  explicitTelegramIds?: string[];
  knownMembers?: Array<{ telegramId?: string | number }>;
  audienceLabel?: string;
}

/**
 * Broadcast an announcement message to all or targeted Telegram users.
 */
export async function broadcastTelegramMessage(
  messageContent: string,
  title?: string,
  senderName?: string,
  targetOptions?: BroadcastTargetOptions
): Promise<BroadcastResult> {
  const targetIds = targetOptions?.explicitTelegramIds
    ? Array.from(new Set(targetOptions.explicitTelegramIds.map(extractCleanTgId).filter(Boolean) as string[]))
    : await collectAllTelegramIds(targetOptions?.knownMembers);

  const audienceLine = targetOptions?.audienceLabel
    ? `🎯 *ተቀባይ:* ${targetOptions.audienceLabel}\n`
    : '';

  const formattedMsg =
    `📢 *አዲስ ማስታወቂያ (Announcement)*\n` +
    `⛪ *መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን*\n` +
    `═══════════════════════\n\n` +
    `📌 *${title || 'የወልደ ዋሕድ ሰንበት ት/ቤት ማስታወቂያ'}*\n` +
    audienceLine +
    `\n${messageContent}\n\n` +
    `═══════════════════════\n` +
    `✍️ የላከው: *${senderName || 'አስተዳዳሪ'}*\n` +
    `⏰ ሰዓት: ${new Date().toLocaleTimeString('am-ET', { hour: '2-digit', minute: '2-digit' })}`;

  const results: TelegramSendResult[] = [];
  let delivered = 0;
  let failed = 0;

  for (const chatId of targetIds) {
    try {
      const res = await sendTelegramMessage(chatId, formattedMsg, { parseMode: 'Markdown' });
      results.push(res);
      if (res.ok) {
        delivered++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return {
    total: targetIds.length,
    delivered,
    failed,
    details: results,
  };
}

export interface LeaveDecisionPayload {
  telegramId?: string | number;
  studentName?: string;
  requestNumber?: string;
  leaveType?: string;
  duration?: string;
  status: 'approved' | 'rejected';
  reason?: string;
  approvedBy?: string;
}

/**
 * Dispatch leave request approval or rejection directly to the student on Telegram.
 */
export async function sendLeaveDecisionTelegram(payload: LeaveDecisionPayload): Promise<TelegramSendResult> {
  if (!payload.telegramId) {
    return { ok: false, chatId: '', error: 'No Telegram ID provided' };
  }

  const isApproved = payload.status === 'approved';
  const statusAm = isApproved ? '✅ ጸድቋል (Approved)' : '❌ አልተቀበለም (Rejected)';

  const text =
    `✉️ *የፈቃድ ጥያቄ ውሳኔ (Leave Request Update)*\n` +
    `⛪ *መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን*\n` +
    `═══════════════════════\n\n` +
    `👤 *ተማሪ:* ${payload.studentName || 'ተማሪ'}\n` +
    `📋 *የፈቃድ ቁጥር:* \`${payload.requestNumber || 'LV-N/A'}\`\n` +
    `🏷️ *ዓይነት:* ${payload.leaveType || 'ፈቃድ'}\n` +
    `⏱️ *የቆይታ ጊዜ:* ${payload.duration || 'N/A'}\n\n` +
    `🟢 *የተሰጠው ውሳኔ:* *${statusAm}*\n` +
    `✍️ *የወሰነው:* ${payload.approvedBy || 'አስተዳዳሪ'}\n` +
    `📝 *አስተያየት/ምክንያት:* ${payload.reason || (isApproved ? 'የቀረበው የፈቃድ ጥያቄ ተቀባይነት አግኝቷል።' : 'የቀረበው ምክንያት በቂ ባለመሆኑ አልተፈቀደም።')}\n\n` +
    `═══════════════════════\n` +
    (isApproved
      ? `እግዚአብሔር አምላክ በሰላም ያስፈጽምዎ/ይመልስዎ!`
      : `ለበለጠ መረጃ የሰንበት ት/ቤቱን ክፍል ኃላፊ በአካል ማነጋገር ይችላሉ።`);

  // Record targeted notification in Firestore for in-app tracking
  await addDoc(collection(db, 'notifications'), {
    title: `✉️ የፈቃድ ጥያቄዎ (${payload.requestNumber || ''}) ${isApproved ? 'ጸድቋል' : 'አልተቀበለም'}`,
    message: payload.reason || (isApproved ? 'የፈቃድ ጥያቄዎ ጸድቋል' : 'የፈቃድ ጥያቄዎ አልተቀበለም'),
    senderName: payload.approvedBy || 'አስተዳዳሪ',
    targetTelegramId: String(payload.telegramId),
    studentName: payload.studentName || '',
    createdAt: new Date().toISOString(),
    isDirectReply: true,
  }).catch(console.warn);

  return sendTelegramMessage(payload.telegramId, text, { parseMode: 'Markdown' });
}

export interface RegistrationDecisionPayload {
  telegramId?: string | number;
  studentName: string;
  studentCode: string;
  approvedBy?: string;
}

/**
 * Dispatch registration approval with student ID directly to student on Telegram.
 */
export async function sendRegistrationApprovalTelegram(
  payload: RegistrationDecisionPayload
): Promise<TelegramSendResult> {
  if (!payload.telegramId) {
    return { ok: false, chatId: '', error: 'No Telegram ID provided' };
  }

  const text =
    `🎉 *እንኳን ደስ አለዎት! ምዝገባዎ ጸድቋል*\n` +
    `*Congratulations! Registration Approved*\n` +
    `⛪ *መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን የወልደ ዋሕድ ሰ/ት/ቤት*\n` +
    `═══════════════════════\n\n` +
    `👤 *ውድ ተማሪ:* ${payload.studentName}\n` +
    `🆔 *የተመደበ የመታወቂያ ቁጥር (Student ID):* \`${payload.studentCode}\`\n` +
    `✍️ *ያጸደቀው አስተዳዳሪ:* ${payload.approvedBy || 'አስተዳዳሪ'}\n\n` +
    `እንኳን ወደ ሰንበት ትምህርት ቤታችን በደህና መጡ! ✝️\n` +
    `አሁን በቦቱ ውስጥ "👤 የኔ መታወቂያና QR" የሚለውን በመጫን የእርስዎን የዲጂታል መታወቂያ ካርድ መቀበል ይችላሉ።`;

  return sendTelegramMessage(payload.telegramId, text, { parseMode: 'Markdown' });
}

export interface SupportReplyPayload {
  telegramId?: string | number;
  ticketNumber: string;
  requesterName?: string;
  title?: string;
  author?: string;
  replyText: string;
}

/**
 * Dispatch support ticket response directly to requester on Telegram.
 */
export async function sendSupportReplyTelegram(payload: SupportReplyPayload): Promise<TelegramSendResult> {
  if (!payload.telegramId) {
    return { ok: false, chatId: '', error: 'No Telegram ID provided' };
  }

  const text =
    `💬 *የድጋፍ ጥያቄ ምላሽ (Support Desk Response)*\n` +
    `⛪ *መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን*\n` +
    `═══════════════════════\n\n` +
    `🎫 *ቲኬት ቁጥር:* \`${payload.ticketNumber}\`\n` +
    `📌 *ርዕስ/ጉዳይ:* ${payload.title || 'የድጋፍ ጥያቄ'}\n\n` +
    `✍️ *ከአስተዳዳሪው የተላከ ምላሽ (Admin Reply):*\n` +
    `"${payload.replyText}"\n\n` +
    `👤 *ከ፡* ${payload.author || 'አስተባባሪ'}\n` +
    `⏰ *ሰዓት:* ${new Date().toLocaleTimeString('am-ET', { hour: '2-digit', minute: '2-digit' })}\n` +
    `═══════════════════════\n` +
    `እግዚአብሔር ይባርክዎ!`;

  return sendTelegramMessage(payload.telegramId, text, { parseMode: 'Markdown' });
}
