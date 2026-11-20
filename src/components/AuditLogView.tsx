import React, { useState, useEffect, useMemo } from 'react';
import { AuditLogEntry, AuditTargetType, Language, UserRole } from '../types';
import { fetchAuditLogs, getCachedAuditLogs } from '../utils/auditLog';
import {
  History,
  RefreshCw,
  Search,
  Users,
  ShieldCheck,
  QrCode,
  CalendarClock,
  BookOpen,
  Megaphone,
  FileText,
} from 'lucide-react';

interface AuditLogViewProps {
  role: UserRole;
  lang: Language;
  studentOnly?: boolean;
}

const TARGET_META: Record<
  AuditTargetType,
  { labelAm: string; labelEn: string; color: string; icon: React.FC<{ className?: string }> }
> = {
  student: {
    labelAm: 'ተማሪ',
    labelEn: 'Student',
    color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    icon: Users,
  },
  attendance: {
    labelAm: 'ክትትል',
    labelEn: 'Attendance',
    color: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    icon: QrCode,
  },
  leave: {
    labelAm: 'ፈቃድ',
    labelEn: 'Leave',
    color: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    icon: FileText,
  },
  parent: {
    labelAm: 'ወላጅ',
    labelEn: 'Parent',
    color: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    icon: Users,
  },
  admin: {
    labelAm: 'አስተዳዳሪ',
    labelEn: 'Admin',
    color: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    icon: ShieldCheck,
  },
  roster: {
    labelAm: 'ተረኛ',
    labelEn: 'Roster',
    color: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    icon: CalendarClock,
  },
  schedule: {
    labelAm: 'መርሐ ግብር',
    labelEn: 'Schedule',
    color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    icon: CalendarClock,
  },
  support: {
    labelAm: 'ድጋፍ',
    labelEn: 'Support',
    color: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
    icon: FileText,
  },
  lesson: {
    labelAm: 'ትምህርት',
    labelEn: 'Lesson',
    color: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    icon: BookOpen,
  },
  broadcast: {
    labelAm: 'ማስታወቂያ',
    labelEn: 'Broadcast',
    color: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    icon: Megaphone,
  },
};

const STUDENT_TARGETS: AuditTargetType[] = ['student', 'attendance', 'leave'];

export const AuditLogView: React.FC<AuditLogViewProps> = ({
  role,
  lang,
  studentOnly = false,
}) => {
  const isSuperAdmin = role === 'super_admin';
  const [logs, setLogs] = useState<AuditLogEntry[]>(() => getCachedAuditLogs(role));
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'students' | 'system'>(
    studentOnly || !isSuperAdmin ? 'students' : 'all'
  );

  const load = async (force = false) => {
    setIsLoading(true);
    try {
      const items = await fetchAuditLogs(role, force);
      setLogs(items);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load(false);
  }, [role]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((entry) => {
      // Strict double-guard: regular admins never see super_admin activity & only see student actions
      if (!isSuperAdmin) {
        if (entry.actorRole !== 'admin') return false;
        if (!STUDENT_TARGETS.includes(entry.targetType)) return false;
      } else if (studentOnly || scopeFilter === 'students') {
        if (!STUDENT_TARGETS.includes(entry.targetType)) return false;
      } else if (scopeFilter === 'system') {
        if (STUDENT_TARGETS.includes(entry.targetType)) return false;
      }

      if (!q) return true;
      return (
        entry.actorName.toLowerCase().includes(q) ||
        entry.targetName.toLowerCase().includes(q) ||
        entry.summaryAm.toLowerCase().includes(q) ||
        entry.summaryEn.toLowerCase().includes(q)
      );
    });
  }, [logs, isSuperAdmin, studentOnly, scopeFilter, search]);

  const formatTimestamp = (iso: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso.slice(0, 16).replace('T', ' ');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#09351c]/80 border border-[#0f4425] rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white">
              {isSuperAdmin && !studentOnly
                ? lang === 'am'
                  ? 'የሲስተም እንቅስቃሴ መዝገብ (Full Audit Log)'
                  : 'Full System Audit Log'
                : lang === 'am'
                ? 'የተማሪዎች አስተዳደር እንቅስቃሴ (Student Actions)'
                : 'Admin Student Activity Log'}
            </h3>
            <p className="text-[11px] text-emerald-200/70">
              {isSuperAdmin
                ? lang === 'am'
                  ? 'የሁሉም አስተዳዳሪዎችና የተማሪዎች ለውጥ ታሪክ'
                  : 'Complete activity history across admins & students'
                : lang === 'am'
                ? 'አስተዳዳሪዎች በተማሪዎች ላይ ያደረጓቸውን እርምጃዎች ብቻ ያሳያል'
                : 'Shows admin actions taken on students'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => load(true)}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#062414] hover:bg-[#0f4425] text-amber-300 border border-[#0f4425] text-xs font-bold transition cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{lang === 'am' ? 'አድስ (Refresh)' : 'Refresh'}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              lang === 'am' ? 'በአስተዳዳሪ ስም፣ በተማሪ ወይም በድርጊት ፈልግ...' : 'Search by actor, student, or action...'
            }
            className="w-full pl-9 pr-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>

        {isSuperAdmin && !studentOnly && (
          <div className="flex items-center gap-1.5 bg-[#062414] p-1 rounded-xl border border-[#0f4425]">
            {[
              { id: 'all', label: lang === 'am' ? 'ሁሉም' : 'All' },
              { id: 'students', label: lang === 'am' ? 'የተማሪ እርምጃ' : 'Students' },
              { id: 'system', label: lang === 'am' ? 'አስተዳደር' : 'System' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setScopeFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  scopeFilter === tab.id
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-emerald-200/70 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Timeline List */}
      <div className="bg-[#09351c]/70 border border-[#0f4425] rounded-2xl divide-y divide-[#0f4425]/60 overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-xs text-emerald-200/50">
            {lang === 'am'
              ? 'እስካሁን የተመዘገበ እንቅስቃሴ የለም።'
              : 'No matching activity records found.'}
          </div>
        ) : (
          filteredLogs.map((entry) => {
            const meta = TARGET_META[entry.targetType] || TARGET_META.student;
            const Icon = meta.icon;
            return (
              <div
                key={entry.id}
                className="p-3.5 hover:bg-white/5 transition-colors flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`p-2 rounded-xl border shrink-0 mt-0.5 ${meta.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-bold text-white">{entry.actorName}</span>
                      {isSuperAdmin && entry.actorRole === 'super_admin' && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold">
                          ዋና አስተዳዳሪ
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold ${meta.color}`}>
                        {lang === 'am' ? meta.labelAm : meta.labelEn}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-100/90 leading-snug">
                      {lang === 'am' ? entry.summaryAm : entry.summaryEn || entry.summaryAm}
                    </p>
                    {entry.targetName && (
                      <p className="text-[11px] text-amber-300/80 mt-0.5 truncate">
                        🎯 {entry.targetName}
                      </p>
                    )}
                  </div>
                </div>

                <span className="text-[10px] font-mono text-emerald-200/50 shrink-0 whitespace-nowrap mt-0.5">
                  {formatTimestamp(entry.timestamp)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
