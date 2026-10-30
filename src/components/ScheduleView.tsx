import React, { useState, useEffect } from 'react';
import { ScheduleItem, DayOfWeek, GradeLevel, SundaySchoolDepartment, Language } from '../types';
import { WOLD_WAHID_SCHEDULE } from '../data/initialData';
import { t } from '../utils/translations';
import { db } from '../firebase';
import {
  collection,
  onSnapshot,
  setDoc,
  doc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Calendar,
  Clock,
  Printer,
  BookOpen,
  Music,
  Palette,
  Shield,
  Scroll,
  ArrowRight,
  Plus,
  Trash2,
  Edit2,
  X,
  Check,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface ScheduleViewProps {
  onSelectSessionForAttendance: (sessionName: string, grade: string) => void;
  lang: Language;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  onSelectSessionForAttendance,
  lang,
}) => {
  const [viewMode, setViewMode] = useState<'by_grade' | 'by_day'>('by_grade');
  const [activeGrade, setActiveGrade] = useState<GradeLevel>('pre_kg');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | 'all'>('all');

  // Schedules state synced with Firestore with local fallback
  const [schedules, setSchedules] = useState<ScheduleItem[]>(() => {
    const saved = localStorage.getItem('ww_schedule_data');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return WOLD_WAHID_SCHEDULE;
  });

  // Modal state for Add/Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);

  // Form State
  const [formDay, setFormDay] = useState<DayOfWeek>('sunday');
  const [formGrade, setFormGrade] = useState<GradeLevel>('pre_kg');
  const [formActivity, setFormActivity] = useState('');
  const [formTimeRange, setFormTimeRange] = useState('');
  const [formDept, setFormDept] = useState<SundaySchoolDepartment>('education');
  const [formDeptName, setFormDeptName] = useState('ትምህርት ክፍል');

  const dict = t[lang];

  // Firestore sync listener
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'schedules'), (snapshot) => {
      if (!snapshot.empty) {
        const fetched: ScheduleItem[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            day: d.day || 'sunday',
            dayAm: d.dayAm || (d.day === 'friday' ? 'አርብ' : d.day === 'saturday' ? 'ቅዳሜ' : 'እሁድ'),
            dayEn: d.dayEn || (d.day === 'friday' ? 'Friday' : d.day === 'saturday' ? 'Saturday' : 'Sunday'),
            gradeLevel: d.gradeLevel || 'pre_kg',
            gradeAm: d.gradeAm || 'ቅድመ አንደኛ',
            gradeEn: d.gradeEn || 'Pre-KG',
            activity: d.activity || '',
            timeRange: d.timeRange || '',
            departmentResponsible: d.departmentResponsible || 'ትምህርት ክፍል',
            departmentKey: d.departmentKey || 'education',
          };
        });
        setSchedules(fetched);
        localStorage.setItem('ww_schedule_data', JSON.stringify(fetched));
      } else {
        // If firestore is empty, seed initial schedule or use local
        localStorage.setItem('ww_schedule_data', JSON.stringify(WOLD_WAHID_SCHEDULE));
      }
    }, (error) => {
      console.warn('Firestore schedule listener fallback:', error);
    });

    return () => unsub();
  }, []);

  // Grade meta definitions
  const gradeTabs: { id: GradeLevel; titleAm: string; titleEn: string; icon: string; descAm: string }[] = [
    {
      id: 'pre_kg',
      titleAm: 'ቅድመ አንደኛ',
      titleEn: 'Pre-School / KG',
      icon: '🧸',
      descAm: 'የህፃናት ትምህርት፣ ጸሎት፣ መዝሙር፣ አብነትና ኪነ ጥበብ',
    },
    {
      id: 'grade_1_2',
      titleAm: '1ኛ እና 2ኛ ክፍል',
      titleEn: 'Grades 1 & 2',
      icon: '🎒',
      descAm: 'የታዳጊዎች ትምህርት፣ አብነት፣ መዝሙርና ስነ ስርዓት',
    },
    {
      id: 'grade_3_5',
      titleAm: '3ኛ–5ኛ ክፍል',
      titleEn: 'Grades 3–5',
      icon: '📚',
      descAm: 'የቅዳሜና የእሁድ ጥልቅ ትምህርት፣ መዝሙርና አብነት',
    },
    {
      id: 'grade_6_9',
      titleAm: '6ኛ–9ኛ ክፍል',
      titleEn: 'Grades 6–9',
      icon: '🎓',
      descAm: 'የአርብ፣ የቅዳሜና የእሁድ ትምህርት፣ ወረብ፣ አብነትና ኪነ ጥበብ',
    },
  ];

  const getDeptIcon = (deptKey: string) => {
    switch (deptKey) {
      case 'education':
        return <BookOpen className="w-3.5 h-3.5 text-blue-400" />;
      case 'choir':
        return <Music className="w-3.5 h-3.5 text-pink-400" />;
      case 'arts':
        return <Palette className="w-3.5 h-3.5 text-amber-400" />;
      case 'abnet':
        return <Scroll className="w-3.5 h-3.5 text-emerald-400" />;
      case 'discipline':
      default:
        return <Shield className="w-3.5 h-3.5 text-amber-300" />;
    }
  };

  const dayLabels: Record<DayOfWeek, string> = {
    friday: '📅 አርብ (Friday)',
    saturday: '📅 ቅዳሜ (Saturday)',
    sunday: '📅 እሁድ (Sunday)',
  };

  const getGradeNameAm = (grade: GradeLevel): string => {
    switch (grade) {
      case 'pre_kg': return 'ቅድመ አንደኛ';
      case 'grade_1_2': return '1ኛ እና 2ኛ ክፍል';
      case 'grade_3_5': return '3ኛ–5ኛ ክፍል';
      case 'grade_6_9': return '6ኛ–9ኛ ክፍል';
      default: return 'አጠቃላይ';
    }
  };

  const getDeptNameAm = (dept: SundaySchoolDepartment): string => {
    switch (dept) {
      case 'education': return 'ትምህርት ክፍል';
      case 'choir': return 'መዝሙር ክፍል';
      case 'arts': return 'ኪነ ጥበብ ክፍል';
      case 'abnet': return 'አብነት ክፍል';
      case 'discipline': return 'ስነ ስርዓት ክፍል';
      default: return 'አጠቃላይ';
    }
  };

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormDay(selectedDay === 'all' ? 'sunday' : selectedDay);
    setFormGrade(activeGrade);
    setFormActivity('');
    setFormTimeRange('');
    setFormDept('education');
    setFormDeptName('ትምህርት ክፍል');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: ScheduleItem) => {
    setEditingItem(item);
    setFormDay(item.day);
    setFormGrade(item.gradeLevel);
    setFormActivity(item.activity);
    setFormTimeRange(item.timeRange);
    setFormDept(item.departmentKey);
    setFormDeptName(item.departmentResponsible);
    setIsModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formActivity.trim() || !formTimeRange.trim()) return;

    const itemId = editingItem ? editingItem.id : `sch-${Date.now()}`;
    const dayAm = formDay === 'friday' ? 'አርብ' : formDay === 'saturday' ? 'ቅዳሜ' : 'እሁድ';
    const dayEn = formDay.charAt(0).toUpperCase() + formDay.slice(1);
    const gradeAm = getGradeNameAm(formGrade);

    const newItem: ScheduleItem = {
      id: itemId,
      day: formDay,
      dayAm,
      dayEn,
      gradeLevel: formGrade,
      gradeAm,
      gradeEn: formGrade,
      activity: formActivity.trim(),
      timeRange: formTimeRange.trim(),
      departmentResponsible: formDeptName.trim() || getDeptNameAm(formDept),
      departmentKey: formDept,
    };

    // Update local state
    const updated = editingItem
      ? schedules.map((s) => (s.id === editingItem.id ? newItem : s))
      : [...schedules, newItem];
    setSchedules(updated);
    localStorage.setItem('ww_schedule_data', JSON.stringify(updated));

    // Persist to Firestore
    try {
      await setDoc(doc(db, 'schedules', itemId), {
        ...newItem,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Could not save schedule item to Firestore:', err);
    }

    setIsModalOpen(false);
  };

  const handleDeleteItem = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('ይህን የክፍለ-ጊዜ መርሐ ግብር በእርግጥ መሰረዝ ይፈልጋሉ?')) return;

    const filtered = schedules.filter((s) => s.id !== id);
    setSchedules(filtered);
    localStorage.setItem('ww_schedule_data', JSON.stringify(filtered));

    try {
      await deleteDoc(doc(db, 'schedules', id));
    } catch (err) {
      console.warn('Could not delete schedule item from Firestore:', err);
    }
  };

  const handleRestoreDefaults = async () => {
    if (!window.confirm('መርሐ ግብሩን ወደ መደበኛው የወልድ ዋሕድ ሙሉ ሰሌዳ መመለስ ይፈልጋሉ?')) return;
    setSchedules(WOLD_WAHID_SCHEDULE);
    localStorage.setItem('ww_schedule_data', JSON.stringify(WOLD_WAHID_SCHEDULE));

    try {
      for (const item of WOLD_WAHID_SCHEDULE) {
        await setDoc(doc(db, 'schedules', item.id), item);
      }
    } catch (err) {
      console.warn('Could not restore to Firestore:', err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Schedule for currently selected class in 'by_grade' mode
  const currentGradeItems = schedules.filter((item) => {
    const matchesGrade = item.gradeLevel === activeGrade;
    const matchesDay = selectedDay === 'all' || item.day === selectedDay;
    return matchesGrade && matchesDay;
  });

  // Group current grade items by day
  const gradeDays = Array.from(new Set(currentGradeItems.map((item) => item.day)));

  return (
    <div className="space-y-6">
      {/* Header, Action Controls & View Mode Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>{dict.schedule.title}</span>
            <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              {schedules.length} ክፍለ-ጊዜያት
            </span>
          </h2>
          <p className="text-sm text-emerald-200/70 mt-1">
            {dict.schedule.subtitle} ·{' '}
            <span className="text-amber-400 font-medium">የአርብ፣ የቅዳሜና የእሁድ መርሐ ግብሮች በክፍልና በቀን</span>
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2.5">
          {/* View mode toggle: By Grade vs By Day */}
          <div className="bg-[#09351c] border border-[#0f4425] p-1 rounded-xl flex items-center text-xs shadow-inner">
            <button
              onClick={() => setViewMode('by_grade')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                viewMode === 'by_grade'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-emerald-200/80 hover:text-white'
              }`}
            >
              🎒 በክፍል ደረጃ እይታ
            </button>
            <button
              onClick={() => setViewMode('by_day')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                viewMode === 'by_day'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-emerald-200/80 hover:text-white'
              }`}
            >
              📅 በቀናት እይታ
            </button>
          </div>

          {/* Add Schedule Item Button */}
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>አዲስ መርሐ ግብር ጨምር</span>
          </button>

          {/* Restore Defaults */}
          <button
            onClick={handleRestoreDefaults}
            title="መደበኛ መርሐ ግብር መልስ (Restore Default)"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#09351c] hover:bg-[#0d4526] text-emerald-200 border border-[#0f4425] rounded-xl text-xs font-medium transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">መደበኛ መልስ</span>
          </button>

          {/* Print */}
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#09351c] hover:bg-[#0d4526] text-slate-200 border border-[#0f4425] rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>{dict.schedule.printSchedule}</span>
          </button>
        </div>
      </div>

      {/* MODE 1: BY CLASS / GRADE LEVEL */}
      {viewMode === 'by_grade' ? (
        <div className="space-y-6">
          {/* Class Selectors Grid */}
          <div className="no-print grid grid-cols-2 md:grid-cols-4 gap-3">
            {gradeTabs.map((g) => {
              const count = schedules.filter((i) => i.gradeLevel === g.id).length;
              const isSelected = activeGrade === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setActiveGrade(g.id)}
                  className={`p-4 rounded-2xl border text-left transition-all duration-200 relative overflow-hidden ${
                    isSelected
                      ? 'bg-[#09351c] border-amber-500/80 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/50'
                      : 'bg-[#09351c]/60 border-[#0f4425] hover:bg-[#09351c] hover:border-emerald-600/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{g.icon}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#062414] text-amber-400 border border-[#0f4425]">
                      {count} ክፍለ-ጊዜ
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white transition-colors">
                    {g.titleAm}
                  </h4>
                  <p className="text-[11px] text-emerald-200/70 mt-1 line-clamp-1">
                    {g.descAm}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Active Class Schedule Display */}
          <div className="bg-[#09351c] rounded-2xl border border-[#0f4425] p-6 shadow-xl space-y-6">
            {/* Class Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#0f4425]">
              <div className="flex items-center gap-3">
                <span className="text-3xl">
                  {gradeTabs.find((g) => g.id === activeGrade)?.icon}
                </span>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {gradeTabs.find((g) => g.id === activeGrade)?.titleAm} መርሐ ግብር
                  </h3>
                  <p className="text-xs text-emerald-200/70">
                    {gradeTabs.find((g) => g.id === activeGrade)?.descAm}
                  </p>
                </div>
              </div>

              {/* Quick Attendance Check-in for this class */}
              <button
                onClick={() =>
                  onSelectSessionForAttendance(
                    gradeTabs.find((g) => g.id === activeGrade)?.titleAm || '',
                    gradeTabs.find((g) => g.id === activeGrade)?.titleAm || ''
                  )
                }
                className="no-print inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                <span>ለዚህ ክፍል የQR ክትትል ጀምር</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Timetable grouped by Day for this Class */}
            {gradeDays.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <p className="text-sm text-emerald-200/70">ለዚህ ክፍል የተመዘገበ መርሐ ግብር አልተገኘም።</p>
                <button
                  onClick={handleOpenAddModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>መርሐ ግብር ጨምር</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {gradeDays.map((dayKey) => {
                  const periods = currentGradeItems.filter((i) => i.day === dayKey);
                  return (
                    <div
                      key={dayKey}
                      className="p-4 rounded-xl bg-[#062414] border border-[#0f4425] flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#0f4425]">
                          <span className="text-xs font-bold text-amber-400">
                            {dayLabels[dayKey]}
                          </span>
                          <span className="text-[10px] font-mono text-emerald-200/70">
                            {periods.length} ክፍለ-ጊዜ
                          </span>
                        </div>

                        <div className="space-y-2">
                          {periods.map((period) => (
                            <div
                              key={period.id}
                              className="group p-3 rounded-lg bg-[#09351c] border border-[#0f4425] flex items-center justify-between gap-3 text-xs hover:border-amber-500/50 transition-colors"
                            >
                              <div className="flex-1">
                                <span className="font-semibold text-slate-100 block">
                                  {period.activity}
                                </span>
                                <div className="flex items-center gap-1.5 text-[11px] text-emerald-200/70 mt-1">
                                  {getDeptIcon(period.departmentKey)}
                                  <span>
                                    ኃላፊ፦{' '}
                                    <strong className="text-emerald-100">
                                      {period.departmentResponsible}
                                    </strong>
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono text-amber-300 font-bold text-xs bg-[#062414] px-2 py-1 rounded border border-[#0f4425]">
                                  {period.timeRange}
                                </span>
                                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => handleOpenEditModal(period)}
                                    title="አስተካክል / Edit"
                                    className="p-1 rounded bg-[#062414] hover:bg-emerald-900 text-amber-400 border border-[#0f4425] transition-colors"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteItem(period.id, e)}
                                    title="ሰርዝ / Delete"
                                    className="p-1 rounded bg-[#062414] hover:bg-rose-950 text-rose-400 border border-[#0f4425] transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 pt-2 border-t border-[#0f4425] flex items-center justify-between text-[10px] text-emerald-200/60">
                        <span>የክፍለ-ጊዜ ቆይታ</span>
                        <span className="font-mono text-amber-400/90 font-bold">
                          {periods[0]?.timeRange.split('–')[0] || periods[0]?.timeRange.split('-')[0]} - {periods[periods.length - 1]?.timeRange.split('–')[1] || periods[periods.length - 1]?.timeRange.split('-')[1]}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* MODE 2: BY DAY (All classes in chronological order for that day) */
        <div className="space-y-6">
          {/* Day selection tabs */}
          <div className="no-print flex items-center gap-2 overflow-x-auto pb-1 bg-[#09351c] p-3 rounded-2xl border border-[#0f4425]">
            <span className="text-xs text-emerald-200/70 font-medium shrink-0 mr-1">ቀን ይምረጡ:</span>
            {[
              { key: 'all' as const, label: 'ሁሉም ቀናት' },
              { key: 'friday' as const, label: 'አርብ' },
              { key: 'saturday' as const, label: 'ቅዳሜ' },
              { key: 'sunday' as const, label: 'እሁድ' },
            ].map((d) => (
              <button
                key={d.key}
                onClick={() => setSelectedDay(d.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedDay === d.key
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-emerald-200/80 hover:text-white bg-[#062414] border border-[#0f4425]'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Day Groups */}
          {(['friday', 'saturday', 'sunday'] as DayOfWeek[])
            .filter((d) => selectedDay === 'all' || selectedDay === d)
            .map((d) => {
              const dayItems = schedules.filter((i) => i.day === d);
              if (dayItems.length === 0) return null;
              const distinctGrades = Array.from(new Set(dayItems.map((i) => i.gradeAm)));

              return (
                <div key={d} className="bg-[#09351c] rounded-2xl border border-[#0f4425] p-5 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#0f4425]">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>{dayLabels[d]}</span>
                    </h3>
                    <span className="text-xs font-mono text-amber-400 font-bold bg-[#062414] px-2.5 py-1 rounded-lg border border-[#0f4425]">
                      {dayItems.length} ክፍለ-ጊዜያት
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {distinctGrades.map((gradeTitle) => {
                      const items = dayItems.filter((i) => i.gradeAm === gradeTitle);
                      return (
                        <div key={gradeTitle} className="p-3.5 rounded-xl bg-[#062414] border border-[#0f4425]">
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#0f4425]">
                            <span className="text-xs font-bold text-amber-400">• {gradeTitle}</span>
                            <span className="text-[10px] text-emerald-200/70 font-mono">{items.length} ክፍለ-ጊዜ</span>
                          </div>
                          <div className="space-y-1.5">
                            {items.map((it) => (
                              <div
                                key={it.id}
                                className="group p-2 rounded-lg bg-[#09351c] border border-[#0f4425] flex items-center justify-between text-xs hover:border-amber-500/40 transition-colors"
                              >
                                <div className="flex-1">
                                  <span className="font-medium text-slate-200 block">{it.activity}</span>
                                  <span className="text-[10px] text-emerald-200/70 block">
                                    ኃላፊ፦ {it.departmentResponsible}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-amber-300 font-semibold text-xs bg-[#062414] px-1.5 py-0.5 rounded border border-[#0f4425]">
                                    {it.timeRange}
                                  </span>
                                  <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => handleOpenEditModal(it)}
                                      className="p-1 hover:text-amber-400"
                                      title="አስተካክል"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={(e) => handleDeleteItem(it.id, e)}
                                      className="p-1 hover:text-rose-400"
                                      title="ሰርዝ"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Add / Edit Schedule Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#09351c] border border-[#0f4425] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 bg-[#062414] border-b border-[#0f4425] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  {editingItem ? 'የክፍለ-ጊዜ መርሐ ግብር አስተካክል' : 'አዲስ የክፍለ-ጊዜ መርሐ ግብር መዝግብ'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-emerald-200/70 hover:text-white hover:bg-[#09351c] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveItem} className="p-5 space-y-4 text-xs">
              {/* Day selection */}
              <div>
                <label className="block text-emerald-200/80 font-medium mb-1.5">የሚሰጥበት ቀን (Day)</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'friday' as DayOfWeek, label: 'አርብ (Fri)' },
                    { key: 'saturday' as DayOfWeek, label: 'ቅዳሜ (Sat)' },
                    { key: 'sunday' as DayOfWeek, label: 'እሁድ (Sun)' },
                  ].map((d) => (
                    <button
                      type="button"
                      key={d.key}
                      onClick={() => setFormDay(d.key)}
                      className={`p-2 rounded-xl border text-center font-semibold transition-all ${
                        formDay === d.key
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                          : 'bg-[#062414] text-emerald-200/80 border-[#0f4425] hover:border-emerald-600'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grade Level Selection */}
              <div>
                <label className="block text-emerald-200/80 font-medium mb-1.5">የትምህርት ክፍል ደረጃ (Grade Level)</label>
                <select
                  value={formGrade}
                  onChange={(e) => setFormGrade(e.target.value as GradeLevel)}
                  className="w-full bg-[#062414] border border-[#0f4425] rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-amber-400"
                >
                  <option value="pre_kg">🧸 ቅድመ አንደኛ (Pre-KG)</option>
                  <option value="grade_1_2">🎒 1ኛ እና 2ኛ ክፍል (Grades 1 & 2)</option>
                  <option value="grade_3_5">📚 3ኛ–5ኛ ክፍል (Grades 3–5)</option>
                  <option value="grade_6_9">🎓 6ኛ–9ኛ ክፍል (Grades 6–9)</option>
                  <option value="leaders">🕊️ አጠቃላይ / አገልጋዮች</option>
                </select>
              </div>

              {/* Activity Name */}
              <div>
                <label className="block text-emerald-200/80 font-medium mb-1.5">
                  የመርሐ ግብር ርዕስ / ይዘት (Activity)
                </label>
                <input
                  type="text"
                  required
                  placeholder="ምሳሌ፦ ትምህርት፣ መዝሙር፣ አብነት፣ ጸሎት መክፈቻ..."
                  value={formActivity}
                  onChange={(e) => setFormActivity(e.target.value)}
                  className="w-full bg-[#062414] border border-[#0f4425] rounded-xl px-3 py-2 text-white placeholder-emerald-200/40 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Time Range */}
              <div>
                <label className="block text-emerald-200/80 font-medium mb-1.5">
                  የሚሰጥበት ሰዓት (Time Range)
                </label>
                <input
                  type="text"
                  required
                  placeholder="ምሳሌ፦ 3:30–4:00 ወይም 8:05–9:00"
                  value={formTimeRange}
                  onChange={(e) => setFormTimeRange(e.target.value)}
                  className="w-full bg-[#062414] border border-[#0f4425] rounded-xl px-3 py-2 text-white placeholder-emerald-200/40 focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>

              {/* Responsible Department */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-emerald-200/80 font-medium mb-1.5">የሚሰጠው ኮሚቴ</label>
                  <select
                    value={formDept}
                    onChange={(e) => {
                      const val = e.target.value as SundaySchoolDepartment;
                      setFormDept(val);
                      setFormDeptName(getDeptNameAm(val));
                    }}
                    className="w-full bg-[#062414] border border-[#0f4425] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="education">ትምህርት ክፍል</option>
                    <option value="choir">መዝሙር ክፍል</option>
                    <option value="abnet">አብነት ክፍል</option>
                    <option value="arts">ኪነ ጥበብ ክፍል</option>
                    <option value="discipline">ስነ ስርዓት ክፍል</option>
                    <option value="general">አጠቃላይ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-emerald-200/80 font-medium mb-1.5">የሚያስፈጽመው አካል (ስም)</label>
                  <input
                    type="text"
                    value={formDeptName}
                    onChange={(e) => setFormDeptName(e.target.value)}
                    placeholder="ምሳሌ፦ ትምህርት ክፍል"
                    className="w-full bg-[#062414] border border-[#0f4425] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-3 border-t border-[#0f4425] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-[#062414] text-emerald-200/80 border border-[#0f4425] rounded-xl font-medium hover:text-white"
                >
                  ይቅር (Cancel)
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow transition-colors flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>{editingItem ? 'አስተካክል (Save)' : 'መዝግብ (Add)'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
