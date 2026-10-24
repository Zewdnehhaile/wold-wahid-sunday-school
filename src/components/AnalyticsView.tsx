import React from 'react';
import { Member, AttendanceRecord, SupportTicket, Language } from '../types';
import { t } from '../utils/translations';
import { Download, TrendingUp, Users, Calendar, Award, CheckCircle, BarChart3 } from 'lucide-react';

interface AnalyticsViewProps {
  members: Member[];
  attendance: AttendanceRecord[];
  tickets: SupportTicket[];
  lang: Language;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  members,
  attendance,
  tickets,
  lang,
}) => {
  const dict = t[lang];

  // Export CSV with UTF-8 BOM so Amharic Ethiopic characters render perfectly in Excel
  const handleExportCSV = () => {
    const headers = [
      'የአባል መለያ (ID)',
      'ሙሉ ስም (Amharic)',
      'Full Name (English)',
      'ስልክ ቁጥር (Phone)',
      'ክፍል (Department)',
      'የደም አይነት (Blood)',
      'የአደጋ ጊዜ ተጠሪ (Emergency Contact)',
      'አድራሻ (Subcity)',
      'የተመዘገበበት ቀን (Registration Date)',
    ];

    const rows = members.map((m) => [
      `"${m.code}"`,
      `"${m.fullNameAm}"`,
      `"${m.fullNameEn}"`,
      `"${m.phone}"`,
      `"${dict.departments[m.department]}"`,
      `"${m.bloodGroup}"`,
      `"${m.emergencyContact.name} - ${m.emergencyContact.phone}"`,
      `"${m.subcity}"`,
      `"${m.registeredDate}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `FithaPol_Members_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Department distribution
  const departments: { key: string; label: string; count: number; color: string }[] = [
    {
      key: 'discipline',
      label: dict.departments.discipline,
      count: members.filter((m) => m.department === 'discipline').length,
      color: 'bg-indigo-500',
    },
    {
      key: 'education',
      label: dict.departments.education,
      count: members.filter((m) => m.department === 'education').length,
      color: 'bg-blue-500',
    },
    {
      key: 'arts',
      label: dict.departments.arts,
      count: members.filter((m) => m.department === 'arts').length,
      color: 'bg-amber-500',
    },
    {
      key: 'abnet',
      label: dict.departments.abnet,
      count: members.filter((m) => m.department === 'abnet').length,
      color: 'bg-emerald-500',
    },
    {
      key: 'choir',
      label: dict.departments.choir,
      count: members.filter((m) => m.department === 'choir').length,
      color: 'bg-pink-500',
    },
    {
      key: 'general',
      label: dict.departments.general,
      count: members.filter((m) => m.department === 'general').length,
      color: 'bg-purple-500',
    },
  ];

  // Gender counts
  const maleCount = members.filter((m) => m.gender === 'male').length;
  const femaleCount = members.filter((m) => m.gender === 'female').length;

  return (
    <div className="space-y-6">
      {/* Top Header & Export */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {dict.analytics.title}
          </h2>
          <p className="text-sm text-slate-400 mt-1">{dict.analytics.subtitle}</p>
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>{dict.analytics.exportExcel}</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl">
          <span className="text-xs text-slate-400 font-medium">ጠቅላላ የተመዘገቡ አባላት</span>
          <p className="text-2xl font-bold font-mono text-white mt-1 tabular-nums">
            {members.length}
          </p>
          <span className="text-[11px] text-emerald-400 mt-2 block font-medium">
            ወንድ: {maleCount} · ሴት: {femaleCount}
          </span>
        </div>

        <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl">
          <span className="text-xs text-slate-400 font-medium">የዛሬ ተሳትፎ ምጣኔ</span>
          <p className="text-2xl font-bold font-mono text-indigo-400 mt-1 tabular-nums">
            {members.length > 0 ? `${Math.round((attendance.length / members.length) * 100)}%` : '0%'}
          </p>
          <span className="text-[11px] text-slate-400 mt-2 block">
            {attendance.length} አባላት ዛሬ ተገኝተዋል
          </span>
        </div>

        <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl">
          <span className="text-xs text-slate-400 font-medium">የድጋፍ ጥያቄዎች ሁኔታ</span>
          <p className="text-2xl font-bold font-mono text-amber-400 mt-1 tabular-nums">
            {tickets.length}
          </p>
          <span className="text-[11px] text-slate-400 mt-2 block">
            {tickets.filter((t) => t.status === 'resolved').length} ተጠናቀዋል
          </span>
        </div>

        <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl">
          <span className="text-xs text-slate-400 font-medium">የክትትል ማሳሰቢያዎች (Absence)</span>
          <p className="text-2xl font-bold font-mono text-rose-400 mt-1 tabular-nums">
            {members.filter((m) => m.consecutiveAbsences >= 2).length}
          </p>
          <span className="text-[11px] text-rose-400/80 mt-2 block font-medium">
            ለ 2+ ሳምንት ያልተገኙ
          </span>
        </div>
      </div>

      {/* Charts & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Department Distribution */}
        <div className="lg:col-span-6 bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center justify-between">
            <span>{dict.analytics.deptDistribution}</span>
            <Users className="w-4 h-4 text-slate-400" />
          </h3>

          <div className="space-y-3">
            {departments.map((dept) => {
              const pct = members.length > 0 ? Math.round((dept.count / members.length) * 100) : 0;
              return (
                <div key={dept.key}>
                  <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                    <span className="font-medium">{dept.label}</span>
                    <span className="font-mono text-slate-400">
                      {dept.count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${dept.color} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly Attendance Trajectory */}
        <div className="lg:col-span-6 bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white mb-1 flex items-center justify-between">
              <span>{dict.analytics.weeklyTrend}</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              ከዳታቤዝ በቀጥታ የተገኘ የዕለታት የመገኘት ምጣኔ (Live Firestore Records)
            </p>

            {/* Real attendance by date */}
            {attendance.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-44 bg-slate-950/60 rounded-xl border border-slate-800/80 text-center p-4">
                <BarChart3 className="w-8 h-8 text-slate-600 mb-2" />
                <p className="text-xs text-slate-400">በዳታቤዝ ውስጥ እስካሁን የተመዘገበ የመገኘት ታሪክ የለም።</p>
                <p className="text-[10px] text-slate-500 mt-1">ተማሪዎች በቦቱ ወይም በQR ክትትል ሲመዘገቡ እዚህ በቀጥታ ይታያል።</p>
              </div>
            ) : (
              <div className="flex items-end justify-between h-44 pt-6 px-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
                {Object.entries(
                  attendance.reduce((acc: Record<string, number>, curr) => {
                    const key = curr.date || 'Today';
                    acc[key] = (acc[key] || 0) + 1;
                    return acc;
                  }, {})
                ).slice(-5).map(([date, count], i) => {
                  const maxCount = Math.max(members.length, 1);
                  const pct = Math.min(Math.round((count / maxCount) * 100), 100);
                  return (
                    <div key={i} className="flex flex-col items-center gap-2 group flex-1">
                      <span className="text-[10px] font-mono font-bold text-amber-400 opacity-80 group-hover:opacity-100">
                        {count}
                      </span>
                      <div className="w-8 sm:w-12 bg-slate-800 rounded-t-lg relative flex items-end overflow-hidden h-28">
                        <div
                          className="w-full bg-gradient-to-t from-emerald-600 to-amber-500 rounded-t-lg transition-all duration-500"
                          style={{ height: `${Math.max(pct, 15)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-slate-400 text-center font-medium truncate w-14">
                        {date}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>ጠቅላላ የተመዘገቡ መገኘቶች: <strong className="text-white">{attendance.length}</strong></span>
            <span className="text-emerald-400 font-medium">ንቁ አባላት: {members.filter((m) => m.status === 'active').length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
