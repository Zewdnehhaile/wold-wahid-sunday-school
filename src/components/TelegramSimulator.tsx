import React, { useState } from 'react';
import { Member, AttendanceRecord, DayOfWeek, GradeLevel, Language, LeaveRequest } from '../types';
import { QRCodeView } from './QRCodeView';
import { FITHAPOL_LOGO, WOLD_WAHID_SCHEDULE, INITIAL_LEAVE_REQUESTS } from '../data/initialData';
import { t } from '../utils/translations';
import {
  Smartphone,
  Send,
  QrCode,
  Calendar,
  HeartHandshake,
  CheckCheck,
  Shield,
  Key,
  GraduationCap,
  Sparkles,
  User,
  ClipboardList,
  PhoneCall,
  Clock,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  FileText,
  Lock,
  MapPin,
  XCircle,
  Check,
  X,
} from 'lucide-react';

interface TelegramSimulatorProps {
  members: Member[];
  attendance: AttendanceRecord[];
  lang: Language;
}

type BotScreen =
  | 'menu'
  | 'register'
  | 'register_success'
  | 'attendance'
  | 'profile'
  | 'history'
  | 'schedule_classes'
  | 'schedule_days'
  | 'support'
  | 'leave_request'
  | 'leave_success'
  | 'admin'
  | 'pass';

