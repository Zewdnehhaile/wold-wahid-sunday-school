import React, { useState, useEffect } from 'react';
import { LessonItem, GradeLevel, AdminUser } from '../types';
import { db, collection, getDocs, addDoc, deleteDoc, doc, query, limit } from '../firebase';
import { recordAuditLog } from '../utils/auditLog';
import { BookOpen, Music, Plus, Trash2, ExternalLink, X, Check } from 'lucide-react';

interface LessonLibraryPanelProps {
  currentAdmin?: AdminUser;
}

const CACHE_KEY = 'ww_lessons_cache';
const FETCH_AT_KEY = 'ww_lessons_fetch_at';
const CACHE_TTL_MS = 20 * 60 * 1000;

export const LessonLibraryPanel: React.FC<LessonLibraryPanelProps> = ({ currentAdmin }) => {
  const [lessons, setLessons] = useState<LessonItem[]>(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [filterGrade, setFilterGrade] = useState<GradeLevel | 'all'>('all');
  const [filterType, setFilterType] = useState<'all' | 'lesson' | 'mezmur'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<'lesson' | 'mezmur'>('lesson');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel | 'all'>('all');
  const [summary, setSummary] = useState('');
  const [reference, setReference] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  useEffect(() => {
    try {
      const last = Number(localStorage.getItem(FETCH_AT_KEY) || '0');
      if (localStorage.getItem(CACHE_KEY) && Date.now() - last < CACHE_TTL_MS) {
        return;
      }
    } catch {}

    let active = true;
    getDocs(query(collection(db, 'lessons'), limit(30)))
      .then((snap) => {
        if (!active) return;
        const list: LessonItem[] = snap.docs
          .map((d: any) => ({
            id: d.id,
            title: d.data().title || '',
            type: d.data().type === 'mezmur' ? ('mezmur' as const) : ('lesson' as const),
            gradeLevel: d.data().gradeLevel || 'all',
            summary: d.data().summary || '',
            reference: d.data().reference || '',
            linkUrl: d.data().linkUrl || '',
            authorName: d.data().authorName || 'ትምህርት ክፍል',
            createdAt: d.data().createdAt || '',
          }))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

        setLessons(list);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(list));
          localStorage.setItem(FETCH_AT_KEY, String(Date.now()));
        } catch {}
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !summary.trim()) return;

    const payload = {
      title: title.trim(),
      type,
      gradeLevel,
      summary: summary.trim(),
      reference: reference.trim(),
      linkUrl: linkUrl.trim(),
      authorName: currentAdmin?.nameAm || 'ትምህርት ክፍል',
      createdAt: new Date().toISOString(),
    };

    let createdId = `les-${Date.now()}`;
    try {
      const ref = await addDoc(collection(db, 'lessons'), payload);
      if (ref?.id) createdId = ref.id;
    } catch {}

    const next = [{ id: createdId, ...payload }, ...lessons];
    setLessons(next);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(next));
      localStorage.setItem(FETCH_AT_KEY, String(Date.now()));
    } catch {}

    if (currentAdmin) {
      recordAuditLog({
        actorId: currentAdmin.id || '',
        actorName: currentAdmin.nameAm || 'አስተዳዳሪ',
        actorRole: currentAdmin.role,
        targetType: 'lesson',
        targetName: payload.title,
        action: 'add_lesson',
        summaryAm: `አዲስ ${type === 'mezmur' ? 'መዝሙር' : 'ትምህርት'} ተጨምሯል: ${payload.title}`,
        summaryEn: `Added ${type}: ${payload.title}`,
      });
    }

    setTitle('');
    setSummary('');
    setReference('');
    setLinkUrl('');
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    const next = lessons.filter((l) => l.id !== id);
    setLessons(next);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(next));
    } catch {}
    try {
      await deleteDoc(doc(db, 'lessons', id));
    } catch {}
  };

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

  const filtered = lessons.filter((l) => {
    const matchGrade = filterGrade === 'all' || l.gradeLevel === filterGrade || l.gradeLevel === 'all';
    const matchType = filterType === 'all' || l.type === filterType;
    return matchGrade && matchType;
  });

  return (
    <div className="space-y-4">
      <div className="bg-[#09351c] border border-[#0f4425] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <span>የሳምንቱ ትምህርት እና መዝሙር ማዕከል ({lessons.length})</span>
          </h3>
          <p className="text-xs text-emerald-200/75 mt-1">
            አጭር እና ግልጽ የሳምንቱ ትምህርት ማጠቃለያ፣ ጥቅስ እና መዝሙር በክፍል ደረጃ
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>አዲስ ጨምር</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#09351c] p-2.5 rounded-2xl border border-[#0f4425]">
        <div className="flex items-center gap-1.5">
          {[
            { id: 'all' as const, label: 'ሁሉም' },
            { id: 'lesson' as const, label: '📖 ትምህርት' },
            { id: 'mezmur' as const, label: '🎵 መዝሙር' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setFilterType(t.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterType === t.id
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'bg-[#062414] text-emerald-200/80 border border-[#0f4425] hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <select
          value={filterGrade}
          onChange={(e) => setFilterGrade(e.target.value as GradeLevel | 'all')}
          className="bg-[#062414] border border-[#0f4425] text-amber-300 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-400 font-medium"
        >
          <option value="all">ሁሉም ክፍሎች</option>
          <option value="pre_kg">🧸 ቅድመ አንደኛ</option>
          <option value="grade_1_2">🎒 1ኛ–2ኛ ክፍል</option>
          <option value="grade_3_5">📚 3ኛ–5ኛ ክፍል</option>
          <option value="grade_6_9">🎓 6ኛ–9ኛ ክፍል</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="p-10 text-center bg-[#09351c] border border-[#0f4425] rounded-2xl text-xs text-emerald-200/70">
          እስካሁን የተመዘገበ ትምህርት ወይም መዝሙር የለም። "አዲስ ጨምር" የሚለውን ይጫኑ።
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-2xl bg-[#09351c] border border-[#0f4425] hover:border-amber-500/40 transition-all flex flex-col justify-between gap-2.5 shadow"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                        item.type === 'mezmur'
                          ? 'bg-pink-500/15 text-pink-300 border border-pink-500/30'
                          : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                      }`}
                    >
                      {item.type === 'mezmur' ? <Music className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
                      {item.type === 'mezmur' ? 'መዝሙር' : 'ትምህርት'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#062414] text-amber-300 border border-[#0f4425]">
                      {getGradeLabel(item.gradeLevel)}
                    </span>
                  </div>

                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1 rounded-lg text-rose-400/70 hover:text-rose-400 hover:bg-rose-950/60 transition-colors cursor-pointer"
                    title="ሰርዝ"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <h4 className="text-sm font-bold text-white leading-snug">{item.title}</h4>
                <p className="text-xs text-emerald-100/80 whitespace-pre-line line-clamp-4">{item.summary}</p>
                {item.reference && (
                  <div className="text-[11px] font-semibold text-amber-300/90">📖 {item.reference}</div>
                )}
              </div>

              <div className="pt-2 border-t border-[#0f4425] flex items-center justify-between text-[10px] text-emerald-200/60">
                <span>✍️ {item.authorName}</span>
                {item.linkUrl && (
                  <a
                    href={item.linkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-amber-400 hover:underline font-semibold"
                  >
                    <span>ክፈት</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#09351c] border border-[#0f4425] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 bg-[#062414] border-b border-[#0f4425] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">አጭር ትምህርት ወይም መዝሙር ጨምር</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-emerald-200/70 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-emerald-200/80 font-medium mb-1">ዓይነት (Type)</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as 'lesson' | 'mezmur')}
                    className="w-full bg-[#062414] border border-[#0f4425] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="lesson">📖 ትምህርት</option>
                    <option value="mezmur">🎵 መዝሙር</option>
                  </select>
                </div>
                <div>
                  <label className="block text-emerald-200/80 font-medium mb-1">የክፍል ደረጃ</label>
                  <select
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value as GradeLevel | 'all')}
                    className="w-full bg-[#062414] border border-[#0f4425] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="all">ሁሉም ክፍሎች</option>
                    <option value="pre_kg">ቅድመ አንደኛ</option>
                    <option value="grade_1_2">1ኛ–2ኛ ክፍል</option>
                    <option value="grade_3_5">3ኛ–5ኛ ክፍል</option>
                    <option value="grade_6_9">6ኛ–9ኛ ክፍል</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-emerald-200/80 font-medium mb-1">ርዕስ (Title) *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="ምሳሌ፡ የዕለተ እሁድ ትምህርት / አዲስ መዝሙር"
                  className="w-full bg-[#062414] border border-[#0f4425] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-emerald-200/80 font-medium mb-1">አጭር ይዘት / ስንኝ (Short Note) *</label>
                <textarea
                  required
                  rows={3}
                  maxLength={350}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="በ2-3 መስመር አጭር ማጠቃለያ ወይም የመዝሙሩን ቃል ይጻፉ..."
                  className="w-full bg-[#062414] border border-[#0f4425] rounded-xl px-3 py-2 text-white resize-none focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-emerald-200/80 font-medium mb-1">ጥቅስ / ማጣቀሻ (አማራጭ)</label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="ዮሐ 3:16"
                    className="w-full bg-[#062414] border border-[#0f4425] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-emerald-200/80 font-medium mb-1">ሊንክ (አማራጭ)</label>
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-[#062414] border border-[#0f4425] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#0f4425] flex items-center justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-emerald-200/70 hover:text-white">
                  ይቅር
                </button>
                <button type="submit" className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow flex items-center gap-1.5 cursor-pointer">
                  <Check className="w-4 h-4" />
                  <span>አስቀምጥ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
