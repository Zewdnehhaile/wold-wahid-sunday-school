import React, { useState, useEffect, useRef } from 'react';
import { Member, AttendanceRecord, ServiceSession, Language, AdminUser } from '../types';
import { t } from '../utils/translations';
import { formatEthiopianDate, formatEthiopianTime } from '../utils/ethiopianCalendar';
import { sendTelegramMessage } from '../utils/telegram';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
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

  const currentAttendance = attendance.filter((a) => a.sessionName === activeSession.nameAm);
  const presentRecords = currentAttendance.filter(a => a.status !== 'absent');
  const absentees = members.filter(m => 
    m.status === 'active' && 
    !currentAttendance.some(a => a.memberId === m.id)
  );

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
          <div className="px-4 py-2 rounded-2xl bg-[#062414] border border-[#0f4425] text-center">
            <p className="text-[10px] text-emerald-200/60 uppercase font-black tracking-widest">አሁኑ ክፍለ-ጊዜ</p>
            <p className="text-sm font-black text-white">{activeSession.nameAm}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Present List */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <UserCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-black text-white">የተመዘገቡ ተማሪዎች ({presentRecords.length})</h3>
            </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto no-scrollbar">
            {presentRecords.length === 0 ? (
              <p className="text-center py-8 text-emerald-900/40 text-xs italic">ምንም ተማሪ አልተመዘገበም</p>
            ) : (
              presentRecords.map((record) => (
                <div key={record.id} className="p-3 rounded-xl bg-[#062414] border border-[#0f4425] flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-white">{record.memberNameAm || record.memberNameEn}</p>
                    <p className="text-[11px] text-amber-400">{record.memberCode} · ⏰ {record.timestamp}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select 
                      value={record.status} 
                      onChange={(e) => onUpdateAttendance?.(record.id, { status: e.target.value as any })}
                      className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold"
                    >
                      <option value="present">🟢 ተገኝቷል</option>
                      <option value="absent">🔴 ቀርቷል</option>
                      <option value="excused">🟡 ፈቃድ</option>
                    </select>
                    {onDeleteAttendance && (
                      <button
                        type="button"
                        onClick={() => onDeleteAttendance(record.id)}
                        className="p-1 rounded-lg text-rose-400 hover:bg-rose-950/60 transition-colors cursor-pointer"
                        title="መዝገቡን ሰርዝ (Delete Attendance)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Absentees List */}
        <div className="bg-[#09351c] border border-[#0f4425] rounded-2xl p-5 shadow-xl h-fit">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <UserMinus className="w-5 h-5 text-rose-400" />
              <h3 className="text-sm font-bold text-white">አልተገኙም (Absentees) ({absentees.length})</h3>
            </div>
            <button
              onClick={async () => {
                if (absentees.length === 0) return;
                const absenteeTgIds = absentees.map(m => m.telegramId).filter(Boolean);
                if (window.confirm(`${absentees.length} ተማሪዎች ዛሬ አልተገኙም። መንፈሳዊ የማሳሰቢያ መልእክት ለሁሉም መላክ ይፈልጋሉ?`)) {
                  try {
                    const absentMsg =
                      `📢 *የዛሬው መርሐ ግብር ናፍቆት*\n` +
                      `⛪ *መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን*\n` +
                      `═══════════════════════\n\n` +
                      `በክርስቶስ ፍጹም ሰላም እንደምን ቆያችሁ? ✝️\n\n` +
                      `ዛሬ በ"${activeSession.nameAm}" መርሐ ግብራችን ላይ ስላልተገኙ ትምህርቱም ሆነ በረከቱ ጎድሎብናልና ናፍቆታችን ይድረስዎት።\n\n` +
                      `ምናልባትም በበቂ ምክንያት ከሆነ በቦቱ በኩል "✉️ የፈቃድ መጠየቂያ" እንዲልኩ እናሳስባለን።\n\n` +
                      `የእግዚአብሔር ጸጋና ሰላም ከእርስዎ ጋር ይሁን።\n` +
                      `✍️ ከ፡ ${currentAdmin?.nameAm || 'አስተዳዳሪ'}`;

                    await addDoc(collection(db, 'notifications'), {
                      title: 'የዛሬው መርሐ ግብር ናፍቆት',
                      message: absentMsg,
                      senderName: currentAdmin?.nameAm || 'አስተዳዳሪ',
                      createdAt: new Date().toISOString(),
                      isBroadcast: true
                    }).catch(console.warn);

                    let sentCount = 0;
                    for (const tgId of absenteeTgIds) {
                      if (tgId) {
                        const res = await sendTelegramMessage(tgId, absentMsg, { parseMode: 'Markdown' });
                        if (res.ok) sentCount++;
                      }
                    }
                    alert(`የማሳሰቢያ መልእክቱ ለ ${sentCount} ተማሪዎች በቴሌግራም ተልኳል!`);
                  } catch (err) {
                    alert('መልእክቱን መላክ አልተቻለም። እባክዎ እንደገና ይሞክሩ።');
                  }
                }
              }}
              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors"
              title="ማሳሰቢያ ላክ"
            >
              <AlertCircle className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto no-scrollbar">
            {absentees.length === 0 ? (
              <p className="text-center py-8 text-emerald-900/40 text-xs italic">ሁሉም ተማሪዎች ተገኝተዋል</p>
            ) : (
              absentees.map((member) => (
                <div key={member.id} className="p-3 rounded-xl bg-[#062414] border border-[#0f4425] flex items-center justify-between gap-3 text-xs opacity-70">
                  <div>
                    <p className="font-bold text-white/80">{member.fullNameAm}</p>
                    <p className="text-[10px] text-slate-500">{member.code} · {member.phone}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[9px] font-bold">ያልተገኘ</span>
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
