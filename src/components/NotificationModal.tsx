import React, { useState, useMemo } from 'react';
import { Send, CheckCircle2, AlertCircle, X, Megaphone, Users, Layers, GraduationCap } from 'lucide-react';
import { db, collection, addDoc } from '../firebase';
import { broadcastTelegramMessage } from '../utils/telegram';
import { Member, AdminUser } from '../types';
import { recordAuditLog } from '../utils/auditLog';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminName: string;
  currentAdmin?: AdminUser;
  members?: Member[];
}

type TargetScope = 'all' | 'grade' | 'department';

const GRADE_OPTIONS = [
  { id: 'pre_kg', label: '🧸 ቅድመ አንደኛ (Pre-KG)' },
  { id: 'grade_1_2', label: '🎒 1ኛ እና 2ኛ ክፍል' },
  { id: 'grade_3_5', label: '📚 3ኛ–5ኛ ክፍል' },
  { id: 'grade_6_9', label: '🎓 6ኛ–9ኛ ክፍል' },
  { id: 'leaders', label: '🕊️ አገልጋዮች / መምህራን' },
];

const DEPT_OPTIONS = [
  { id: 'education', label: '📖 ትምህርት ክፍል' },
  { id: 'choir', label: '🎵 መዝሙር ክፍል' },
  { id: 'abnet', label: '📜 አብነት ክፍል' },
  { id: 'arts', label: '🎨 ኪነ ጥበብ ክፍል' },
  { id: 'discipline', label: '🛡️ ስነ ስርዓት ክፍል' },
  { id: 'general', label: '🤝 አጠቃላይ' },
];

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  adminName,
  currentAdmin,
  members = [],
}) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetScope, setTargetScope] = useState<TargetScope>('all');
  const [selectedGrade, setSelectedGrade] = useState<string>('pre_kg');
  const [selectedDept, setSelectedDept] = useState<string>('education');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; text: string } | null>(null);

  const activeMembers = useMemo(
    () => members.filter((m) => m.status === 'active'),
    [members]
  );

  const targetedMembers = useMemo(() => {
    if (targetScope === 'all') return activeMembers;
    if (targetScope === 'grade') {
      return activeMembers.filter((m) => (m.gradeLevel || 'general') === selectedGrade);
    }
    return activeMembers.filter((m) => (m.department || 'education') === selectedDept);
  }, [activeMembers, targetScope, selectedGrade, selectedDept]);

  const targetedWithTelegram = useMemo(
    () => targetedMembers.filter((m) => m.telegramId && String(m.telegramId).replace(/\D/g, '').length >= 6),
    [targetedMembers]
  );

  if (!isOpen) return null;

  const audienceLabel =
    targetScope === 'all'
      ? 'ለሁሉም ተማሪዎች እና ተመዝጋቢዎች (All)'
      : targetScope === 'grade'
        ? GRADE_OPTIONS.find((g) => g.id === selectedGrade)?.label || selectedGrade
        : DEPT_OPTIONS.find((d) => d.id === selectedDept)?.label || selectedDept;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSending(true);
    setResult(null);

    try {
      const cleanTitle = title.trim() || 'ወልደ ዋሕድ ሰንበት ት/ቤት ማስታወቂያ';
      const cleanMsg = message.trim();

      // 1. Record single notification log in Firestore (1 write)
      await addDoc(collection(db, 'notifications'), {
        title: cleanTitle,
        message: cleanMsg,
        senderName: adminName || 'አስተዳዳሪ',
        targetScope,
        targetValue: targetScope === 'grade' ? selectedGrade : targetScope === 'department' ? selectedDept : 'all',
        audienceLabel,
        createdAt: new Date().toISOString(),
        isBroadcast: targetScope === 'all',
      }).catch(() => {});

      // 2. Dispatch Telegram broadcast (uses in-memory members, 0 extra Firestore student reads)
      const tgRes = await broadcastTelegramMessage(
        cleanMsg,
        cleanTitle,
        adminName || 'አስተዳዳሪ',
        targetScope === 'all'
          ? { knownMembers: members, audienceLabel: 'ለሁሉም ተማሪዎች እና ተመዝጋቢዎች' }
          : {
              explicitTelegramIds: targetedWithTelegram.map((m) => String(m.telegramId)),
              audienceLabel,
            }
      );

      // 3. Record role-scoped audit log
      if (currentAdmin) {
        recordAuditLog({
          actorId: currentAdmin.id || '',
          actorName: currentAdmin.nameAm || adminName,
          actorRole: currentAdmin.role,
          targetType: 'broadcast',
          targetName: audienceLabel,
          action: 'send_broadcast',
          summaryAm: `ማስታወቂያ ተልኳል (${audienceLabel}) — ${cleanTitle}`,
          summaryEn: `Broadcast sent (${audienceLabel}) — ${cleanTitle}`,
        });
      }

      const successNotice =
        tgRes.delivered > 0
          ? `ማስታወቂያው ለ${tgRes.delivered} የቴሌግራም ተጠቃሚዎች (${audienceLabel}) በተሳካ ሁኔታ ተልኳል!`
          : `ማስታወቂያው (${audienceLabel}) በተሳካ ሁኔታ ተመዝግቧል!`;

      setResult({
        success: true,
        text: successNotice,
      });
      setTitle('');
      setMessage('');
      setTimeout(() => {
        onClose();
        setResult(null);
      }, 2500);
    } catch {
      setResult({
        success: false,
        text: 'ማስታወቂያውን መላክ አልተቻለም። እባክዎ እንደገና ይሞክሩ።',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#09351c] border-2 border-amber-500/40 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative text-slate-100 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-amber-300">
              ማስታወቂያ መላኪያ (Targeted & Broadcast)
            </h2>
            <p className="text-xs text-emerald-200/70">
              ለሁሉም ወይም ለተወሰነ የክፍል ደረጃ / ክፍል በቀጥታ ይላኩ
            </p>
          </div>
        </div>

        {result && (
          <div
            className={`p-3.5 mb-4 rounded-xl text-xs flex items-center gap-2 border ${
              result.success
                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                : 'bg-rose-950/80 border-rose-500 text-rose-200'
            }`}
          >
            {result.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{result.text}</span>
          </div>
        )}

        <form onSubmit={handleSend} className="space-y-4">
          {/* Audience Target Selector */}
          <div className="bg-[#062414] border border-[#0f4425] rounded-2xl p-3 space-y-2.5">
            <label className="block text-[11px] font-bold text-amber-300">
              🎯 ተቀባዮችን ይምረጡ (Audience)
            </label>
            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => setTargetScope('all')}
                className={`py-2 px-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  targetScope === 'all'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'bg-[#09351c] text-emerald-200/80 border border-[#0f4425] hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>ለሁሉም (All)</span>
              </button>
              <button
                type="button"
                onClick={() => setTargetScope('grade')}
                className={`py-2 px-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  targetScope === 'grade'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'bg-[#09351c] text-emerald-200/80 border border-[#0f4425] hover:text-white'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>በክፍል ደረጃ</span>
              </button>
              <button
                type="button"
                onClick={() => setTargetScope('department')}
                className={`py-2 px-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  targetScope === 'department'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'bg-[#09351c] text-emerald-200/80 border border-[#0f4425] hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>በአገልግሎት ክፍል</span>
              </button>
            </div>

            {targetScope === 'grade' && (
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="w-full px-3 py-2 bg-[#09351c] border border-[#0f4425] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
              >
                {GRADE_OPTIONS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            )}

            {targetScope === 'department' && (
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full px-3 py-2 bg-[#09351c] border border-[#0f4425] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
              >
                {DEPT_OPTIONS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            )}

            <div className="text-[11px] text-emerald-300/80 flex items-center justify-between pt-0.5">
              <span>የተመረጠው: <strong className="text-amber-300">{audienceLabel}</strong></span>
              <span className="font-mono text-emerald-400">
                {targetScope === 'all'
                  ? `${targetedWithTelegram.length}+ ተማሪዎች`
                  : `${targetedWithTelegram.length} / ${targetedMembers.length} በቴሌግራም`}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-emerald-100 mb-1">
              የማስታወቂያው ርዕስ (Title)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ምሳሌ፡ የሳምንቱ የእሁድ ትምህርት መርሐ ግብር ማሳሰቢያ"
              className="w-full px-3.5 py-2.5 bg-[#062414] border border-[#0f4425] rounded-xl text-xs text-white placeholder-emerald-700/60 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-emerald-100 mb-1">
              የማስታወቂያው ዝርዝር መልእክት (Message) *
            </label>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="መልእክትዎን እዚህ ይጻፉ... (በቴሌግራም ቦት በቀጥታ ይደርሳል)"
              className="w-full px-3.5 py-2.5 bg-[#062414] border border-[#0f4425] rounded-xl text-xs text-white placeholder-emerald-700/60 focus:outline-none focus:border-amber-400 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-white/5 transition-colors cursor-pointer"
            >
              ይቅር (Cancel)
            </button>
            <button
              type="submit"
              disabled={isSending || !message.trim()}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? 'እየተላከ ነው...' : targetScope === 'all' ? 'ለሁሉም ላክ (Broadcast)' : 'ለተመረጡት ላክ'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
