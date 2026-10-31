import React, { useState } from 'react';
import { Member, AttendanceRecord, Language } from '../types';
import { QRCodeView } from './QRCodeView';
import { FITHAPOL_LOGO, AVATAR_MALE, AVATAR_FEMALE } from '../data/initialData';
import {
  Smartphone,
  QrCode,
  Camera,
  Calendar,
  UserPlus,
  CheckCircle2,
  Clock,
  Shield,
  Phone,
  RefreshCw,
  Sparkles,
  ChevronRight,
  Wifi,
  Battery,
  Award,
  Lock,
  UserCheck,
} from 'lucide-react';

interface MobileAppSimulatorProps {
  members: Member[];
  onCheckIn: (record: AttendanceRecord) => void;
  lang: Language;
}

export const MobileAppSimulator: React.FC<MobileAppSimulatorProps> = ({
  members,
  onCheckIn,
  lang,
}) => {
  const [activeTab, setActiveTab] = useState<'badge' | 'scanner' | 'register' | 'schedule'>('badge');
  const [mobileUserRole, setMobileUserRole] = useState<'student' | 'admin'>('admin'); // Admin by default so user can test scanning right here!
  
  const [selectedMember, setSelectedMember] = useState<Member>(() => {
    return members.find((m) => m.status === 'active') || members[0] || {
      id: 'm-default',
      code: 'WW-2026-0101',
      fullNameAm: 'ዮሐንስ ተስፋዬ ገብረመድህን',
      fullNameEn: 'Yohannes Tesfaye Gebremedhin',
      phone: '0911234567',
      gender: 'male',
      department: 'education',
      gradeLevel: 'grade_3_5',
      roleAm: 'ተማሪ / Student',
      roleEn: 'Student',
      photoUrl: AVATAR_MALE,
      registeredDate: '2026-01-15',
      bloodGroup: 'O+',
      emergencyContact: { name: 'አቶ ተስፋዬ', phone: '0911000000', relation: 'አባት' },
      subcity: 'ቦሌ / Bole',
      status: 'active',
      consecutiveAbsences: 0,
    };
  });

  // Scanner state
  const [manualCode, setManualCode] = useState('');
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);

  // Registration form state
  const [regNameAm, setRegNameAm] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regDept, setRegDept] = useState('ትምህርት (Education)');
  const [regSuccess, setRegSuccess] = useState(false);

  const handleSimulateScan = (codeToScan: string) => {
    if (mobileUserRole !== 'admin') return;
    const student = members.find((m) => m.code === codeToScan) || selectedMember;
    const now = new Date();
    const record: AttendanceRecord = {
      id: `att-${Date.now()}`,
      memberId: student.id,
      memberNameAm: student.fullNameAm,
      memberNameEn: student.fullNameEn,
      memberCode: student.code,
      department: student.department,
      sessionName: 'እሁድ መደበኛ ትምህርት (Sunday School Class)',
      timestamp: now.toLocaleTimeString(),
      date: now.toISOString().split('T')[0],
      method: 'qr',
    };

    onCheckIn(record);
    setScanFeedback(`✅ ተማሪ ${student.fullNameAm} (${student.code}) መገኘቱ ተመዝግቧል!`);
    setManualCode('');
    setTimeout(() => setScanFeedback(null), 4000);
  };

  const handleMobileRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regNameAm || !regPhone) return;

    try {
      await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullNameAm: regNameAm,
          fullNameEn: regNameAm,
          phone: regPhone,
          department: regDept,
          status: 'pending',
          submittedAt: new Date().toISOString(),
        }),
      });
      setRegSuccess(true);
      setRegNameAm('');
      setRegPhone('');
      setTimeout(() => setRegSuccess(false), 5000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Explanation */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs tracking-wider uppercase">
            <Smartphone className="w-4 h-4" />
            <span>Official Mobile Application · Role-Based Attendance Scanner</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">
            Wold Wahid Sunday School Mobile App (የሞባይል መተግበሪያ)
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Test the live mobile app right here in your browser! Note: The <strong className="text-amber-400">Scanner / ስካነር</strong> tab is strictly restricted to <strong className="text-emerald-400">Admin / Super Admin</strong> roles. Students cannot access the attendance scanner.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://expo.dev/artifacts/eas/0iCNMDPb0iX_dBuo2QOLip4vcoBTBUUxd9rGBggKKDE.apk"
            download="WoldWahid.apk"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/25 transition-colors"
          >
            <span>📥 Download Android APK</span>
          </a>
          <div className="bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-700 text-xs text-slate-300 hidden sm:block">
            <span className="text-slate-500 mr-2">Database ID:</span>
            <span className="font-mono text-amber-400 font-semibold">ai-studio-d3279648-1f3b-4293-8893-cd76f3d816dc</span>
          </div>
        </div>
      </div>

      {/* Main Container: Simulator Phone + Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Interactive Phone Device Frame */}
        <div className="lg:col-span-6 flex justify-center">
          <div className="relative w-full max-w-[380px] bg-slate-950 rounded-[44px] p-3.5 shadow-2xl shadow-amber-500/10 border-4 border-slate-800 ring-1 ring-slate-700/50">
            {/* Phone Speaker Notch */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-900 rounded-full z-30 flex items-center justify-center">
              <div className="w-10 h-1 bg-slate-800 rounded-full" />
            </div>

            {/* Phone Screen Canvas */}
            <div className="w-full bg-slate-950 rounded-[34px] overflow-hidden flex flex-col h-[680px] border border-slate-800/60 relative">
              {/* Status Bar */}
              <div className="pt-3 pb-2 px-6 flex items-center justify-between text-[11px] font-semibold text-slate-400 select-none z-20">
                <span>08:45 AM</span>
                <div className="flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <Battery className="w-3.5 h-3.5 text-slate-300" />
                </div>
              </div>

              {/* Mobile App Header Bar */}
              <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img
                    src={FITHAPOL_LOGO}
                    alt="Logo"
                    className="w-6 h-6 rounded-full border border-amber-400/40 object-cover"
                  />
                  <div>
                    <h3 className="text-xs font-bold text-white leading-tight">የወልድ ዋሕድ ሰ/ት/ቤት</h3>
                    <p className="text-[9px] text-amber-400 font-medium">
                      {mobileUserRole === 'admin' ? '🛡️ Admin Scanner Mode' : '👤 Student Portal'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setMobileUserRole(mobileUserRole === 'admin' ? 'student' : 'admin')}
                  className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                    mobileUserRole === 'admin'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                  }`}
                  title="Click to toggle mobile user role for testing"
                >
                  {mobileUserRole === 'admin' ? '👑 Admin' : '🎓 Student'}
                </button>
              </div>

              {/* Mobile Screen Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* 1. STUDENT BADGE SCREEN */}
                {activeTab === 'badge' && (
                  <div className="space-y-3">
                    <div className="bg-gradient-to-b from-amber-950/40 to-slate-900 border border-amber-500/30 rounded-2xl p-4 shadow-lg text-center relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 font-extrabold text-[9px] px-2.5 py-0.5 rounded-bl-lg">
                        DIGITAL PASS
                      </div>

                      <div className="w-16 h-16 rounded-full border-2 border-amber-400 mx-auto overflow-hidden bg-slate-800 mb-2 mt-1">
                        <img
                          src={selectedMember.photoUrl || AVATAR_MALE}
                          alt="Student"
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <h4 className="text-sm font-bold text-white">{selectedMember.fullNameAm}</h4>
                      <p className="text-[10px] text-slate-400">{selectedMember.fullNameEn}</p>

                      <div className="inline-block bg-slate-800/90 border border-slate-700/80 rounded px-2 py-0.5 mt-2">
                        <span className="text-amber-400 font-mono font-bold text-xs tracking-wider">
                          {selectedMember.code}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-left bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 text-[10px] mt-3">
                        <div>
                          <span className="text-slate-500 block">ክፍል (Dept):</span>
                          <span className="font-semibold text-slate-200">{selectedMember.department}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">ደረጃ (Grade):</span>
                          <span className="font-semibold text-slate-200">{selectedMember.gradeLevel || 'መደበኛ'}</span>
                        </div>
                      </div>

                      {/* Real QR Pass Code */}
                      <div className="mt-3 bg-white p-2.5 rounded-xl inline-block border-2 border-amber-400 shadow-md">
                        <QRCodeView value={selectedMember.code} size={110} />
                      </div>

                      <p className="text-[9px] text-slate-400 mt-2">
                        በቤተክርስቲያን መግቢያ ላይ ይህንን ኮድ ለክፍል ኃላፊው ያሳዩ
                      </p>
                    </div>
                  </div>
                )}

                {/* 2. ATTENDANCE SCANNER SCREEN (ADMIN / SUPER ADMIN ONLY) */}
                {activeTab === 'scanner' && (
                  <div className="space-y-3">
                    {mobileUserRole !== 'admin' ? (
                      /* ACCESS DENIED FOR STUDENTS */
                      <div className="bg-rose-950/40 border border-rose-500/50 rounded-2xl p-6 text-center space-y-4 my-8">
                        <div className="w-14 h-14 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto text-rose-400 border border-rose-500/30">
                          <Lock className="w-7 h-7" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">ፈቃድ ተከልክሏል (Access Denied)</h4>
                          <p className="text-[11px] text-rose-300 mt-1">
                            የመገኘት መመዝገቢያ ስካነር ለአስተዳዳሪዎች (Admin) እና ለዋና አስተዳዳሪዎች (Super Admin) ብቻ የተፈቀደ ነው።
                          </p>
                          <p className="text-[10px] text-slate-400 mt-2">
                            The attendance scanner is restricted to authorized church administrators only.
                          </p>
                        </div>
                        <button
                          onClick={() => setMobileUserRole('admin')}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-colors"
                        >
                          🛡️ Switch to Admin Mode to Test
                        </button>
                      </div>
                    ) : (
                      /* ACTIVE ADMIN SCANNER */
                      <div className="space-y-3">
                        <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-emerald-400 block font-semibold">🛡️ ADMIN SCANNER ACTIVE</span>
                            <span className="text-xs font-bold text-white">እሁድ መደበኛ ትምህርት (Sunday School Class)</span>
                          </div>
                          <span className="bg-emerald-500 text-slate-950 font-bold text-[9px] px-2 py-0.5 rounded">
                            Authorized
                          </span>
                        </div>

                        {/* Camera Viewfinder */}
                        <div className="relative bg-black rounded-2xl h-44 border border-slate-700 flex flex-col items-center justify-center overflow-hidden">
                          {/* Laser scanning line */}
                          <div className="absolute top-0 left-0 right-0 h-0.5 bg-rose-500 shadow-lg shadow-rose-500 animate-pulse" />
                          
                          {/* Corner reticles */}
                          <div className="w-28 h-28 border-2 border-emerald-400/80 rounded-lg flex items-center justify-center relative">
                            <div className="w-2.5 h-2.5 border-t-2 border-l-2 border-emerald-400 absolute top-0 left-0" />
                            <div className="w-2.5 h-2.5 border-t-2 border-r-2 border-emerald-400 absolute top-0 right-0" />
                            <div className="w-2.5 h-2.5 border-b-2 border-l-2 border-emerald-400 absolute bottom-0 left-0" />
                            <div className="w-2.5 h-2.5 border-b-2 border-r-2 border-emerald-400 absolute bottom-0 right-0" />
                            <Camera className="w-8 h-8 text-emerald-500 animate-bounce" />
                          </div>

                          <span className="text-[10px] text-slate-300 mt-2 font-medium">የተማሪውን QR ኮድ ስካን ያድርጉ</span>
                        </div>

                        {/* Instant Scan Button */}
                        <button
                          onClick={() => handleSimulateScan(selectedMember.code)}
                          className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-md shadow-emerald-500/20"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>⚡ Scan Student Pass ({selectedMember.code})</span>
                        </button>

                        {/* Feedback Toast */}
                        {scanFeedback && (
                          <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/50 rounded-xl text-emerald-300 text-[11px] font-bold text-center animate-fade-in">
                            {scanFeedback}
                          </div>
                        )}

                        {/* Manual Fallback */}
                        <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
                          <span className="text-[10px] text-slate-400 block mb-1">በመታወቂያ ቁጥር መመዝገቢያ (Manual ID):</span>
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              placeholder="WW-2026-..."
                              value={manualCode}
                              onChange={(e) => setManualCode(e.target.value)}
                              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white uppercase font-mono"
                            />
                            <button
                              onClick={() => handleSimulateScan(manualCode)}
                              className="bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                            >
                              Check In
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. STUDENT REGISTRATION SCREEN */}
                {activeTab === 'register' && (
                  <form onSubmit={handleMobileRegister} className="space-y-3 bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
                    <div>
                      <h4 className="text-xs font-bold text-white">የአዲስ ተማሪ ምዝገባ</h4>
                      <p className="text-[10px] text-slate-400">Mobile Self-Intake Form</p>
                    </div>

                    {regSuccess && (
                      <div className="p-2 bg-emerald-500/20 border border-emerald-500 rounded-lg text-emerald-300 text-[10px] font-bold">
                        ✅ ማመልከቻዎ ለአስተዳዳሪው ተልኳል!
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] text-slate-300 block mb-1">ሙሉ ስም (Full Name) *</label>
                      <input
                        type="text"
                        required
                        placeholder="ምሳሌ፡ ማርታ ተክሌ"
                        value={regNameAm}
                        onChange={(e) => setRegNameAm(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-300 block mb-1">ስልክ ቁጥር (Phone) *</label>
                      <input
                        type="tel"
                        required
                        placeholder="0911234567"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-300 block mb-1">ክፍል (Department)</label>
                      <select
                        value={regDept}
                        onChange={(e) => setRegDept(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                      >
                        <option>ትምህርት (Education)</option>
                        <option>መዘምራን (Choir)</option>
                        <option>ኪነ-ጥበብ (Arts)</option>
                        <option>አብነት (Abnet)</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl mt-2"
                    >
                      ማመልከቻ አስገባ (Submit)
                    </button>
                  </form>
                )}

                {/* 4. SCHEDULE SCREEN */}
                {activeTab === 'schedule' && (
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold text-white mb-2">ሳምንታዊ የትምህርት መርሐ-ግብር</h4>

                    {[
                      { day: 'አርብ (Friday)', time: '11:30 - 01:00', act: 'የአብነት እና የዜማ ትምህርት', place: 'ዋና አዳራሽ' },
                      { day: 'ቅዳሜ (Saturday)', time: '09:00 - 11:30', act: 'የመዘምራን ልምምድ', place: 'ካቴድራል መድረክ' },
                      { day: 'እሁድ (Sunday)', time: '01:30 - 04:30', act: 'ጠቅላላ የሰንበት ት/ቤት ትምህርት', place: 'ሁሉም ክፍሎች' },
                    ].map((item, idx) => (
                      <div key={idx} className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-amber-400 font-bold text-xs">{item.day}</span>
                          <span className="text-[10px] text-sky-400 font-mono bg-sky-950 px-1.5 py-0.5 rounded">
                            {item.time}
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 font-medium">{item.act}</p>
                        <span className="text-[10px] text-slate-500">📍 {item.place}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Mobile Bottom Tab Bar */}
              <div className="h-14 bg-slate-900/95 border-t border-slate-800 flex items-center justify-around px-2 z-20">
                <button
                  onClick={() => setActiveTab('badge')}
                  className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                    activeTab === 'badge' ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span className="text-[9px] font-semibold mt-0.5">መታወቂያ</span>
                </button>

                <button
                  onClick={() => setActiveTab('scanner')}
                  className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors relative ${
                    activeTab === 'scanner' ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="relative">
                    <Camera className="w-4 h-4" />
                    {mobileUserRole !== 'admin' && (
                      <span className="absolute -top-1 -right-2 bg-rose-500 text-white rounded-full w-3 h-3 flex items-center justify-center text-[8px]">
                        🔒
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] font-semibold mt-0.5">ስካነር</span>
                </button>

                <button
                  onClick={() => setActiveTab('register')}
                  className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                    activeTab === 'register' ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <UserPlus className="w-4 h-4" />
                  <span className="text-[9px] font-semibold mt-0.5">ምዝገባ</span>
                </button>

                <button
                  onClick={() => setActiveTab('schedule')}
                  className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                    activeTab === 'schedule' ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  <span className="text-[9px] font-semibold mt-0.5">መርሐ-ግብር</span>
                </button>
              </div>

              {/* Phone Home Bar Indicator */}
              <div className="pb-1.5 flex justify-center bg-slate-900/95">
                <div className="w-32 h-1 bg-slate-700 rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Feature Highlights & Role Testing Guide */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-400" />
              <span>Role-Based Scanner Restriction & Testing</span>
            </h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              In accordance with church administration security rules, the QR attendance scanner is restricted exclusively to 
              <strong className="text-emerald-400 mx-1">Admin</strong> and <strong className="text-emerald-400 mx-1">Super Admin</strong> accounts. 
            </p>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Test Mobile Role Switcher:</span>
                  <span className="text-[11px] text-slate-400">Toggle between Admin and Student role inside the simulator phone header.</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMobileUserRole('admin')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      mobileUserRole === 'admin' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    🛡️ Admin Mode
                  </button>
                  <button
                    onClick={() => setMobileUserRole('student')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      mobileUserRole === 'student' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    👤 Student Mode
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Switch Demo Student */}
            <div className="mt-5 pt-4 border-t border-slate-800">
              <label className="text-xs font-semibold text-slate-400 block mb-2">
                የተማሪ መታወቂያ ቀይር / Switch Active Student in Mobile Pass:
              </label>
              <select
                value={selectedMember.id}
                onChange={(e) => {
                  const found = members.find((m) => m.id === e.target.value);
                  if (found) setSelectedMember(found);
                }}
                className="w-full bg-slate-950 border border-slate-700 text-xs text-white rounded-xl px-3 py-2.5 focus:border-amber-400 outline-none"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullNameAm} ({m.code}) - {m.department}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
