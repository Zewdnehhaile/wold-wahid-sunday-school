import React, { useState, useEffect } from 'react';
import { DutyRosterItem, DayOfWeek, GradeLevel, AdminUser } from '../types';
import { db, doc, getDoc, setDoc } from '../firebase';
import { recordAuditLog } from '../utils/auditLog';
import { ShieldCheck, Plus, Trash2, Check, X, UserCheck } from 'lucide-react';

interface DutyRosterPanelProps {
  currentAdmin?: AdminUser;
}

const CACHE_KEY = 'ww_duty_roster_cache';
const FETCH_AT_KEY = 'ww_duty_roster_fetch_at';
const CACHE_TTL_MS = 20 * 60 * 1000;

const DEFAULT_ROSTER: DutyRosterItem[] = [
  { id: 'dr-1', day: 'sunday', gradeLevel: 'pre_kg', dutyAm: 'ጸሎት መክፈቻና ስነ ስርዓት', assigneeName: 'ስነ ስርዓት ክፍል' },
  { id: 'dr-2', day: 'sunday', gradeLevel: 'grade_1_2', dutyAm: 'ትምህርት', assigneeName: 'ትምህርት ክፍል' },
  { id: 'dr-3', day: 'sunday', gradeLevel: 'grade_3_5', dutyAm: 'መዝሙር እና ወረብ', assigneeName: 'መዝሙር ክፍል' },
  { id: 'dr-4', day: 'sunday', gradeLevel: 'all', dutyAm: 'QR ስካነር ተረኛ', assigneeName: 'አስተባባሪ' },
];

const DUTY_PRESETS = [
  'ጸሎት መክፈቻ',
  'ትምህርት',
  'መዝሙር',
  'አብነት',
  'ኪነ ጥበብ',
  'QR ስካነር ተረኛ',
  'ስነ ስርዓት ተቆጣጣሪ',
];