export const TelegramSimulator: React.FC<TelegramSimulatorProps> = ({
  members,
  attendance,
  lang,
}) => {
  const [activeScreen, setActiveScreen] = useState<BotScreen>('menu');
  const [selectedUserMode, setSelectedUserMode] = useState<'student_approved' | 'student_pending' | 'super_admin'>('student_approved');
  const [selectedClass, setSelectedClass] = useState<GradeLevel>('pre_kg');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('sunday');

  // Attendance Geofence & PIN Presence Verification State
  const [attMethod, setAttMethod] = useState<'select' | 'gps' | 'pin'>('select');
  const [gpsSimMode, setGpsSimMode] = useState<'none' | 'success_near' | 'fail_far'>('none');
  const [pinInput, setPinInput] = useState<string>('');
  const [pinStatus, setPinStatus] = useState<'idle' | 'success' | 'fail'>('idle');
  const [todayAttendanceMarked, setTodayAttendanceMarked] = useState<boolean>(false);

  // Leave Requests State (Support Center)
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(INITIAL_LEAVE_REQUESTS);
  const [leaveType, setLeaveType] = useState<string>('🤒 የህመም ፈቃድ (Medical / Sick)');
  const [leaveDuration, setLeaveDuration] = useState<string>('1 እሁድ');
  const [leaveReason, setLeaveReason] = useState<string>('');
  const [lastSubmittedLeave, setLastSubmittedLeave] = useState<LeaveRequest | null>(null);

  // Registration mock state
  const [regForm, setRegForm] = useState({
    name: 'ኪዱስ ያሬድ',
    phone: '0911223344',
    grade: '6ኛ–9ኛ ክፍል',
    gender: 'ወንድ',
  });

  const dict = t[lang];

  // Pick mock member based on mode
  const currentMember: Member =
    selectedUserMode === 'student_pending'
      ? {
          id: 'temp-pending',
          code: '',
          fullNameAm: 'ዮናስ መኮንን (አዲስ)',
          fullNameEn: 'Yonas Mekonnen',
          phone: '+251955667788',
          gender: 'male',
          department: 'education',
          gradeLevel: 'grade_6_9',
          roleAm: 'ተማሪ',
          roleEn: 'Student',
          photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
          status: 'pending_approval',
          registeredDate: '2026-10-16',
          bloodGroup: 'O+',
          emergencyContact: { name: 'አቶ መኮንን', phone: '0911000000', relation: 'አባት' },
          subcity: 'ቂርቆስ',
          consecutiveAbsences: 0,
        }
      : selectedUserMode === 'super_admin'
      ? {
          id: 'admin-kidus',
          code: 'ADMIN-001',
          fullNameAm: 'ኪዱስ ያሬድ (Super Admin)',
          fullNameEn: 'Kiduz Yared',
          phone: '+251911223344',
          gender: 'male',
          gradeLevel: 'leaders',
          department: 'discipline',
          roleAm: 'ዋና አስተዳዳሪ',
          roleEn: 'Super Admin',
          photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
          status: 'active',
          registeredDate: '2026-01-01',
          bloodGroup: 'A+',
          emergencyContact: { name: 'ቤተሰብ', phone: '0911223344', relation: 'ቤተሰብ' },
          subcity: 'ቦሌ',
          consecutiveAbsences: 0,
        }
      : members[0];

  const classSchedule = WOLD_WAHID_SCHEDULE.filter((item) => item.gradeLevel === selectedClass);
  const daySchedule = WOLD_WAHID_SCHEDULE.filter((item) => item.day === selectedDay);

  const classLabels: Record<GradeLevel, string> = {
    pre_kg: '🧸 ቅድመ አንደኛ',
    grade_1_2: '🎒 1ኛ እና 2ኛ ክፍል',
    grade_3_5: '📚 3ኛ–5ኛ ክፍል',
    grade_6_9: '🎓 6ኛ–9ኛ ክፍል',
    leaders: '🛡️ መምህራንና አስተዳዳሪዎች',
  };

  const handleOpenAttendance = () => {
    setAttMethod('select');
    setGpsSimMode('none');
    setPinInput('');
    setPinStatus('idle');
    setActiveScreen('attendance');
  };

  const handleGpsSimulate = (isNear: boolean) => {
    if (isNear) {
      setGpsSimMode('success_near');
      setTodayAttendanceMarked(true);
    } else {
      setGpsSimMode('fail_far');
    }
  };

  const handlePinSubmit = () => {
    if (pinInput.trim() === '2026') {
      setPinStatus('success');
      setTodayAttendanceMarked(true);
    } else {
      setPinStatus('fail');
    }
  };

  const handleSubmitLeave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveReason.trim()) return;

    const newLeave: LeaveRequest = {
      id: `lv-${Date.now()}`,
      requestNumber: `LV-202610-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      memberId: currentMember.id,
      studentName: currentMember.fullNameAm,
      studentCode: currentMember.code,
      telegramId: 5281238412,
      leaveType,
      duration: leaveDuration,
      reason: leaveReason,
      status: 'pending',
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
    };

    setLeaveRequests([newLeave, ...leaveRequests]);
    setLastSubmittedLeave(newLeave);
    setActiveScreen('leave_success');
    setLeaveReason('');
  };

  const handleApproveLeave = (leaveId: string) => {
    setLeaveRequests(
      leaveRequests.map((l) =>
        l.id === leaveId ? { ...l, status: 'approved' as const, approvedBy: 'ኪዱስ ያሬድ (Super Admin)' } : l
      )
    );
  };

  const handleRejectLeave = (leaveId: string) => {
    setLeaveRequests(
      leaveRequests.map((l) =>
        l.id === leaveId ? { ...l, status: 'rejected' as const, approvedBy: 'ኪዱስ ያሬድ (Super Admin)' } : l
      )
    );
  };

  const pendingLeavesCount = leaveRequests.filter((l) => l.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>{dict.nav.telegram} (Telegram Bot User Experience)</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              @attendanceforchurchbot
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            በተጠቃሚው በኩል የሚታዩ አገልግሎቶች፦ ምዝገባ፣ በአካል መገኘት ማረጋገጫ (GPS Geofence)፣ የፈቃድ መጠየቂያ (Leave Request) እና አድሚን ዳሽቦርድ
          </p>
        </div>

        {/* User Persona Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-xs text-slate-400 px-2 font-medium">የተጠቃሚ እይታ:</span>
          <button
            onClick={() => {
              setSelectedUserMode('student_approved');
              setActiveScreen('menu');
            }}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
              selectedUserMode === 'student_approved'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            ✅ የጸደቀ ተማሪ
          </button>
          <button
            onClick={() => {
              setSelectedUserMode('student_pending');
              setActiveScreen('menu');
            }}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
              selectedUserMode === 'student_pending'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            ⏳ አዲስ/ያልጸደቀ
          </button>
          <button
            onClick={() => {
              setSelectedUserMode('super_admin');
              setActiveScreen('menu');
            }}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
              selectedUserMode === 'super_admin'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            👑 Super Admin (ኪዱስ)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Bot Documentation & Feature Checklist */}
        <div className="lg:col-span-5 space-y-4">
          {/* Exact User Request Feature Verification */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>በቦቱ ላይ የተካተቱ የተጠቃሚ አገልግሎቶች፦</span>
            </h4>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-start gap-2">
                <span className="text-base leading-none">📍</span>
                <div>
                  <strong className="text-emerald-400">ሳይመጣ መመዝገብ መከልከያ (Presence Verification):</strong>
                  <p className="text-[11px] text-slate-400">
                    ተማሪው በአካል ቅጥር ግቢው ውስጥ ሳይገኝ ከቤት መመዝገብ አይችልም! በ <strong>GPS Geofence (እስከ 300 ሜትር)</strong> ወይም በ <strong>Demo Class PIN (2026)</strong> መገኘቱን ያረጋግጣል።
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-base leading-none">📝</span>
                <div>
                  <strong className="text-purple-400">የፈቃድ መጠየቂያ (Leave Requests in Support):</strong>
                  <p className="text-[11px] text-slate-400">
                    በ Support Center ስር ተማሪዎች የህመም፣ የፈተና፣ የቤተሰብ ወይም የጉዞ ፈቃድ ቆይታና ምክንያት ሞልተው ይልካሉ፤ ለአድሚኑ ወዲያው ማጽደቂያ ይደርሳል።
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-base leading-none">📝</span>
                <div>
                  <strong className="text-amber-300">Register Profile:</strong>
                  <p className="text-[11px] text-slate-400">
                    ተማሪው ስሙን፣ ስልኩን፣ ክፍሉንና ጾታውን መዝግቦ ይልካል፤ አድሚኑ በእጅ Student ID እስኪያጸድቅ በ <code className="text-amber-300">pending</code> ይቀመጣል።
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-base leading-none">👤</span>
                <div>
                  <strong className="text-amber-300">My Profile & QR Card:</strong>
                  <p className="text-[11px] text-slate-400">
                    የተማሪው ስም፣ የተመደበለት Student ID፣ ክፍል፣ እና በበሩ ስካነር ላይ የሚታይ ዲጂታል QR ካርድ።
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-base leading-none">🗓️</span>
                <div>
                  <strong className="text-amber-300">Class Schedule:</strong>
                  <p className="text-[11px] text-slate-400">
                    ቅድመ አንደኛ፣ 1ኛ–2ኛ፣ 3ኛ–5ኛ፣ 6ኛ–9ኛ እና አርብ/ቅዳሜ/እሁድ መርሐ ግብር።
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-base leading-none">🔐</span>
                <div>
                  <strong className="text-amber-300">Admin Dashboard:</strong>
                  <p className="text-[11px] text-slate-400">
                    ለ Super Admin (ID: 5281238412) ፈጣን ቁጥጥር፣ ያልጸደቁ ተማሪዎችንና ፈቃዶችን ማጽደቅ/ውድቅ ማድረግ።
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Super Admin ID Card */}
          <div className="p-4 bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/40 rounded-2xl text-xs space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold">
              <Key className="w-4 h-4" />
              <span>የእርስዎ ቋሚ Super Admin ውቅር፦</span>
            </div>
            <div className="font-mono text-[11px] text-slate-300 space-y-1">
              <p>• BOT_TOKEN: <code className="text-amber-300">configured privately in .env</code></p>
              <p>• SUPER_ADMIN_ID: <code className="text-amber-300">5281238412</code></p>
              <p>• BOT_USERNAME: <code className="text-amber-300">@attendanceforchurchbot</code></p>
              <p>• GEO_FENCE: <code className="text-emerald-400">300m Radius Around School</code></p>
              <p>• DEMO PIN: <code className="text-cyan-300">2026 (demo only)</code></p>
            </div>
          </div>
        </div>

        {/* Right: Phone Simulation of Telegram */}
        <div className="lg:col-span-7 flex justify-center">
          <div className="w-full max-w-[390px] bg-slate-950 border-4 border-slate-800 rounded-[36px] overflow-hidden shadow-2xl relative flex flex-col min-h-[640px]">
            {/* Telegram Header */}
            <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between z-10">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setActiveScreen('menu')}
                  className="p-1 -ml-1 text-slate-400 hover:text-white rounded-lg transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center overflow-hidden">
                  <img src={FITHAPOL_LOGO} alt="Fithapol" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1">
                    <span>Fithapol Sunday School</span>
                    <span className="text-[10px] text-amber-400">✓</span>
                  </h4>
                  <p className="text-[10px] text-emerald-400 font-mono">bot • @attendanceforchurchbot</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="text-[10px] text-slate-400">online</span>
              </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 p-3.5 space-y-3 overflow-y-auto bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
              {/* Bot Message Bubble (Exact Welcome Text from user's screenshot) */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-3 max-w-[98%] shadow-lg">
                <div className="flex items-center gap-2">
                  <span className="text-base">🙏</span>
                  <p className="text-xs font-bold text-amber-400">
                    Welcome to Fithapol Sunday School, {currentMember.fullNameAm.split(' ')[0]}!
                  </p>
                </div>
                <p className="text-xs text-slate-300">
                  Please choose an option below.
                </p>
              </div>

              {/* SCREEN: MAIN MENU BUTTONS (7 user buttons) */}
              {activeScreen === 'menu' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 gap-1.5">
                    <button
                      onClick={() => setActiveScreen('register')}
                      className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 rounded-xl text-white text-xs font-medium text-left flex items-center justify-between transition group shadow-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-base">📝</span>
                        <span className="group-hover:text-amber-300">Register Profile</span>
                      </span>
                      <span className="text-slate-500 text-[10px]">›</span>
                    </button>

                    <button
                      onClick={handleOpenAttendance}
                      className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 rounded-xl text-white text-xs font-medium text-left flex items-center justify-between transition group shadow-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-base">📋</span>
                        <span className="group-hover:text-emerald-300">Mark Attendance</span>
                      </span>
                      <span className="text-emerald-400 text-[10px] font-mono">📍 GPS/PIN</span>
                    </button>

                    <button
                      onClick={() => setActiveScreen('profile')}
                      className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 rounded-xl text-white text-xs font-medium text-left flex items-center justify-between transition group shadow-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-base">👤</span>
                        <span className="group-hover:text-amber-300">My Profile</span>
                      </span>
                      <span className="text-slate-500 text-[10px]">›</span>
                    </button>

                    <button
                      onClick={() => setActiveScreen('history')}
                      className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 rounded-xl text-white text-xs font-medium text-left flex items-center justify-between transition group shadow-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-base">📅</span>
                        <span className="group-hover:text-amber-300">My Attendance</span>
                      </span>
                      <span className="text-slate-500 text-[10px]">›</span>
                    </button>

                    <button
                      onClick={() => setActiveScreen('schedule_classes')}
                      className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 rounded-xl text-white text-xs font-medium text-left flex items-center justify-between transition group shadow-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-base">🗓️</span>
                        <span className="group-hover:text-amber-300">Class Schedule (የክፍል መርሐ ግብር)</span>
                      </span>
                      <span className="text-slate-500 text-[10px]">›</span>
                    </button>

                    <button
                      onClick={() => setActiveScreen('support')}
                      className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/40 rounded-xl text-white text-xs font-medium text-left flex items-center justify-between transition group shadow-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-base">🆘</span>
                        <span className="group-hover:text-purple-300">Support Center</span>
                      </span>
                      <span className="text-purple-400 text-[10px] font-mono">📝 የፈቃድ መጠየቂያ</span>
                    </button>

                    <button
                      onClick={() => setActiveScreen('admin')}
                      className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 rounded-xl text-white text-xs font-medium text-left flex items-center justify-between transition group shadow-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-base">🔐</span>
                        <span className="group-hover:text-amber-300">Admin Dashboard</span>
                      </span>
                      {selectedUserMode === 'super_admin' && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">
                          Super Admin ({pendingLeavesCount} ፈቃዶች)
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* SCREEN: REGISTER PROFILE */}
              {activeScreen === 'register' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-3 max-w-[98%] shadow-lg">
                  <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                    <span className="font-bold text-amber-400 text-xs flex items-center gap-1.5">
                      <span>📝</span>
                      <span>የተማሪ ምዝገባ (Student Registration)</span>
                    </span>
                    <button
                      onClick={() => setActiveScreen('menu')}
                      className="text-[10px] text-slate-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  {selectedUserMode === 'student_approved' ? (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs space-y-2">
                      <p className="font-bold">✅ ቀደም ሲል ተመዝግበው ጸድቀዋል!</p>
                      <p className="text-[11px] text-slate-300">
                        Student ID: <code className="text-amber-300 font-mono">{currentMember.code}</code>
                      </p>
                      <button
                        onClick={() => setActiveScreen('profile')}
                        className="w-full py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold"
                      >
                        👤 የእኔ ፕሮፋይል እይ
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">ሙሉ ስም (ስም + አባት + አያት)</label>
                        <input
                          type="text"
                          value={regForm.name}
                          onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">ስልክ ቁጥር</label>
                        <input
                          type="text"
                          value={regForm.phone}
                          onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">የክፍል ደረጃ (Grade)</label>
                          <select
                            value={regForm.grade}
                            onChange={(e) => setRegForm({ ...regForm, grade: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                          >
                            <option>ቅድመ አንደኛ</option>
                            <option>1ኛ እና 2ኛ ክፍል</option>
                            <option>3ኛ–5ኛ ክፍል</option>
                            <option>6ኛ–9ኛ ክፍል</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">ጾታ (Gender)</label>
                          <select
                            value={regForm.gender}
                            onChange={(e) => setRegForm({ ...regForm, gender: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                          >
                            <option>ወንድ</option>
                            <option>ሴት</option>
                          </select>
                        </div>
                      </div>

                      <div className="pt-2 flex gap-2">
                        <button
                          onClick={() => setActiveScreen('register_success')}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition"
                        >
                          ✓ ምዝገባውን ላክ (Submit)
                        </button>
                        <button
                          onClick={() => setActiveScreen('menu')}
                          className="px-3 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs"
                        >
                          ሰርዝ
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SCREEN: REGISTER SUCCESS (PENDING APPROVAL NOTICE) */}
              {activeScreen === 'register_success' && (
                <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-4 space-y-3 max-w-[98%] shadow-lg text-xs">
                  <div className="flex items-center gap-2 text-amber-400 font-bold">
                    <span className="text-lg">🎉</span>
                    <span>ምዝገባዎ በተሳካ ሁኔታ ተልኳል!</span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-slate-300">
                    <p>👤 <strong>ስም:</strong> {regForm.name}</p>
                    <p>📞 <strong>ስልክ:</strong> {regForm.phone}</p>
                    <p>🎒 <strong>ክፍል:</strong> {regForm.grade}</p>
                    <p className="text-amber-400 font-bold pt-1">
                      📌 ሁኔታ: ⏳ ማጽደቅ የሚጠብቅ (Pending Approval)
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    የሰንበት ት/ቤቱ ዋና አስተዳዳሪ (Super Admin) መርምረው የ <strong>Student ID</strong> ቁጥር በእጅ ከሰጡዎት በኋላ ማረጋገጫ ይደርስዎታል እና የQR ዲጂታል መታወቂያዎ ይዘጋጅልዎታል።
                  </p>
                  <button
                    onClick={() => setActiveScreen('menu')}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium"
                  >
                    ⬅️ ወደ ዋናው ገጽ ተመለስ
                  </button>
                </div>
              )}

              {/* SCREEN: MARK ATTENDANCE (WITH PRESENCE GEOFENCE CHECK) */}
              {activeScreen === 'attendance' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-3 max-w-[98%] shadow-lg text-xs">
                  <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                    <span className="font-bold text-white text-xs flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                      <span>የተገኝነት ማረጋገጫ (Presence Verification)</span>
                    </span>
                    <button onClick={() => setActiveScreen('menu')} className="text-[10px] text-slate-400">✕</button>
                  </div>

                  {selectedUserMode === 'student_pending' ? (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-2">
                      <p className="font-bold">⏳ ምዝገባዎ ገና አልጸደቀም!</p>
                      <p className="text-[11px] text-slate-300">
                        የሰንበት ት/ቤቱ አስተዳዳሪ የ Student ID ቁጥር ሰጥተው እንዳጸደቁዎት ተገኝነት መመዝገብ ይችላሉ።
                      </p>
                    </div>
                  ) : attMethod === 'select' ? (
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 space-y-1">
                        <p className="font-bold text-amber-300 flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5" />
                          <span>የአካል መገኘት ደንብ፦</span>
                        </p>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          ተማሪው ሳይመጣ ከቤት ሆኖ ተገኝነት መመዝገብ አይችልም! በት/ቤቱ ቅጥር ግቢ ውስጥ መገኘትዎን ያረጋግጡ፦
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <button
                          onClick={() => setAttMethod('gps')}
                          className="w-full p-2.5 bg-slate-950 hover:bg-slate-800 border border-emerald-500/40 rounded-xl text-left flex items-center justify-between text-white transition group"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">📍</span>
                            <div>
                              <p className="font-bold text-xs group-hover:text-emerald-300">በቦታዬ (GPS Location) አረጋግጥ</p>
                              <p className="text-[10px] text-slate-400">የስልክዎን GPS በመላክ ርቀትን ማረጋገጥ</p>
                            </div>
                          </div>
                          <span className="text-emerald-400 text-[10px] font-mono">300m</span>
                        </button>

                        <button
                          onClick={() => setAttMethod('pin')}
                          className="w-full p-2.5 bg-slate-950 hover:bg-slate-800 border border-amber-500/40 rounded-xl text-left flex items-center justify-between text-white transition group"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">🔑</span>
                            <div>
                              <p className="font-bold text-xs group-hover:text-amber-300">በክፍል ሚስጥር ኮድ (PIN) አረጋግጥ</p>
                              <p className="text-[10px] text-slate-400">ዛሬ በመምህሩ በክፍል የሚሰጠው 4 አሃዝ ኮድ</p>
                            </div>
                          </div>
                          <span className="text-amber-400 text-[10px] font-mono">OTP</span>
                        </button>

                        <button
                          onClick={() => setActiveScreen('pass')}
                          className="w-full p-2.5 bg-slate-950 hover:bg-slate-800 border border-indigo-500/40 rounded-xl text-left flex items-center justify-between text-white transition group"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">🪪</span>
                            <div>
                              <p className="font-bold text-xs group-hover:text-indigo-300">የQR መታወቂያ ካርዴን አሳይ</p>
                              <p className="text-[10px] text-slate-400">በሰንበት መግቢያ በር ላይ ለስካነሩ ማሳየት</p>
                            </div>
                          </div>
                          <span className="text-indigo-400 text-[10px]">Gate</span>
                        </button>
                      </div>

                      <button
                        onClick={() => setActiveScreen('menu')}
                        className="w-full py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
                      >
                        ተመለስ
                      </button>
                    </div>
                  ) : attMethod === 'gps' ? (
                    /* GPS GEOFENCE SIMULATION */
                    <div className="space-y-3">
                      <div className="p-3 bg-slate-950 rounded-xl border border-emerald-500/30 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-400 text-xs flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>GPS Geofence Scanner</span>
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">Addis Ababa</span>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          ቦቱ በስልክዎ የተላከውን ኬክሮስና ኬንትሮስ (Lat/Lon) ከትምህርት ቤቱ መጋጠሚያ በማነጻጸር በቅጥር ግቢው ውስጥ (እስከ 300 ሜትር) መሆንዎን ያረጋግጣል።
                        </p>
                      </div>

                      {/* GPS Test Trigger Buttons */}
                      <div className="space-y-2">
                        <p className="text-[10px] text-slate-400 font-semibold uppercase">ሲሙሌተር፡ የቦታ ሁኔታን ይፈትሹ፦</p>
                        <button
                          onClick={() => handleGpsSimulate(true)}
                          className="w-full py-2 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-bold text-left flex items-center justify-between transition"
                        >
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>በት/ቤቱ ቅጥር ግቢ ውስጥ (ርቀት: 45 ሜትር)</span>
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 text-[10px]">ይፈቀዳል</span>
                        </button>

                        <button
                          onClick={() => handleGpsSimulate(false)}
                          className="w-full py-2 px-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 rounded-xl text-red-300 text-xs font-bold text-left flex items-center justify-between transition"
                        >
                          <span className="flex items-center gap-1.5">
                            <XCircle className="w-4 h-4 text-red-400" />
                            <span>ሳይመጣ ከቤት ሆኖ (ርቀት: 4.8 ኪ.ሜ)</span>
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px]">ይከለከላል</span>
                        </button>
                      </div>

                      {/* GPS Simulation Result Card */}
                      {gpsSimMode === 'success_near' && (
                        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500 text-emerald-300 space-y-1.5 animate-in fade-in">
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>ተገኝነትዎ በቦታ (GPS) ተረጋግጦ ተመዝግቧል!</span>
                          </div>
                          <p className="text-[11px] text-slate-200">
                            👤 <strong>{currentMember.fullNameAm}</strong> ({currentMember.code})
                          </p>
                          <p className="text-[10px] text-slate-300">
                            📍 የተረጋገጠ ርቀት: <strong>45 ሜትር</strong> (በትምህርት ቤቱ ቅጥር ግቢ ውስጥ)
                          </p>
                          <p className="text-[10px] text-slate-400">
                            📅 ቀን: 2026-10-17 | ⏰ ሰዓት: 08:35 AM
                          </p>
                        </div>
                      )}

                      {gpsSimMode === 'fail_far' && (
                        <div className="p-3 rounded-xl bg-red-500/20 border border-red-500 text-red-200 space-y-1.5 animate-in fade-in">
                          <div className="flex items-center gap-1.5 font-bold text-xs text-red-400">
                            <XCircle className="w-4 h-4 text-red-400" />
                            <span>ተገኝነትዎ አልተመዘገበም (በት/ቤቱ ውስጥ አልተገኙም)!</span>
                          </div>
                          <p className="text-[11px] leading-relaxed">
                            📍 ከእርስዎ እስከ ሰንበት ት/ቤቱ ግቢ ያለው ርቀት: <strong className="text-white">4.8 ኪ.ሜ (4,800 ሜትር)</strong> ነው። የተፈቀደው <strong>300 ሜትር</strong> ብቻ ነው።
                          </p>
                          <p className="text-[10px] text-red-300 font-medium">
                            🚫 ተማሪው በአካል ሳይገኝ ከቤት ተገኝነት መመዝገብ አይችልም።
                          </p>
                        </div>
                      )}

                      <button
                        onClick={() => setAttMethod('select')}
                        className="w-full py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
                      >
                        ⬅️ ወደ ማረጋገጫ አማራጮች
                      </button>
                    </div>
                  ) : (
                    /* PIN METHOD */
                    <div className="space-y-3">
                      <div className="p-3 bg-slate-950 rounded-xl border border-amber-500/30 space-y-1">
                        <p className="font-bold text-amber-300 flex items-center gap-1.5">
                          <Key className="w-3.5 h-3.5" />
                          <span>የክፍል ሚስጥር ኮድ (PIN)</span>
                        </p>
                        <p className="text-[11px] text-slate-400">
                          ዛሬ በመምህርዎ በክፍል የተሰጠውን ባለ 4-አሃዝ ኮድ ያስገቡ (የDemo ኮድ: <code className="text-amber-300 font-bold">2026</code>)፦
                        </p>
                      </div>

                      <div className="space-y-2">
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="Demo PIN: 2026"
                          value={pinInput}
                          onChange={(e) => setPinInput(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-center text-lg font-mono font-bold text-amber-400 tracking-widest"
                        />
                        <button
                          onClick={handlePinSubmit}
                          className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition"
                        >
                          ✓ ኮዱን አረጋግጥ
                        </button>
                      </div>

                      {pinStatus === 'success' && (
                        <div className="p-3 bg-emerald-500/15 border border-emerald-500 rounded-xl text-emerald-300 text-xs space-y-1">
                          <p className="font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>ተገኝነትዎ በሚስጥር ኮድ (PIN) ተረጋግጧል!</span>
                          </p>
                          <p className="text-[10px] text-slate-300">👤 {currentMember.fullNameAm} ({currentMember.code})</p>
                        </div>
                      )}

                      {pinStatus === 'fail' && (
                        <div className="p-3 bg-red-500/20 border border-red-500 rounded-xl text-red-300 text-xs space-y-1">
                          <p className="font-bold flex items-center gap-1">
                            <XCircle className="w-4 h-4 text-red-400" />
                            <span>የገቡት ኮድ የተሳሳተ ነው!</span>
                          </p>
                          <p className="text-[10px] text-red-200">እባክዎ ከመምህርዎ ትክክለኛውን ኮድ ይጠይቁ (Demo ኮድ: 2026)</p>
                        </div>
                      )}

                      <button
                        onClick={() => setAttMethod('select')}
                        className="w-full py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
                      >
                        ⬅️ ወደ ማረጋገጫ አማራጮች
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* SCREEN: MY PROFILE */}
              {activeScreen === 'profile' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-3 max-w-[98%] shadow-lg text-xs">
                  <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                    <span className="font-bold text-amber-400 text-xs flex items-center gap-1.5">
                      <span>👤</span>
                      <span>የእኔ ፕሮፋይል (Student Profile)</span>
                    </span>
                    <button onClick={() => setActiveScreen('menu')} className="text-[10px] text-slate-400">✕</button>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <img
                      src={currentMember.photoUrl}
                      alt={currentMember.fullNameAm}
                      className="w-12 h-12 rounded-xl object-cover border border-amber-400"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h5 className="font-bold text-white text-xs">{currentMember.fullNameAm}</h5>
                      <p className="font-mono text-amber-400 font-bold text-[11px]">
                        {currentMember.code || 'በማጽደቅ ሂደት ላይ (Pending)'}
                      </p>
                      <p className="text-[10px] text-slate-400">{currentMember.phone}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 bg-slate-950 rounded-lg border border-slate-800/80">
                      <span className="text-slate-400 block text-[10px]">የክፍል ደረጃ</span>
                      <span className="text-white font-medium">{classLabels[currentMember.gradeLevel || 'grade_6_9']}</span>
                    </div>
                    <div className="p-2 bg-slate-950 rounded-lg border border-slate-800/80">
                      <span className="text-slate-400 block text-[10px]">የተመዘገቡበት ሁኔታ</span>
                      <span className={currentMember.status === 'active' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                        {currentMember.status === 'active' ? '✅ የጸደቀ (Active)' : '⏳ ማጽደቅ የሚጠብቅ (Pending)'}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveScreen('pass')}
                      className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs"
                    >
                      🪪 የQR መታወቂያዬን አሳይ
                    </button>
                    <button
                      onClick={() => setActiveScreen('menu')}
                      className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
                    >
                      ተመለስ
                    </button>
                  </div>
                </div>
              )}

              {/* SCREEN: MY ATTENDANCE HISTORY */}
              {activeScreen === 'history' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-3 max-w-[98%] shadow-lg text-xs">
                  <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                    <span className="font-bold text-amber-400 text-xs flex items-center gap-1.5">
                      <span>📅</span>
                      <span>የእኔ የተገኝነት ታሪክ</span>
                    </span>
                    <button onClick={() => setActiveScreen('menu')} className="text-[10px] text-slate-400">✕</button>
                  </div>

                  <div className="space-y-1.5">
                    {[
                      { date: '2026-10-17', time: '08:35 AM', note: 'መደበኛ ሰንበት ት/ቤት (📍 GPS Verified)' },
                      { date: '2026-10-12', time: '08:15 AM', note: 'መደበኛ ትምህርት (🔑 Class PIN)' },
                      { date: '2026-10-05', time: '08:42 AM', note: 'መደበኛ ትምህርት (🪪 Gate QR)' },
                    ].map((h, idx) => (
                      <div key={idx} className="p-2 bg-slate-950 rounded-lg border border-slate-800/80 flex items-center justify-between text-[11px]">
                        <div>
                          <p className="text-white font-medium">{h.date}</p>
                          <p className="text-[10px] text-slate-400">{h.note}</p>
                        </div>
                        <span className="font-mono text-emerald-400 text-[10px] font-bold">{h.time}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setActiveScreen('menu')}
                    className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs"
                  >
                    ⬅️ ወደ ዋናው ገጽ ተመለስ
                  </button>
                </div>
              )}

              {/* SCREEN: SCHEDULE BY CLASS */}
              {activeScreen === 'schedule_classes' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 max-w-[98%] shadow-lg space-y-2.5">
                  <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                    <h5 className="font-bold text-amber-400 text-xs">
                      🗓️ የመርሐ ግብር ሰሌዳ በክፍል ደረጃ
                    </h5>
                    <button onClick={() => setActiveScreen('menu')} className="text-[10px] text-slate-400">✕</button>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {(['pre_kg', 'grade_1_2', 'grade_3_5', 'grade_6_9'] as GradeLevel[]).map((g) => (
                      <button
                        key={g}
                        onClick={() => setSelectedClass(g)}
                        className={`py-2 px-2 rounded-xl text-[10px] font-bold text-left transition flex items-center justify-between ${
                          selectedClass === g
                            ? 'bg-amber-500 text-slate-950 shadow-sm'
                            : 'bg-slate-950 border border-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        <span>{classLabels[g]}</span>
                        {selectedClass === g && <span className="text-[9px]">✓</span>}
                      </button>
                    ))}
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <span className="text-[11px] font-bold text-amber-300 block border-b border-slate-800 pb-1">
                      {classLabels[selectedClass]} ሳምንታዊ ክፍለ-ጊዜያት፦
                    </span>

                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {classSchedule.map((item) => (
                        <div
                          key={item.id}
                          className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 text-[11px]"
                        >
                          <div className="flex items-center justify-between text-slate-100 font-semibold">
                            <span>{item.activity}</span>
                            <span className="font-mono text-amber-400 font-bold text-[10px]">
                              {item.timeRange}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                            <span className="text-indigo-300">{item.dayAm}</span>
                            <span>ኃላፊ፦ {item.departmentResponsible}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveScreen('schedule_days')}
                      className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-medium"
                    >
                      📅 በቀናት እይታ
                    </button>
                    <button
                      onClick={() => setActiveScreen('menu')}
                      className="px-3 py-1.5 bg-slate-950 text-slate-400 rounded-lg text-[10px]"
                    >
                      ተመለስ
                    </button>
                  </div>
                </div>
              )}

              {/* SCREEN: SCHEDULE BY DAYS */}
              {activeScreen === 'schedule_days' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 max-w-[98%] shadow-lg space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h5 className="font-bold text-white text-xs">📅 በቀናት መርሐ ግብር</h5>
                    <button
                      onClick={() => setActiveScreen('schedule_classes')}
                      className="text-[10px] text-amber-400 hover:underline"
                    >
                      ወደ ክፍል ደረጃ ተመለስ
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: 'friday', label: '📅 አርብ' },
                      { id: 'saturday', label: '📅 ቅዳሜ' },
                      { id: 'sunday', label: '📅 እሁድ' },
                    ].map((d) => (
                      <button
                        key={d.id}
                        onClick={() => setSelectedDay(d.id as DayOfWeek)}
                        className={`py-1.5 rounded-lg text-[10px] font-bold ${
                          selectedDay === d.id ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {daySchedule.map((item) => (
                      <div key={item.id} className="p-2 rounded-lg bg-slate-950 text-[11px]">
                        <div className="flex justify-between font-semibold text-slate-200">
                          <span>{item.activity} ({item.gradeAm})</span>
                          <span className="font-mono text-amber-400 text-[10px]">{item.timeRange}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">ኃላፊ፦ {item.departmentResponsible}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setActiveScreen('menu')}
                    className="w-full py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
                  >
                    ⬅️ ወደ ዋናው ገጽ ተመለስ
                  </button>
                </div>
              )}

              {/* SCREEN: SUPPORT CENTER (WITH LEAVE REQUEST BUTTON!) */}
              {activeScreen === 'support' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-3 max-w-[98%] shadow-lg text-xs">
                  <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                    <span className="font-bold text-amber-400 text-xs flex items-center gap-1.5">
                      <span>🆘</span>
                      <span>የድጋፍ እና የምክር መስጫ (Support Center)</span>
                    </span>
                    <button onClick={() => setActiveScreen('menu')} className="text-[10px] text-slate-400">✕</button>
                  </div>

                  <p className="text-slate-300 text-[11px]">
                    እንዴት ልንረዳዎ እንችላለን? የሚፈልጉትን አገልግሎት ይምረጡ፦
                  </p>

                  <div className="space-y-1.5">
                    {/* LEAVE OF ABSENCE REQUEST BUTTON (USER REQUEST) */}
                    <button
                      onClick={() => setActiveScreen('leave_request')}
                      className="w-full p-2.5 bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/50 rounded-xl text-left flex items-center justify-between text-white transition group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">📝</span>
                        <div>
                          <p className="font-bold text-xs text-purple-300 group-hover:text-purple-200">
                            የፈቃድ መጠየቂያ (Request Leave / Excuse)
                          </p>
                          <p className="text-[10px] text-slate-400">
                            የህመም፣ የፈተና፣ የቤተሰብ ወይም የጉዞ ፈቃድ መጠየቂያ
                          </p>
                        </div>
                      </div>
                      <span className="text-purple-400 text-xs">›</span>
                    </button>

                    <button
                      onClick={() => alert('የጸሎት ጥያቄዎ ለአስተዳዳሪውና ለመምህራን ተልኳል!')}
                      className="w-full p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left flex items-center gap-2 text-white"
                    >
                      <span className="text-base">🙏</span>
                      <div>
                        <p className="font-bold text-xs">የጸሎት ጥያቄ ላክ</p>
                        <p className="text-[10px] text-slate-400">በሰንበት ት/ቤት መምህራን በጸሎት እንዲታሰቡ</p>
                      </div>
                    </button>

                    <button
                      onClick={() => alert('የምክር አገልግሎት ጥያቄዎ በሚስጥር ለአስተዳዳሪው ተልኳል!')}
                      className="w-full p-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left flex items-center gap-2 text-white"
                    >
                      <span className="text-base">💬</span>
                      <div>
                        <p className="font-bold text-xs">የምክር አገልግሎት ጥያቄ</p>
                        <p className="text-[10px] text-slate-400">መንፈሳዊ እና ማህበራዊ ምክር ለማግኘት</p>
                      </div>
                    </button>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-[11px] text-slate-400">
                    <p className="font-bold text-slate-300">📞 የአመራሮች ቢሮ አድራሻ፦</p>
                    <p>• ስልክ: +251 91 122 3344 / +251 92 233 4455</p>
                    <p>• የቢሮ ሰዓት: ቅዳሜ እና እሁድ ከ 2:30 – 11:30</p>
                  </div>

                  <button
                    onClick={() => setActiveScreen('menu')}
                    className="w-full py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
                  >
                    ⬅️ ወደ ዋናው ገጽ ተመለስ
                  </button>
                </div>
              )}

              {/* SCREEN: LEAVE REQUEST FORM */}
              {activeScreen === 'leave_request' && (
                <div className="bg-slate-900 border border-purple-500/40 rounded-2xl p-3.5 space-y-3 max-w-[98%] shadow-lg text-xs">
                  <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                    <span className="font-bold text-purple-300 text-xs flex items-center gap-1.5">
                      <span>📝</span>
                      <span>የተማሪ ፈቃድ መጠየቂያ (Leave Request)</span>
                    </span>
                    <button onClick={() => setActiveScreen('support')} className="text-[10px] text-slate-400">✕</button>
                  </div>

                  <form onSubmit={handleSubmitLeave} className="space-y-3">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">የፈቃድ አይነት (Leave Type)</label>
                      <select
                        value={leaveType}
                        onChange={(e) => setLeaveType(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      >
                        <option>🤒 የህመም ፈቃድ (Medical / Sick)</option>
                        <option>📚 የትምህርት ወይም ፈተና (Study / Exam)</option>
                        <option>👨‍👩‍👧 የቤተሰብ ጉዳይ (Family Matter)</option>
                        <option>✈️ የጉዞ ወይም የስራ ፈቃድ (Travel / Work)</option>
                        <option>📝 ሌላ አስፈላጊ ምክንያት (Other)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">የፈቃድ ቆይታ (Duration)</label>
                      <select
                        value={leaveDuration}
                        onChange={(e) => setLeaveDuration(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      >
                        <option>1 እሁድ</option>
                        <option>2 እሁዶች (ለ 2 ሳምንት)</option>
                        <option>1 ወር</option>
                        <option>የተለየ ቀን (በምክንያቱ ውስጥ ይጥቀሱ)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">የፈቃድ ምክንያት / ማብራሪያ</label>
                      <textarea
                        rows={3}
                        required
                        placeholder="የፈቃድ መጠየቂያዎን ምክንያት በአጭሩ ይጻፉ..."
                        value={leaveReason}
                        onChange={(e) => setLeaveReason(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="submit"
                        className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs transition shadow-md shadow-purple-600/20"
                      >
                        ✓ ፈቃዱን ላክ (Submit Request)
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveScreen('support')}
                        className="px-3 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs"
                      >
                        ሰርዝ
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* SCREEN: LEAVE REQUEST SUCCESS RECEIPT */}
              {activeScreen === 'leave_success' && lastSubmittedLeave && (
                <div className="bg-slate-900 border border-purple-500/50 rounded-2xl p-4 space-y-3 max-w-[98%] shadow-lg text-xs animate-in fade-in">
                  <div className="flex items-center gap-2 text-purple-300 font-bold">
                    <span className="text-lg">🎉</span>
                    <span>የፈቃድ ማመልከቻዎ በተሳካ ሁኔታ ተልኳል!</span>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-slate-300">
                    <p className="font-mono text-purple-400 font-bold">መለያ ቁጥር: {lastSubmittedLeave.requestNumber}</p>
                    <p>👤 <strong>ተማሪ:</strong> {lastSubmittedLeave.studentName}</p>
                    <p>🏷️ <strong>አይነት:</strong> {lastSubmittedLeave.leaveType}</p>
                    <p>📅 <strong>ቆይታ:</strong> {lastSubmittedLeave.duration}</p>
                    <p>📝 <strong>ምክንያት:</strong> {lastSubmittedLeave.reason}</p>
                    <p className="text-amber-400 font-bold pt-1">
                      📌 ሁኔታ: ⏳ ማጽደቅ የሚጠብቅ (Pending Review)
                    </p>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    ማመልከቻዎ ለሰንበት ት/ቤቱ አስተዳዳሪ ደርሷል። አስተዳዳሪው እንደተመለከቱት ማረጋገጫ በቴሌግራም ይደርስዎታል!
                  </p>

                  <button
                    onClick={() => setActiveScreen('menu')}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium"
                  >
                    ⬅️ ወደ ዋናው ገጽ ተመለስ
                  </button>
                </div>
              )}

              {/* SCREEN: ADMIN DASHBOARD (WITH LEAVE APPROVAL ACTIONS!) */}
              {activeScreen === 'admin' && (
                <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-3.5 space-y-3 max-w-[98%] shadow-lg text-xs">
                  <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                    <span className="font-bold text-amber-400 text-xs flex items-center gap-1.5">
                      <span>🔐</span>
                      <span>Admin Security Dashboard</span>
                    </span>
                    <button onClick={() => setActiveScreen('menu')} className="text-[10px] text-slate-400">✕</button>
                  </div>

                  {selectedUserMode !== 'super_admin' ? (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 space-y-2">
                      <p className="font-bold">⛔ የተከለከለ (Restricted)</p>
                      <p className="text-[11px] text-slate-300">
                        ይህ ክፍል ለሰንበት ት/ቤቱ አስተዳዳሪዎች ብቻ የተፈቀደ ነው።
                      </p>
                      <div className="p-2 bg-slate-950 rounded-lg text-amber-300 font-mono text-[10px]">
                        የእርስዎ Telegram ID: 606572754
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-[11px]">
                        👑 <strong>Super Admin (ኪዱስ ያሬድ)</strong> ተረጋግጠዋል!
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                        <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
                          <span className="text-slate-400 block text-[9px]">ተማሪዎች</span>
                          <span className="text-sm font-bold text-amber-400">2 Pending</span>
                        </div>
                        <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
                          <span className="text-slate-400 block text-[9px]">ፈቃዶች</span>
                          <span className="text-sm font-bold text-purple-400">{pendingLeavesCount} አዳዲስ</span>
                        </div>
                        <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
                          <span className="text-slate-400 block text-[9px]">የዛሬ</span>
                          <span className="text-sm font-bold text-emerald-400">42 ተገኙ</span>
                        </div>
                      </div>

                      {/* Pending Leave Requests Section in Admin view */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-xs text-purple-300 flex items-center gap-1">
                            <span>📝</span>
                            <span>የተማሪዎች ፈቃድ ማመልከቻዎች፦</span>
                          </p>
                          <span className="text-[10px] text-slate-400">{leaveRequests.length} ጠቅላላ</span>
                        </div>

                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {leaveRequests.map((l) => (
                            <div key={l.id} className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-[11px]">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-white">{l.studentName}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  l.status === 'approved'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : l.status === 'rejected'
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-amber-500/20 text-amber-400 animate-pulse'
                                }`}>
                                  {l.status}
                                </span>
                              </div>
                              <p className="text-[10px] text-purple-300 font-semibold">{l.leaveType} ({l.duration})</p>
                              <p className="text-[10px] text-slate-400 truncate">{l.reason}</p>

                              {l.status === 'pending' && (
                                <div className="flex gap-1.5 pt-1">
                                  <button
                                    onClick={() => handleApproveLeave(l.id)}
                                    className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold flex items-center justify-center gap-1"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>አጽድቅ</span>
                                  </button>
                                  <button
                                    onClick={() => handleRejectLeave(l.id)}
                                    className="flex-1 py-1 bg-red-600/80 hover:bg-red-500 text-white rounded text-[10px] font-bold flex items-center justify-center gap-1"
                                  >
                                    <X className="w-3 h-3" />
                                    <span>ውድቅ</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-[11px]">
                        <p className="text-slate-300 font-bold">🌐 የዌብ ዳሽቦርድ መግቢያ፦</p>
                        <p className="font-mono text-amber-300">http://127.0.0.1:5001/</p>
                        <p className="text-slate-400 text-[10px]">Username: admin | Password: set privately in .env</p>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setActiveScreen('menu')}
                    className="w-full py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
                  >
                    ⬅️ ወደ ዋናው ገጽ ተመለስ
                  </button>
                </div>
              )}

              {/* SCREEN: DIGITAL QR CARD */}
              {activeScreen === 'pass' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 max-w-[95%] shadow-lg">
                  <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-3 rounded-xl border border-amber-500/40 text-center relative overflow-hidden">
                    <span className="text-[10px] font-bold text-amber-400 block mb-1">የወልድ ዋሕድ ሰ/ት/ቤት</span>
                    <img
                      src={currentMember.photoUrl}
                      alt={currentMember.fullNameAm}
                      className="w-14 h-14 rounded-xl object-cover border-2 border-amber-400 mx-auto shadow-md"
                      referrerPolicy="no-referrer"
                    />
                    <h5 className="text-xs font-bold text-white mt-1">{currentMember.fullNameAm}</h5>
                    <span className="text-[10px] font-mono text-amber-300">{currentMember.code || 'WW-2026-001'}</span>
                    <div className="my-2 p-1.5 bg-white rounded-xl inline-block shadow-inner">
                      <QRCodeView value={currentMember.code || 'WW-2026-001'} size={80} />
                    </div>
                  </div>
                  <div className="mt-2 space-y-1">
                    <button
                      onClick={() => setActiveScreen('menu')}
                      className="w-full py-1.5 bg-indigo-600 text-white rounded-xl text-[11px] font-medium"
                    >
                      ⬅️ ወደ ዋናው ገጽ ተመለስ
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Simulated Telegram Bottom Input Bar */}
            <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
              <button
                onClick={() => setActiveScreen('menu')}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg text-[11px] font-mono font-bold"
              >
                /start
              </button>
              <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-400">
                መልዕክት ይጻፉ...
              </div>
              <button className="p-1.5 text-amber-400 hover:text-amber-300 rounded-lg">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
