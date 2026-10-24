import React, { useState, useEffect, useRef } from 'react';
import { Member, AttendanceRecord, ServiceSession, Language, AdminUser } from '../types';
import { t } from '../utils/translations';
import { formatEthiopianDate } from '../utils/ethiopianCalendar';
import { Html5QrcodeScanner } from 'html5-qrcode';
import {
  QrCode,
  CheckCircle,
  UserCheck,
  Clock,
  Sparkles,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  UserPlus,
  X,
  Search,
  Trash2,
  Edit2,
  Check,
  Calendar,
  Camera,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Lock,
} from 'lucide-react';

interface AttendanceScannerProps {
  members: Member[];
  attendance: AttendanceRecord[];
  sessions: ServiceSession[];
  activeSession: ServiceSession;
  onSelectSession: (session: ServiceSession) => void;
  onCheckIn: (record: AttendanceRecord) => void;
  onDeleteAttendance?: (id: string) => void;
  onUpdateAttendance?: (id: string, updated: Partial<AttendanceRecord>) => void;
  lang: Language;
  currentAdmin?: AdminUser;
}

export const AttendanceScanner: React.FC<AttendanceScannerProps> = ({
  members,
  attendance,
  sessions,
  activeSession,
  onSelectSession,
  onCheckIn,
  onDeleteAttendance,
  onUpdateAttendance,
  lang,
  currentAdmin,
}) => {
  const [codeQuery, setCodeQuery] = useState('');
  const [scanErrorMessage, setScanErrorMessage] = useState('');
  const [lastCheckedInMember, setLastCheckedInMember] = useState<{
    member: Member | { fullNameAm: string; fullNameEn: string; code: string; photoUrl?: string };
    timestamp: string;
    isDuplicate?: boolean;
    isGuest?: boolean;
  } | null>(null);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editTime, setEditTime] = useState('');
  const [editSession, setEditSession] = useState('');
  const [editStatus, setEditStatus] = useState<'present' | 'absent' | 'excused'>('present');

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const dict = t[lang];

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        scannerRef.current?.pause();
      } else {
        scannerRef.current?.resume();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      scannerRef.current?.clear().catch(console.error);
    };
  }, []);

  const playChime = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch {}
  };

  const handleProcessCode = (code: string, method: 'qr' | 'kiosk' | 'manual' = 'qr') => {
    let raw = code.trim();
    if (raw.startsWith('{') && raw.endsWith('}')) {
      try {
        const parsed = JSON.parse(raw);
        raw = parsed.code || parsed.studentCode || parsed.phone || parsed.id || raw;
      } catch {}
    }
    if (raw.includes('?code=') || raw.includes('&code=')) {
      try {
        const url = new URL(raw);
        raw = url.searchParams.get('code') || raw;
      } catch {}
    }

    const cleanCode = raw.trim().toUpperCase();
    if (!cleanCode) return;

    const cleanDigits = cleanCode.replace(/\D/g, '');

    const member = members.find((m) => {
      const c = (m.code || '').toUpperCase();
      const id = (m.id || '').toUpperCase();
      const p = (m.phone || '').replace(/\D/g, '');
      return (
        c === cleanCode ||
        id === cleanCode ||
        (cleanDigits.length >= 9 && p.endsWith(cleanDigits.slice(-9))) ||
        (cleanCode.length >= 4 && c.endsWith(cleanCode))
      );
    });

    const currentTime = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const todayDate = new Date().toISOString().split('T')[0];

    if (!member) {
      setScanErrorMessage(
        lang === 'am'
          ? `❌ የተማሪ መለያ ኮድ "${raw}" በሲስተሙ አልተገኘም። እባክዎ ኮዱን ያረጋግጡ።`
          : `Student code "${raw}" not found in system.`
      );
      return;
    }

    setScanErrorMessage('');

    const alreadyCheckedIn = attendance.some(
      (att) => att.memberId === member.id && att.sessionName === activeSession.nameAm
    );

    if (alreadyCheckedIn) {
      setLastCheckedInMember({
        member,
        timestamp: currentTime,
        isDuplicate: true,
      });
      playChime();
      return;
    }

    const newRecord: AttendanceRecord = {
      id: `att-${Date.now()}`,
      memberId: member.id,
      memberNameAm: member.fullNameAm,
      memberNameEn: member.fullNameEn,
      memberCode: member.code,
      department: member.department,
      sessionName: activeSession.nameAm,
      timestamp: currentTime,
      date: todayDate,
      method,
      scannedBy: currentAdmin?.nameAm ? `${currentAdmin.nameAm} (${currentAdmin.role === 'super_admin' ? 'ዋና አስተዳዳሪ' : 'አስተዳዳሪ'})` : 'Admin',
      status: 'present',
    };

    onCheckIn(newRecord);
    setLastCheckedInMember({
      member,
      timestamp: currentTime,
      isDuplicate: false,
    });
    
    // Add visual feedback (flash green)
    const greetingBox = document.getElementById('greeting-box');
    if (greetingBox) {
      greetingBox.classList.remove('bg-emerald-950/70', 'border-emerald-500');
      greetingBox.classList.add('bg-emerald-500', 'border-white');
      setTimeout(() => {
        greetingBox.classList.remove('bg-emerald-500', 'border-white');
        greetingBox.classList.add('bg-emerald-950/70', 'border-emerald-500');
      }, 500);
    }
    
    playChime();
    setCodeQuery('');
  };

  const handleScanWithCamera = () => {
    const tg = (window as any)?.Telegram?.WebApp;
    if (tg && typeof tg.showScanQrPopup === 'function') {
      tg.showScanQrPopup(
        { text: 'የተማሪውን የዲጂታል መታወቂያ QR ኮድ እዚህ ያሳዩ' },
        (scannedText: string) => {
          if (scannedText) {
            handleProcessCode(scannedText, 'qr');
            try {
              tg.closeScanQrPopup();
            } catch {}
            return true;
          }
          return false;
        }
      );
    } else {
      const scannerId = "qr-reader";
      const el = document.getElementById(scannerId);
      if (el) {
        el.style.display = 'block';
        if (!scannerRef.current) {
          const scanner = new Html5QrcodeScanner(scannerId, { fps: 10, qrbox: 250 }, false);
          scannerRef.current = scanner;
          scanner.render((decodedText: string) => {
            handleProcessCode(decodedText, 'qr');
          }, (error) => {});
        } else {
          scannerRef.current.resume();
        }
      } else {
        setScanErrorMessage('የካሜራ ስካነር ሊከፈት አልቻለም።');
      }
    }
  };

  const handleGuestCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;
    const currentTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const todayDate = new Date().toISOString().split('T')[0];
    const guestCode = `GST-${Math.floor(1000 + Math.random() * 9000)}`;
    const newRecord: AttendanceRecord = {
      id: `att-guest-${Date.now()}`,
      memberId: `guest-${Date.now()}`,
      memberNameAm: guestName.trim(),
      memberNameEn: guestName.trim(),
      memberCode: guestCode,
      department: 'general',
      sessionName: activeSession.nameAm,
      timestamp: currentTime,
      date: todayDate,
      method: 'manual',
      isGuest: true,
    };
    onCheckIn(newRecord);
    setLastCheckedInMember({
      member: { fullNameAm: guestName.trim(), fullNameEn: guestName.trim(), code: guestCode },
      timestamp: currentTime,
      isDuplicate: false,
      isGuest: true,
    });
    playChime();
    setGuestName('');
    setGuestPhone('');
    setIsGuestModalOpen(false);
  };

  const handleOpenEdit = (record: AttendanceRecord) => {
    setEditingRecord(record);
    setEditTime(record.timestamp);
    setEditSession(record.sessionName);
    setEditStatus(record.status || 'present');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    if (onUpdateAttendance) {
      onUpdateAttendance(editingRecord.id, { timestamp: editTime.trim(), sessionName: editSession.trim(), status: editStatus });
    }
    setEditingRecord(null);
  };

  const handleDeleteRecord = (id: string) => {
    if (window.confirm('ይህን የመገኘት መዝገብ በእርግጥ መሰረዝ ይፈልጋሉ?')) {
      if (onDeleteAttendance) onDeleteAttendance(id);
    }
  };

  const presentCount = attendance.filter((a) => a.sessionName === activeSession.nameAm && a.status !== 'absent').length;
  const guestCount = attendance.filter((a) => a.sessionName === activeSession.nameAm && a.isGuest).length;
  const totalMembersCount = members.length;
  const attendanceRate = totalMembersCount > 0 ? Math.round((presentCount / totalMembersCount) * 100) : 0;

  return (
    <div className={`space-y-6 ${isKioskMode ? 'fixed inset-0 z-50 bg-[#062414] p-6 overflow-y-auto' : ''}`}>
      <div id="qr-reader" className="hidden w-full max-w-sm mx-auto mb-4 border border-emerald-900 rounded-2xl overflow-hidden"></div>
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>{dict.attendance.title}</span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30 font-medium">
              🇪🇹 {formatEthiopianDate()}
            </span>
          </h2>
          <p className="text-sm text-emerald-200/70 mt-1">
            {dict.attendance.subtitle} ·{' '}
            <span className="text-amber-400 font-semibold">
              {lang === 'am' ? activeSession.nameAm : activeSession.nameEn}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button onClick={() => setSoundEnabled(!soundEnabled)} title={soundEnabled ? 'Mute Chime' : 'Enable Chime'} className="p-2 rounded-xl bg-[#09351c] text-slate-300 hover:text-white border border-[#0f4425]">
            {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-emerald-500" />}
          </button>
          <button onClick={() => setIsGuestModalOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#09351c] hover:bg-[#0d4526] text-slate-200 border border-[#0f4425] rounded-xl text-xs font-semibold">
            <UserPlus className="w-4 h-4 text-amber-400" />
            <span>{dict.attendance.fastTrackGuest}</span>
          </button>
          <button onClick={() => setIsKioskMode(!isKioskMode)} className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${isKioskMode ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'}`}>
            {isKioskMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span>{dict.attendance.kioskMode}</span>
          </button>
        </div>
      </div>

      <div className="bg-[#09351c] p-3 rounded-2xl border border-[#0f4425] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs font-medium text-emerald-100">{dict.attendance.sessionLabel}:</span>
        </div>
        <select value={activeSession.id} onChange={(e) => { const found = sessions.find((s) => s.id === e.target.value); if (found) onSelectSession(found); }} className="flex-1 max-w-md px-3 py-1.5 bg-[#062414] border border-[#0f4425] rounded-xl text-xs text-amber-300 font-semibold focus:outline-none focus:border-amber-400">
          {sessions.map((s) => <option key={s.id} value={s.id}>{s.nameAm}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-[#09351c] border border-[#0f4425] rounded-2xl">
          <span className="text-xs text-emerald-200/70 font-medium">{dict.attendance.todayPresent}</span>
          <p className="text-2xl font-bold font-mono text-amber-400 mt-1 tabular-nums">{presentCount}</p>
        </div>
        <div className="p-4 bg-[#09351c] border border-[#0f4425] rounded-2xl">
          <span className="text-xs text-emerald-200/70 font-medium">የተመዘገቡ አባላት / Total</span>
          <p className="text-2xl font-bold font-mono text-white mt-1 tabular-nums">{totalMembersCount}</p>
        </div>
        <div className="p-4 bg-[#09351c] border border-[#0f4425] rounded-2xl">
          <span className="text-xs text-emerald-200/70 font-medium">የመጀመሪያ እንግዶች / Guests</span>
          <p className="text-2xl font-bold font-mono text-emerald-300 mt-1 tabular-nums">{guestCount}</p>
        </div>
        <div className="p-4 bg-[#09351c] border border-[#0f4425] rounded-2xl">
          <span className="text-xs text-emerald-200/70 font-medium">የተገኝነት ምጣኔ / Attendance %</span>
          <p className="text-2xl font-bold font-mono text-amber-300 mt-1 tabular-nums">{attendanceRate}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 bg-[#09351c] border border-[#0f4425] rounded-2xl text-center flex flex-col items-center justify-center relative shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-[#062414] border border-[#0f4425] text-amber-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <QrCode className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white">የተማሪዎች መገኘት መመዝገቢያ ሰሌዳ</h3>
            <p className="text-xs text-emerald-200/70 mt-1 max-w-xs">የተማሪውን QR ኮድ በካሜራ ስካን ያድርጉ ወይም መለያ ቁጥር በማስገባት መገኘትን ያረጋግጡ</p>
            <div className="mt-5 w-full max-w-sm">
              <button type="button" onClick={handleScanWithCamera} className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition active:scale-95 text-xs">
                <Camera className="w-4 h-4" />
                <span>📷 በካሜራ QR ኮድ ስካን ያድርጉ (Scan with Camera)</span>
              </button>
            </div>
            {scanErrorMessage && <div className="mt-3 w-full max-w-sm p-3 bg-red-950/80 border border-red-800 rounded-xl text-red-200 text-xs flex items-start gap-2 text-left"><AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" /><span>{scanErrorMessage}</span></div>}
            <form onSubmit={(e) => { e.preventDefault(); handleProcessCode(codeQuery, 'manual'); }} className="mt-4 w-full max-w-sm flex items-center gap-2">
              <input id="manual-code-input" type="text" value={codeQuery} onChange={(e) => setCodeQuery(e.target.value)} placeholder={dict.attendance.enterCode} className="flex-1 px-3.5 py-2.5 bg-[#062414] border border-[#0f4425] rounded-xl text-xs text-white font-mono placeholder-emerald-700/60 focus:outline-none focus:border-amber-400" />
              <button type="submit" className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer">{dict.attendance.checkInBtn}</button>
            </form>
          </div>
        </div>
        <div className="lg:col-span-7 space-y-4">
          {/* Greeting Box */}
          {lastCheckedInMember && (
            <div id="greeting-box" className={`p-5 rounded-3xl border-2 transition-all shadow-2xl ${lastCheckedInMember.isDuplicate ? 'bg-amber-950/40 border-amber-500/70 text-amber-100' : 'bg-emerald-950/70 border-emerald-500 text-emerald-100'}`}>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">{lastCheckedInMember.member.fullNameAm || (lastCheckedInMember.member as any).fullNameEn}</h2>
            </div>
          )}

          {/* Recent Check-Ins List */}
          <div className="bg-[#09351c] border border-[#0f4425] rounded-2xl p-5 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center justify-between pb-2 border-b border-[#0f4425]">
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>{dict.attendance.recentCheckins}</span>
              </span>
              <span className="text-xs font-mono text-amber-400 bg-[#062414] px-2.5 py-0.5 rounded-lg border border-[#0f4425]">
                {attendance.length} ተመዝግበዋል
              </span>
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {attendance.length === 0 ? (
                <div className="py-12 text-center text-emerald-200/50 text-xs">
                  {lang === 'am' ? 'እስካሁን የተመዘገበ የመገኘት ታሪክ የለም።' : 'No check-ins recorded yet.'}
                </div>
              ) : (
                attendance.map((record) => (
                  <div key={record.id} className="p-3 rounded-xl bg-[#062414] border border-[#0f4425] flex items-center justify-between gap-3 text-xs hover:border-amber-500/40 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-white truncate">{record.memberNameAm || record.memberNameEn}</p>
                        <p className="text-[11px] font-mono text-amber-400">{record.memberCode}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