export const DutyRosterPanel: React.FC<DutyRosterPanelProps> = ({ currentAdmin }) => {
  const [items, setItems] = useState<DutyRosterItem[]>(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return DEFAULT_ROSTER;
  });

  const [dayFilter, setDayFilter] = useState<DayOfWeek | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formDay, setFormDay] = useState<DayOfWeek>('sunday');
  const [formGrade, setFormGrade] = useState<GradeLevel | 'all'>('all');
  const [formDuty, setFormDuty] = useState('QR ስካነር ተረኛ');
  const [formAssignee, setFormAssignee] = useState('');
  const [formPhone, setFormPhone] = useState('');

  // Single-document load with 20-min cache (max 1 Firestore read)
  useEffect(() => {
    try {
      const last = Number(localStorage.getItem(FETCH_AT_KEY) || '0');
      if (localStorage.getItem(CACHE_KEY) && Date.now() - last < CACHE_TTL_MS) {
        return;
      }
    } catch {}

    let active = true;
    getDoc(doc(db, 'app_settings', 'duty_roster'))
      .then((snap) => {
        if (!active) return;
        if (snap.exists() && Array.isArray(snap.data()?.items)) {
          const loaded = snap.data().items as DutyRosterItem[];
          setItems(loaded);
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(loaded));
            localStorage.setItem(FETCH_AT_KEY, String(Date.now()));
          } catch {}
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const persistRoster = async (nextItems: DutyRosterItem[], actionSummaryAm: string, targetName: string) => {
    setItems(nextItems);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(nextItems));
      localStorage.setItem(FETCH_AT_KEY, String(Date.now()));
    } catch {}

    try {
      await setDoc(doc(db, 'app_settings', 'duty_roster'), {
        items: nextItems,
        updatedAt: new Date().toISOString(),
      });
    } catch {}

    if (currentAdmin) {
      recordAuditLog({
        actorId: currentAdmin.id || '',
        actorName: currentAdmin.nameAm || 'አስተዳዳሪ',
        actorRole: currentAdmin.role,
        targetType: 'roster',
        targetName,
        action: 'update_duty_roster',
        summaryAm: actionSummaryAm,
        summaryEn: `Updated duty roster: ${targetName}`,
      });
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAssignee.trim() || !formDuty.trim()) return;

    const newItem: DutyRosterItem = {
      id: `dr-${Date.now()}`,
      day: formDay,
      gradeLevel: formGrade,
      dutyAm: formDuty.trim(),
      assigneeName: formAssignee.trim(),
      assigneePhone: formPhone.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };

    await persistRoster(
      [newItem, ...items],
      `የተረኛ ምደባ ተጨምሯል: ${newItem.assigneeName} (${newItem.dutyAm})`,
      `${newItem.assigneeName} - ${newItem.dutyAm}`
    );

    setFormAssignee('');
    setFormPhone('');
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    const target = items.find((i) => i.id === id);
    const next = items.filter((i) => i.id !== id);
    await persistRoster(
      next,
      `የተረኛ ምደባ ተሰርዟል: ${target?.assigneeName || id}`,
      target?.assigneeName || id
    );
  };

  const getDayLabel = (d: DayOfWeek) => (d === 'friday' ? 'አርብ' : d === 'saturday' ? 'ቅዳሜ' : 'እሁድ');
  const getGradeLabel = (g: GradeLevel | 'all') => {
    switch (g) {
      case 'pre_kg': return 'ቅድመ አንደኛ';
      case 'grade_1_2': return '1ኛ–2ኛ ክፍል';
      case 'grade_3_5': return '3ኛ–5ኛ ክፍል';
      case 'grade_6_9': return '6ኛ–9ኛ ክፍል';
      case 'leaders': return 'አገልጋዮች';
      default: return 'ሁሉም ክፍሎች';
    }
  };

  const filtered = items.filter((i) => dayFilter === 'all' || i.day === dayFilter);

  return (
    <div className="space-y-4">
      <div className="bg-[#09351c] border border-[#0f4425] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-amber-400" />
            <span>የአገልግሎት ተረኛ አስተባባሪዎች መዝገብ ({items.length})</span>
          </h3>
          <p className="text-xs text-emerald-200/75 mt-1">
            አስተዳዳሪዎች ለአርብ፣ ለቅዳሜና ለእሁድ ክፍለ-ጊዜዎች ተረኛ አገልጋዮችን መመደብ ይችላሉ
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>ተረኛ አገልጋይ መድብ</span>
        </button>
      </div>

      <div className="flex items-center gap-2 bg-[#09351c] p-2.5 rounded-2xl border border-[#0f4425]">
        {[
          { id: 'all' as const, label: 'ሁሉም ቀናት' },
          { id: 'friday' as const, label: '📅 አርብ' },
          { id: 'saturday' as const, label: '📅 ቅዳሜ' },
          { id: 'sunday' as const, label: '📅 እሁድ' },
        ].map((d) => (
          <button
            key={d.id}
            onClick={() => setDayFilter(d.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              dayFilter === d.id
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-[#062414] text-emerald-200/80 border border-[#0f4425] hover:text-white'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="p-10 text-center bg-[#09351c] border border-[#0f4425] rounded-2xl text-xs text-emerald-200/70">
          በተመረጠው ቀን የተመደበ ተረኛ የለም።
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-2xl bg-[#09351c] border border-[#0f4425] hover:border-amber-500/40 transition-all flex items-start justify-between gap-3 shadow"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    📅 {getDayLabel(item.day)}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                    {getGradeLabel(item.gradeLevel)}
                  </span>
                </div>
                <div className="text-sm font-bold text-white">{item.assigneeName}</div>
                <div className="text-xs text-amber-400 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{item.dutyAm}</span>
                </div>
                {item.assigneePhone && (
                  <div className="text-[11px] font-mono text-emerald-200/70">{item.assigneePhone}</div>
                )}
              </div>

              <button
                onClick={() => handleDelete(item.id)}
                className="p-1.5 rounded-lg text-rose-400/80 hover:text-rose-400 hover:bg-rose-950/60 transition-colors cursor-pointer"
                title="ሰርዝ"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#09351c] border border-[#0f4425] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 bg-[#062414] border-b border-[#0f4425] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-amber-400" />
                <span>ተረኛ አገልጋይ መመደቢያ</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-emerald-200/70 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-emerald-200/80 font-medium mb-1">ቀን (Day)</label>
                  <select
                    value={formDay}
                    onChange={(e) => setFormDay(e.target.value as DayOfWeek)}
                    className="w-full bg-[#062414] border border-[#0f4425] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="friday">አርብ</option>
                    <option value="saturday">ቅዳሜ</option>
                    <option value="sunday">እሁድ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-emerald-200/80 font-medium mb-1">የክፍል ደረጃ</label>
                  <select
                    value={formGrade}
                    onChange={(e) => setFormGrade(e.target.value as GradeLevel | 'all')}
                    className="w-full bg-[#062414] border border-[#0f4425] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="all">ሁሉም ክፍሎች</option>
                    <option value="pre_kg">ቅድመ አንደኛ</option>
                    <option value="grade_1_2">1ኛ–2ኛ ክፍል</option>
                    <option value="grade_3_5">3ኛ–5ኛ ክፍል</option>
                    <option value="grade_6_9">6ኛ–9ኛ ክፍል</option>
                    <option value="leaders">አገልጋዮች</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-emerald-200/80 font-medium mb-1">የአገልግሎት ድርሻ (Duty) *</label>
                <select
                  value={formDuty}
                  onChange={(e) => setFormDuty(e.target.value)}
                  className="w-full bg-[#062414] border border-[#0f4425] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                >
                  {DUTY_PRESETS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-emerald-200/80 font-medium mb-1">የተመደበው አገልጋይ / ክፍል ስም *</label>
                <input
                  type="text"
                  required
                  value={formAssignee}
                  onChange={(e) => setFormAssignee(e.target.value)}
                  placeholder="ምሳሌ፡ ዲ/ን ዳዊት ተስፋዬ"
                  className="w-full bg-[#062414] border border-[#0f4425] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-emerald-200/80 font-medium mb-1">ስልክ ቁጥር (አማራጭ)</label>
                <input
                  type="tel"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="0911..."
                  className="w-full bg-[#062414] border border-[#0f4425] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="pt-3 border-t border-[#0f4425] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-emerald-200/70 hover:text-white"
                >
                  ይቅር
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>መድብ (Assign)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
