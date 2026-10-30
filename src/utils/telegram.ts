import { db } from '../firebase';
import { collection, getDocs, addDoc } from 'firebase/firestore';

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
    // 1. Try sending with requested parse mode
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

    // 2. If Markdown formatting error (status 400), retry as clean plain text
    if (options?.parseMode && data.description && data.description.includes("can't parse entities")) {
      console.warn(`Telegram markdown parse error for ${cleanChatId}. Retrying as plain text...`);
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
    console.error(`Telegram API network error for chat ${cleanChatId}:`, err);
    return { ok: false, chatId: cleanChatId, error: err?.message || 'Network error' };
  }
}

/**
 * Collect all active unique Telegram Chat IDs from Firestore.
 */
export async function collectAllTelegramIds(): Promise<string[]> {
  const idSet = new Set<string>();

  const extractId = (val: any) => {
    if (!val) return;
    const str = String(val).replace(/\D/g, '').trim();
    if (str.length >= 6) {
      idSet.add(str);
    }
  };

  try {
    const [subsSnap, studentsSnap, regSnap, leaveSnap, ticketSnap] = await Promise.all([
      getDocs(collection(db, 'bot_subscribers')).catch(() => null),
      getDocs(collection(db, 'students')).catch(() => null),
      getDocs(collection(db, 'registrations')).catch(() => null),
      getDocs(collection(db, 'leave_requests')).catch(() => null),
      getDocs(collection(db, 'support_tickets')).catch(() => null),
    ]);

    subsSnap?.docs.forEach((d) => {
      extractId(d.id);
      extractId(d.data().chatId);
      extractId(d.data().telegramId);
    });

    studentsSnap?.docs.forEach((d) => {
      const data = d.data();
      extractId(data.telegramId);
      extractId(data.tgId);
      extractId(data.chatId);
    });

    regSnap?.docs.forEach((d) => {
      const data = d.data();
      extractId(data.telegramId);
      extractId(data.tgId);
      extractId(data.chatId);
    });

    leaveSnap?.docs.forEach((d) => {
      const data = d.data();
      extractId(data.telegramId);
      extractId(data.chatId);
    });

    ticketSnap?.docs.forEach((d) => {
      const data = d.data();
      extractId(data.telegramId);
      extractId(data.chatId);
    });
  } catch (e) {
    console.warn('Error reading Telegram IDs from Firestore:', e);
  }

  return Array.from(idSet);
}

/**
 * Broadcast an announcement message to all known Telegram users.
 */
export async function broadcastTelegramMessage(
  messageContent: string,
  title?: string,
  senderName?: string
): Promise<BroadcastResult> {
  const targetIds = await collectAllTelegramIds();

  const formattedMsg =
    `📢 *አዲስ ማስታወቂያ (Announcement)*\n` +
    `⛪ *መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን*\n` +
    `═══════════════════════\n\n` +
    `📌 *${title || 'የወልደ ዋሕድ ሰንበት ት/ቤት ማስታወቂያ'}*\n\n` +
    `${messageContent}\n\n` +
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
