import React, { useState, useEffect, useRef } from 'react';
import { Member, AttendanceRecord, ServiceSession, Language, AdminUser } from '../types';
import { t } from '../utils/translations';
import { formatEthiopianDate, formatEthiopianTime } from '../utils/ethiopianCalendar';
import { sendTelegramMessage } from '../utils/telegram';
import { db, collection, addDoc } from '../firebase';
import { Html5QrcodeScanner } from 'html5-qrcode';
import {
  QrCode,
  UserCheck,
  Clock,
  Volume2,
  VolumeX,
  UserPlus,
  X,
  Trash2,
  Edit2,
  Calendar,
  Camera,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  UserMinus,
  Download,
  Send,
  MessageSquare,
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
  const [toast, setToast] = useState<{ name: string; code: string; status?: 'present' | 'already'; msg?: string } | null>(null);
  
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editTime, setEditTime] = useState('');
  const [editSession, setEditSession] = useState('');
  const [attendanceTab, setAttendanceTab] = useState<'present' | 'absent'>('present');
  const [noticeModalOpen, setNoticeModalOpen] = useState(false);
  const [noticeRecipient, setNoticeRecipient] = useState<'all' | Member>('all');
  const [noticeMessageText, setNoticeMessageText] = useState('');
  const [isSendingNotice, setIsSendingNotice] = useState(false);

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

    // Use Ethiopian Time for the record
    const currentTime = formatEthiopianTime(new Date());
    const todayDate = new Date().toISOString().split('T')[0];

    if (!member) {
      setScanErrorMessage(
        lang === 'am'
          ? `❌ የተማሪ መለያ ኮድ "${raw}" በሲስተሙ አልተገኘም።`
          : `Student code "${raw}" not found.`
      );
      return;
    }

    setScanErrorMessage('');

    const alreadyCheckedIn = attendance.some(
      (att) => att.memberId === member.id && (att.date === todayDate || att.sessionName === activeSession.nameAm)
    );

    if (alreadyCheckedIn) {
      setScanErrorMessage(`⚠️ ተማሪ ${member.fullNameAm} (${member.code}) አስቀድሞ ዛሬ ተመዝግቧል!`);
      setToast({ name: member.fullNameAm || member.fullNameEn, code: member.code, status: 'already', msg: '⚠️ አስቀድሞ ዛሬ ተመዝግቧል (Already Recorded)' });
      setTimeout(() => setToast(null), 4000);
      playChime();
      return;
    }

    setScanErrorMessage('');

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
      scannedBy: currentAdmin?.nameAm ? `${currentAdmin.nameAm}` : 'Admin',
      status: 'present',
    };

    onCheckIn(newRecord);
    setToast({ name: member.fullNameAm || member.fullNameEn, code: member.code, status: 'present', msg: '✅ ተገኝቷል · PRESENT & RECORDED' });
    setTimeout(() => setToast(null), 3500);
    playChime();
    setCodeQuery('');
  };

  const handleScanWithCamera = async () => {
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
        
        const { Html5Qrcode } = await import('html5-qrcode');
        
        if (scannerRef.current) {
          try {
            await (scannerRef.current as any).stop();
          } catch {}
        }

        const html5QrCode = new Html5Qrcode(scannerId);
        (scannerRef.current as any) = html5QrCode;

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        try {
          await html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
              handleProcessCode(decodedText, 'qr');
              if (!isKioskMode) {
                html5QrCode.stop().catch(() => {});
                el.style.display = 'none';
              }
            },
            (errorMessage) => {
            }
          );
        } catch (err: any) {
          console.error("Camera start error:", err);
          let userError = 'የካሜራ ስካነር ሊከፈት አልቻለም።';
          if (err?.name === 'NotAllowedError') {
            userError = 'ካሜራ ለመጠቀም ፈቃድ አልተሰጠም። እባክዎ ፈቃድ ይስጡ።';
          } else if (err?.name === 'NotReadableError') {
            userError = 'ካሜራው በሌላ መተግበሪያ እየተያዘ ሊሆን ይችላል። እባክዎ ስልክዎን ዳግም ያስጀምሩ።';
          }
          setScanErrorMessage(userError);
        }
      } else {
        setScanErrorMessage('የካሜራ ስካነር ሊከፈት አልቻለም።');
      }
    }
  };

  const todayIso = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(todayIso);
  const [dateTo, setDateTo] = useState(todayIso);

  const filteredAttendance = attendance.filter((a) => {
    const aDate = a.date || todayIso;
    const matchSession = a.sessionName === activeSession.nameAm;
    const matchDate = (!dateFrom || aDate >= dateFrom) && (!dateTo || aDate <= dateTo);
    return matchSession && matchDate;
  });

  const presentRecords = filteredAttendance.filter(a => a.status !== 'absent');
  const absentees = members.filter(m => 
    m.status === 'active' && 
    !filteredAttendance.some(a => a.memberId === m.id)
  );

  const handleExportAttendanceCSV = () => {
    const todayDate = new Date().toISOString().split('T')[0];
    const ethioDate = formatEthiopianDate(new Date());

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      'መለያ ቁጥር (Code)',
      'ሙሉ ስም (አማርኛ)',
      'Full Name (English)',
      'ስልክ ቁጥር (Phone)',
      'ክፍል (Department)',
      'ክፍለ-ጊዜ (Session)',
      'የመገኘት ሁኔታ (Status)',
      'ሰዓት (Time)',
      'ቀን (Gregorian Date)',
      'የኢትዮጵያ ቀን (Ethiopian Date)',
      'የመዘገበው (Recorded By)',
      'ማስታወሻ (Note)',
    ];

    const presentRows = presentRecords.map((rec) => {
      const mem = members.find((m) => m.id === rec.memberId || m.code === rec.memberCode);
      const statusLabel =
        rec.status === 'excused'
          ? 'ፈቃድ / Excused'
          : rec.status === 'absent'
          ? 'ቀርቷል / Absent'
          : 'ተገኝቷል / Present';

      return [
        rec.memberCode || mem?.code || '',
        rec.memberNameAm || mem?.fullNameAm || '',
        rec.memberNameEn || mem?.fullNameEn || '',
        mem?.phone || '',
        rec.department || mem?.department || '',
        rec.sessionName || activeSession.nameAm,
        statusLabel,
        rec.timestamp || '',
        rec.date || todayDate,
        ethioDate,
        rec.scannedBy || '',
        rec.note || '',
      ].map(escapeCsv).join(',');
    });

    const absentRows = absentees.map((mem) => {
      return [
        mem.code || '',
        mem.fullNameAm || '',
        mem.fullNameEn || '',
        mem.phone || '',
        mem.department || '',
        activeSession.nameAm,
        'ያልተገኘ / የቀረ (Absent)',
        '-',
        todayDate,
        ethioDate,
        '-',
        'ያልተገኘ',
      ].map(escapeCsv).join(',');
    });

    const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...presentRows, ...absentRows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanSessionName = activeSession.nameAm.replace(/[\s\/\\]+/g, '_');
    const dateRangeLabel = dateFrom && dateTo ? `${dateFrom}_እስከ_${dateTo}` : (dateFrom ? `ከ_${dateFrom}` : todayDate);
    link.setAttribute('download', `የመገኘት_ዝርዝር_${cleanSessionName}_${dateRangeLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setToast({
      name: 'የመገኘት መዝገብ ኤክስፖርት ተደርጓል',
      code: `${presentRows.length} ተገኝተዋል · ${absentRows.length} አልተገኙም`,
      status: 'present',
      msg: '✅ የዛሬው የመገኘት መዝገብ (CSV) በተሳካ ሁኔታ ወርዷል!',
    });
    setTimeout(() => setToast(null), 4000);
  };

  const handleOverrideAbsentStatus = (member: Member, newStatus: 'present' | 'excused') => {
    const currentTime = formatEthiopianTime(new Date());
    const todayDate = new Date().toISOString().split('T')[0];

    const newRecord: AttendanceRecord = {
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      memberId: member.id,
      memberNameAm: member.fullNameAm,
      memberNameEn: member.fullNameEn,
      memberCode: member.code,
      department: member.department,
      sessionName: activeSession.nameAm,
      timestamp: currentTime,
      date: todayDate,
      method: 'manual',
      status: newStatus,
      note: newStatus === 'excused' ? 'በአስተዳዳሪ ፈቃድ የተሰጠው' : 'በእጅ የተመዘገበ (Manual Override)',
      scannedBy: currentAdmin?.nameAm ? `${currentAdmin.nameAm}` : 'Admin',
    };

    onCheckIn(newRecord);
    setToast({
      name: member.fullNameAm || member.fullNameEn,
      code: member.code,
      status: 'present',
      msg: newStatus === 'excused' ? '🟡 ፈቃድ ተመዝግቧል (Marked Excused)' : '✅ ተገኝቷል ተብሎ ተመዝግቧል (Marked Present)',
    });
    setTimeout(() => setToast(null), 3500);
    playChime();
  };

  const openNoticeModal = (recipient: 'all' | Member) => {
    setNoticeRecipient(recipient);
    const targetName = recipient === 'all' ? 'የተወደዳችሁ ተማሪዎቻችን' : recipient.fullNameAm;
    const defaultMsg =
      `📢 *የዛሬው መርሐ ግብር ናፍቆትና መጠየቂያ*\n` +
      `⛪ *መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን የወልደ ዋሕድ ሰ/ት/ቤት*\n` +
      `═══════════════════════════\n\n` +
      `በክርስቶስ ፍጹም ሰላም እንደምን ቆያችሁ? ✝️\n\n` +
      `ውድ ${targetName}፡ ዛሬ በ"${activeSession.nameAm}" መርሐ ግብራችን ላይ ስላልተገኙ ትምህርቱም ሆነ በረከቱ ጎድሎብናልና ናፍቆታችን ይድረስዎ።\n\n` +
      `ያልተገኙበትን በቂ ምክንያት ወይም ፈቃድ ካለዎት እባክዎ በቴሌግራም ቦቱ በኩል "✉️ የፈቃድ መጠየቂያ" በመላክ ወይም አስተዳደሩን በማነጋገር ያሳውቁን።\n\n` +
      `የእግዚአብሔር ጸጋና ሰላም ከእርስዎ ጋር ይሁን።\n` +
      `✍️ ከ፡ ${currentAdmin?.nameAm || 'የሰንበት ት/ቤት አስተዳደር'}`;
    setNoticeMessageText(defaultMsg);
    setNoticeModalOpen(true);
  };

  const handleSendNotice = async () => {
    if (!noticeMessageText.trim()) return;
    setIsSendingNotice(true);
    try {
      const targets = noticeRecipient === 'all' ? absentees : [noticeRecipient];
      const targetTgIds = targets.map((m) => m.telegramId).filter(Boolean);

      await addDoc(collection(db, 'notifications'), {
        title: 'የዛሬው መርሐ ግብር ናፍቆትና መጠየቂያ',
        message: noticeMessageText,
        senderName: currentAdmin?.nameAm || 'አስተዳዳሪ',
        targetCount: targets.length,
        recipient: noticeRecipient === 'all' ? 'all_absentees' : noticeRecipient.fullNameAm,
        sessionName: activeSession.nameAm,
        createdAt: new Date().toISOString(),
        isBroadcast: noticeRecipient === 'all',
      }).catch(console.warn);

      let sentCount = 0;
      for (const tgId of targetTgIds) {
        if (tgId) {
          try {
            const res = await sendTelegramMessage(tgId, noticeMessageText, { parseMode: 'Markdown' });
            if (res.ok) sentCount++;
          } catch {}
        }
      }

      setNoticeModalOpen(false);
      const recipientDesc = noticeRecipient === 'all' ? `ለ ${targets.length} የቀሩ ተማሪዎች` : `ለተማሪ ${noticeRecipient.fullNameAm}`;
      setToast({
        name: 'ማሳሰቢያ ተልኳል',
        code: `${sentCount} በቴሌግራም ደርሷል`,
        status: 'present',
        msg: `✅ የማሳሰቢያ መልእክት ${recipientDesc} በተሳካ ሁኔታ ተልኳል!`,
      });
      setTimeout(() => setToast(null), 5000);
    } catch (err) {
      setToast({
        name: 'ስህተት ተከስቷል',
        code: 'ERR',
        status: 'already',
        msg: 'ማሳሰቢያውን መላክ አልተሳካም። እባክዎ እንደገና ይሞክሩ።',
      });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setIsSendingNotice(false);
    }
  };

  return (
    <div className={`space-y-6 ${isKioskMode ? 'fixed inset-0 z-50 bg-[#062414] p-6 overflow-y-auto' : ''}`}>
      <div id="qr-reader" className="hidden w-full max-w-sm mx-auto mb-4 border border-emerald-900 rounded-2xl overflow-hidden"></div>
      
      {/* Toast Pop-up */}
      {toast && (
        <div className={`fixed top-20 left-4 right-4 z-50 p-6 border-4 border-white rounded-3xl shadow-2xl text-center text-slate-950 animate-bounce ${
          toast.status === 'already' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-slate-950'
        }`}>
          <h2 className="text-2xl font-black">{toast.name}</h2>
          <p className="font-mono font-bold mt-1">{toast.code}</p>
          <p className="text-sm mt-2 font-bold">{toast.msg || '✅ ተመዝግበዋል / Present'}</p>
        </div>
      )}

      {/* Scanner & Input */}
      <div className="p-6 bg-[#09351c] border border-[#0f4425] rounded-2xl text-center shadow-xl">
        <div className="w-14 h-14 rounded-2xl bg-[#062414] border border-[#0f4425] text-amber-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
          <QrCode className="w-7 h-7" />
        </div>
        <button type="button" onClick={handleScanWithCamera} className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition active:scale-95 text-xs">
          <Camera className="w-4 h-4" />
          <span>📷 በካሜራ QR ኮድ ስካን ያድርጉ</span>
        </button>
        {scanErrorMessage && (
          <div className="mt-3 p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{scanErrorMessage}</span>
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); handleProcessCode(codeQuery, 'manual'); }} className="mt-4 flex items-center gap-2">
          <input type="text" value={codeQuery} onChange={(e) => setCodeQuery(e.target.value)} placeholder="መለያ ቁጥር" className="flex-1 px-3.5 py-2.5 bg-[#062414] border border-[#0f4425] rounded-xl text-xs text-white" />
          <button type="submit" className="px-4 py-2.5 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold">መዝግብ</button>
        </form>
      </div>

      {/* Attendance Lists */}
      <div className="bg-[#09351c] border border-[#0f4425] rounded-3xl p-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-[#0f4425] pb-4">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              <span>የዛሬ መገኘት ክትትል</span>
            </h2>
            <p className="text-xs text-amber-400/80 font-bold mt-1">
              📅 {formatEthiopianDate(new Date())}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExportAttendanceCSV}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all shadow-sm hover:scale-102 active:scale-95 cursor-pointer"
              title="የመገኘት መዝገብ ኤክስፖርት አድርግ (Export Attendance CSV)"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>ኤክስፖርት (Export CSV)</span>
            </button>
            <div className="px-4 py-2 rounded-2xl bg-[#062414] border border-[#0f4425] text-center">
              <p className="text-[10px] text-emerald-200/60 uppercase font-black tracking-widest">አሁኑ ክፍለ-ጊዜ</p>
              <p className="text-sm font-black text-white">{activeSession.nameAm}</p>
            </div>
          </div>
        </div>

        {/* Date Range Filter Bar */}
        <div className="bg-[#062414] p-4 rounded-2xl border border-[#0f4425] mb-6 flex flex-wrap items-center justify-between gap-3 shadow-inner">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-white">በቀን ማጣሪያ (Date Range Filter):</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-emerald-200/70">ከ (From):</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-2.5 py-1.5 bg-[#09351c] border border-[#0f4425] rounded-xl text-xs text-white font-mono"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-emerald-200/70">እስከ (To):</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-2.5 py-1.5 bg-[#09351c] border border-[#0f4425] rounded-xl text-xs text-white font-mono"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold cursor-pointer"
              >
                ሁሉንም አሳይ (All Days)
              </button>
            )}
          </div>
        </div>

        {/* Child Navigation Bar for Present vs Absent */}
        <div className="bg-[#062414] p-1.5 rounded-2xl border border-[#0f4425] mb-6 flex items-center gap-1.5 shadow-inner">
          <button
            type="button"
            onClick={() => setAttendanceTab('present')}
            className={`flex-1 flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-black transition-all duration-300 cursor-pointer ${
              attendanceTab === 'present'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'text-emerald-200/50 hover:text-white hover:bg-[#0f4425]'
            }`}
          >
            <UserCheck className={`w-4 h-4 ${attendanceTab === 'present' ? 'text-slate-950' : 'text-emerald-500'}`} />
            <span className="whitespace-nowrap">የተመዘገቡ (Present)</span>
            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
              attendanceTab === 'present' ? 'bg-slate-950/20 text-slate-950' : 'bg-[#0f4425] text-emerald-300'
            }`}>
              {presentRecords.length}
            </span>
          </button>
          
          <div className="w-px h-6 bg-[#0f4425]" />

          <button
            type="button"
            onClick={() => setAttendanceTab('absent')}
            className={`flex-1 flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-black transition-all duration-300 cursor-pointer ${
              attendanceTab === 'absent'
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                : 'text-rose-200/50 hover:text-white hover:bg-[#0f4425]'
            }`}
          >
            <UserMinus className={`w-4 h-4 ${attendanceTab === 'absent' ? 'text-white' : 'text-rose-500'}`} />
            <span className="whitespace-nowrap">ያልተመዘገቡ (Absent)</span>
            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
              attendanceTab === 'absent' ? 'bg-white/20 text-white' : 'bg-[#0f4425] text-rose-300'
            }`}>
              {absentees.length}
            </span>
          </button>
        </div>

        {/* Tab Content: Present or Absent */}
        {attendanceTab === 'present' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-black text-white">የተመዘገቡ ተማሪዎች ዝርዝር ({presentRecords.length})</h3>
              </div>
            </div>
            <div className="space-y-2 max-h-[500px] overflow-y-auto no-scrollbar">
              {presentRecords.length === 0 ? (
                <div className="text-center py-12 bg-[#062414] border border-[#0f4425] rounded-2xl">
                  <p className="text-emerald-400/60 text-xs font-bold">ምንም ተማሪ አልተመዘገበም (No students marked present yet)</p>
                </div>
              ) : (
                presentRecords.map((record) => (
                  <div key={record.id} className="p-3.5 rounded-xl bg-[#062414] border border-[#0f4425] flex items-center justify-between gap-3 text-xs hover:border-emerald-500/30 transition-colors">
                    <div>
                      <p className="font-bold text-white text-sm">{record.memberNameAm || record.memberNameEn}</p>
                      <p className="text-[11px] text-amber-400 mt-0.5">{record.memberCode} · ⏰ {record.timestamp}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select 
                        value={record.status} 
                        onChange={(e) => onUpdateAttendance?.(record.id, { status: e.target.value as any })}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold cursor-pointer"
                      >
                        <option value="present">🟢 ተገኝቷል</option>
                        <option value="absent">🔴 ቀርቷል</option>
                        <option value="excused">🟡 ፈቃድ</option>
                      </select>
                      {onDeleteAttendance && (
                        <button
                          type="button"
                          onClick={() => onDeleteAttendance(record.id)}
                          className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/60 transition-colors cursor-pointer"
                          title="መዝገቡን ሰርዝ (Delete Attendance)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <UserMinus className="w-5 h-5 text-rose-400" />
                <h3 className="text-sm font-black text-white">አልተገኙም / የቀሩ ተማሪዎች ({absentees.length})</h3>
              </div>
              <button
                type="button"
                onClick={() => openNoticeModal('all')}
                disabled={absentees.length === 0}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors text-xs font-bold cursor-pointer disabled:opacity-50"
                title="ለሁሉም የቀሩ ተማሪዎች ማሳሰቢያና ምክንያት መጠየቂያ ላክ"
              >
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>ማሳሰቢያ ላክ (Inquire All Absentees)</span>
              </button>
            </div>
            <div className="space-y-2 max-h-[500px] overflow-y-auto no-scrollbar">
              {absentees.length === 0 ? (
                <div className="text-center py-12 bg-[#062414] border border-[#0f4425] rounded-2xl">
                  <p className="text-emerald-400/60 text-xs font-bold">ሁሉም ተማሪዎች ተገኝተዋል (All students are present!)</p>
                </div>
              ) : (
                absentees.map((member) => (
                  <div key={member.id} className="p-3.5 rounded-xl bg-[#062414] border border-[#0f4425] flex items-center justify-between gap-3 text-xs hover:border-amber-500/30 transition-colors">
                    <div>
                      <p className="font-bold text-white text-sm">{member.fullNameAm || member.fullNameEn}</p>
                      <p className="text-[11px] text-emerald-400/60 mt-0.5">{member.code} · 📞 {member.phone}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Override Status Dropdown */}
                      <select
                        defaultValue="absent"
                        onChange={(e) => {
                          const val = e.target.value as 'present' | 'excused';
                          if (val === 'present' || val === 'excused') {
                            handleOverrideAbsentStatus(member, val);
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold cursor-pointer transition-colors"
                        title="ሁኔታውን ቀይር (Override Status)"
                      >
                        <option value="absent">🔴 ቀርቷል (Absent)</option>
                        <option value="present">🟢 ተገኝቷል (Mark Present)</option>
                        <option value="excused">🟡 ፈቃድ (Mark Excused)</option>
                      </select>

                      {/* Direct Individual Inquiry Notice Button */}
                      <button
                        type="button"
                        onClick={() => openNoticeModal(member)}
                        disabled={!member.telegramId}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                          member.telegramId
                            ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-slate-800/50 text-slate-500 border-slate-700/50 cursor-not-allowed'
                        }`}
                        title={member.telegramId ? "ለምን እንደቀረ/ች ጠይቅ (Send Inquiry Notice)" : "የቴሌግራም መለያ አልተገናኘም (No Telegram Linked)"}
                      >
                        <Send className={`w-3.5 h-3.5 ${member.telegramId ? 'text-amber-400' : 'text-slate-600'}`} />
                        <span className="hidden sm:inline">መልእክት</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Absentee Notice & Inquiry Modal */}
      {noticeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#09351c] border border-amber-500/40 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative text-left">
            <button
              onClick={() => setNoticeModalOpen(false)}
              className="absolute top-4 right-4 text-emerald-200/60 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pb-3 border-b border-[#0f4425]">
              <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  የቀሩ ተማሪዎች ማሳሰቢያና ምክንያት መጠየቂያ
                </h3>
                <p className="text-xs text-emerald-200/70">
                  {noticeRecipient === 'all'
                    ? `ለሁሉም የቀሩ ተማሪዎች (${absentees.length} ተማሪዎች) መልእክት መላኪያ`
                    : `ለተማሪ ${(noticeRecipient as Member).fullNameAm} (${(noticeRecipient as Member).phone}) መልእክት መላኪያ`}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-emerald-200 mb-1.5">
                  የመልእክቱ ይዘት (Message Content) *
                </label>
                <textarea
                  rows={8}
                  value={noticeMessageText}
                  onChange={(e) => setNoticeMessageText(e.target.value)}
                  className="w-full p-3.5 bg-[#062414] border border-[#0f4425] rounded-2xl text-xs text-white focus:outline-none focus:border-amber-400 font-sans leading-relaxed"
                  placeholder="የማሳሰቢያውን መልእክት እዚህ ይጻፉ..."
                />
              </div>

              <div className="p-3 rounded-xl bg-[#062414] border border-[#0f4425] text-[11px] text-emerald-200/80 space-y-1">
                <p>💡 <strong>ማስታወሻ፦</strong> ይህ መልእክት በሲስተሙ ማስታወቂያ ሰሌዳ ላይ የሚመዘገብ ሲሆን የቴሌግራም መለያ ላላቸው ተማሪዎች በቀጥታ ይደርሳቸዋል።</p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#0f4425]">
                <button
                  type="button"
                  disabled={isSendingNotice}
                  onClick={() => setNoticeModalOpen(false)}
                  className="px-4 py-2.5 text-emerald-200/70 hover:text-white disabled:opacity-50 text-xs font-bold cursor-pointer"
                >
                  ሰርዝ (Cancel)
                </button>
                <button
                  type="button"
                  disabled={isSendingNotice || !noticeMessageText.trim()}
                  onClick={handleSendNotice}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-xs font-black shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSendingNotice ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                      <span>በመላክ ላይ...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>መልእክት ላክ (Send Notice)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
