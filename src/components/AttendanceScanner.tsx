import React, { useState, useEffect, useRef } from 'react';
import { Member, AttendanceRecord, ServiceSession, Language, AdminUser } from '../types';
import { t } from '../utils/translations';
import { formatEthiopianDate } from '../utils/ethiopianCalendar';
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
  const [toast, setToast] = useState<{ name: string; code: string } | null>(null);
  
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
          ? `❌ የተማሪ መለያ ኮድ "${raw}" በሲስተሙ አልተገኘም።`
          : `Student code "${raw}" not found.`
      );
      return;
    }

    setScanErrorMessage('');

    const alreadyCheckedIn = attendance.some(
      (att) => att.memberId === member.id && att.sessionName === activeSession.nameAm
    );

    if (alreadyCheckedIn) {
      setScanErrorMessage('⚠️ አስቀድሞ ዛሬ ተመዝግቧል');
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
      scannedBy: currentAdmin?.nameAm ? `${currentAdmin.nameAm}` : 'Admin',
      status: 'present',
    };

    onCheckIn(newRecord);
    setToast({ name: member.fullNameAm || member.fullNameEn, code: member.code });
    setTimeout(() => setToast(null), 3000);
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
        
        // Use the core Html5Qrcode class for explicit control over constraints
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
          // Explicitly request environment (back) camera
          await html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
              handleProcessCode(decodedText, 'qr');
              // Optionally stop after first scan in non-kiosk mode
              if (!isKioskMode) {
                html5QrCode.stop().catch(() => {});
                el.style.display = 'none';
              }
            },
            (errorMessage) => {
              // Ignore silent errors
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

  const presentCount = attendance.filter((a) => a.sessionName === activeSession.nameAm && a.status !== 'absent').length;
  const guestCount = attendance.filter((a) => a.sessionName === activeSession.nameAm && a.isGuest).length;
  const totalMembersCount = members.length;
  const attendanceRate = totalMembersCount > 0 ? Math.round((presentCount / totalMembersCount) * 100) : 0;

  return (
    <div className={`space-y-6 ${isKioskMode ? 'fixed inset-0 z-50 bg-[#062414] p-6 overflow-y-auto' : ''}`}>
      <div id="qr-reader" className="hidden w-full max-w-sm mx-auto mb-4 border border-emerald-900 rounded-2xl overflow-hidden"></div>
      
      {/* Toast Pop-up */}
      {toast && (
        <div className="fixed top-20 left-4 right-4 z-50 p-6 bg-emerald-500 border-4 border-white rounded-3xl shadow-2xl text-center text-slate-950 animate-bounce">
          <h2 className="text-2xl font-black">{toast.name}</h2>
          <p className="font-mono font-bold mt-1">{toast.code}</p>
          <p className="text-sm mt-2">✅ ተመዝግበዋል / Present</p>
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
        {scanErrorMessage && <p className="text-red-400 text-xs mt-3">{scanErrorMessage}</p>}
        <form onSubmit={(e) => { e.preventDefault(); handleProcessCode(codeQuery, 'manual'); }} className="mt-4 flex items-center gap-2">
          <input type="text" value={codeQuery} onChange={(e) => setCodeQuery(e.target.value)} placeholder="መለያ ቁጥር" className="flex-1 px-3.5 py-2.5 bg-[#062414] border border-[#0f4425] rounded-xl text-xs text-white" />
          <button type="submit" className="px-4 py-2.5 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold">መዝግብ</button>
        </form>
      </div>

      {/* Attendance List */}
      <div className="bg-[#09351c] border border-[#0f4425] rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white">የተመዘገቡ ተማሪዎች ({attendance.length})</h3>
          <button
            onClick={async () => {
              const absentees = members.filter(m => 
                m.status === 'active' && 
                !attendance.some(a => a.memberId === m.id && a.sessionName === activeSession.nameAm)
              );
              
              const targetIds = absentees.map(m => m.telegramId).filter(Boolean);
              
              if (targetIds.length === 0) {
                alert('ከተቀሩት ተማሪዎች መካከል የቴሌግራም አካውንታቸው የተገናኘ ተማሪ አልተገኘም (No linked Telegram accounts found).');
                return;
              }

              if (confirm(`${absentees.length} ተማሪዎች ዛሬ አልተገኙም። መንፈሳዊ የማሳሰቢያ መልእክት ለ ${targetIds.length} ተማሪዎች መላክ ይፈልጋሉ?`)) {
                try {
                  const res = await fetch('/api/notifications/broadcast', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      title: 'የዛሬው መርሐ ግብር ናፍቆት',
                      message: `ሰላም ለኪ/ለከ ይሁን! ✝️\n\nዛሬ በ"${activeSession.nameAm}" መርሐ ግብራችን ላይ ስላልተገኙ ትምህርቱም ሆነ በረከቱ ጎድሎብናልና አዝነናል።\n\nምናልባትም በምክንያት ከሆነ የፈቃድ መጠየቂያ በቦቱ በኩል እንዲልኩ እናሳስባለን።\n\nየእግዚአብሔር ጸጋና ሰላም ከእርስዎ ጋር ይሁን።`,
                      senderName: currentAdmin?.nameAm || 'አስተዳዳሪ',
                      targetIds: targetIds
                    }),
                  });
                  const data = await res.json();
                  alert(`መልእክቱ ለ ${data.sentToTelegram || 0} ተማሪዎች ተልኳል።`);
                } catch (err) {
                  alert('መልእክቱን መላክ አልተቻለም።');
                }
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold transition-colors"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>አልተገኙም (Absentees)</span>
          </button>
        </div>
        <div className="space-y-2">
          {attendance.map((record) => (
            <div key={record.id} className="p-3 rounded-xl bg-[#062414] border border-[#0f4425] flex items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-bold text-white">{record.memberNameAm || record.memberNameEn}</p>
                <p className="text-[11px] text-amber-400">{record.memberCode} · ⏰ {record.timestamp}</p>
              </div>
              <select 
                value={record.status} 
                onChange={(e) => onUpdateAttendance?.(record.id, { status: e.target.value as any })}
                className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                  record.status === 'absent' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                  record.status === 'excused' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                  'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}
              >
                <option value="present">🟢 ተገኝቷል</option>
                <option value="absent">🔴 ቀርቷል</option>
                <option value="excused">🟡 ፈቃድ</option>
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
