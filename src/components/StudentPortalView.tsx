import React, { useState } from 'react';
import { Member, AttendanceRecord, Language, SundaySchoolDepartment } from '../types';
import { WOLD_WAHID_LOGO, WOLD_WAHID_SCHEDULE } from '../data/initialData';
import { formatEthiopianDate } from '../utils/ethiopianCalendar';
import { getPhotoUrl } from '../utils/photoUtils';
import { getApiUrl } from '../utils/apiConfig';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import {
  Calendar,
  Clock,
  QrCode,
  UserCheck,
  ShieldAlert,
  ArrowRight,
  BookOpen,
  Music,
  Palette,
  Scroll,
  Shield,
  Search,
  CheckCircle,
  XCircle,
  LogOut,
  ExternalLink,
  UserPlus,
  X,
  Upload,
  FileText,
} from 'lucide-react';

interface StudentPortalViewProps {
  members: Member[];
  attendance: AttendanceRecord[];
  onOpenAdminLogin: () => void;
  lang: Language;
}

export const StudentPortalView: React.FC<StudentPortalViewProps> = ({
  members,
  attendance,
  onOpenAdminLogin,
  lang,
}) => {
  const [activeTab, setActiveTab] = useState<'card' | 'schedule' | 'attendance' | 'register' | 'leave'>('card');
  const [searchCode, setSearchCode] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Member | null>(() => members[0] || null);
  const [selectedGrade, setSelectedGrade] = useState<'pre_kg' | 'grade_1_2' | 'grade_3_5' | 'grade_6_9'>('grade_1_2');

  // 10 Mandatory Registration Fields State
  const [regFullName, setRegFullName] = useState('');
  const [regChristianName, setRegChristianName] = useState('');
  const [regGender, setRegGender] = useState<'male' | 'female'>('male');
  const [regBirthDate, setRegBirthDate] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regEmergencyName, setRegEmergencyName] = useState('');
  const [regEmergencyPhone, setRegEmergencyPhone] = useState('');
  const [regDepartment, setRegDepartment] = useState<SundaySchoolDepartment>('education');
  const [regPhotoUrl, setRegPhotoUrl] = useState('');
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);
  const [regSuccessMsg, setRegSuccessMsg] = useState('');

  // Leave Request State
  const [leaveType, setLeaveType] = useState('Medical (የጤና)');
  const [leaveDuration, setLeaveDuration] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [isSubmittingLeave, setIsSubmittingRegLeave] = useState(false);
  const [leaveSuccessMsg, setLeaveSuccessMsg] = useState('');

  const handleSearchStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchCode.trim();
    if (!clean) return;

    // 1. Try local find first
    const found = members.find(
      (m) =>
        m.code.toLowerCase().includes(clean.toLowerCase()) ||
        m.fullNameAm.toLowerCase().includes(clean.toLowerCase()) ||
        m.phone.replace(/[\s\-\+]/g, '').includes(clean.replace(/[\s\-\+]/g, ''))
    );

    if (found) {
      setSelectedStudent(found);
      setSearchCode('');
      setActiveTab('card');
      return;
    }

    // 2. Query backend API /api/students/:identifier if not found locally
    try {
      const res = await fetch(getApiUrl(`/api/students/${encodeURIComponent(clean)}`));
      if (res.ok) {
        const data = await res.json();
        const studentObj: Member = {
          id: data.id,
          code: data.code || data.studentCode || clean,
          fullNameAm: data.fullNameAm || data.fullNameEn || 'ተማሪ',
          fullNameEn: data.fullNameEn || data.fullNameAm || 'Student',
          christianName: data.christianName || '',
          birthYear: data.birthYear || data.birthDate || '',
          phone: data.phone || '',
          gender: data.gender === 'female' ? 'female' : 'male',
          department: data.department || 'education',
          gradeLevel: data.gradeLevel || 'general',
          roleAm: 'ተማሪ / Student',
          roleEn: 'Student',
          photoUrl: getPhotoUrl(data.photoUrl, data.gender === 'female' ? 'female' : 'male'),
          registeredDate: data.registeredDate || new Date().toISOString().split('T')[0],
          bloodGroup: data.bloodGroup || 'O+',
          emergencyContact: data.emergencyContact || { name: '', phone: '', relation: '' },
          subcity: data.subcity || data.address || '',
          status: 'active',
          telegramId: data.telegramId || '',
          telegramUsername: data.telegramUsername || '',
          consecutiveAbsences: data.consecutiveAbsences || 0,
        };
        setSelectedStudent(studentObj);
        setSearchCode('');
        setActiveTab('card');
        return;
      }
    } catch (err) {
      console.warn('Backend student lookup notice:', err);
    }

    alert('የተማሪው መረጃ አልተገኘም (Student not found). እባክዎ በትክክለኛ መታወቂያ ወይም ስልክ ይፈልጉ።');
  };

  const handleRegistrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFullName.trim() || !regPhone.trim()) return;

    setIsSubmittingReg(true);
    try {
      let cleanPhone = regPhone.replace(/[\s\-\(\)\+]/g, '');
      if (cleanPhone.startsWith('251')) cleanPhone = '0' + cleanPhone.slice(3);
      let cleanEmergPhone = regEmergencyPhone.replace(/[\s\-\(\)\+]/g, '');
      if (cleanEmergPhone.startsWith('251')) cleanEmergPhone = '0' + cleanEmergPhone.slice(3);

      await addDoc(collection(db, 'registrations'), {
        fullNameAm: regFullName.trim(),
        fullNameEn: regFullName.trim(),
        christianName: regChristianName.trim(),
        gender: regGender,
        birthDate: regBirthDate.trim(),
        birthYear: regBirthDate.trim(), // dashboard compatibility
        phone: cleanPhone || regPhone.trim(),
        address: regAddress.trim(),
        subcity: regAddress.trim(), // dashboard compatibility
        emergencyContact: {
          name: regEmergencyName.trim(),
          phone: cleanEmergPhone || regEmergencyPhone.trim(),
          relation: 'ቤተሰብ / Family'
        },
        emergencyName: regEmergencyName.trim(), // bot compatibility
        emergencyPhone: cleanEmergPhone || regEmergencyPhone.trim(), // bot compatibility
        emergencyRelation: 'ቤተሰብ / Family', // bot compatibility
        department: regDepartment,
        photoUrl: regPhotoUrl.trim() || '',
        status: 'pending',
        submittedAt: new Date().toISOString(),
      });

      setRegSuccessMsg('🎉 የምዝገባ ጥያቄዎ በተሳካ ሁኔታ ተልኳል! በአስተዳዳሪው ሲጸድቅ መታወቂያ ይደርስዎታል።');
      setRegFullName('');
      setRegChristianName('');
      setRegBirthDate('');
      setRegPhone('');
      setRegAddress('');
      setRegEmergencyName('');
      setRegEmergencyPhone('');
      setRegPhotoUrl('');
      setTimeout(() => setRegSuccessMsg(''), 8000);
    } catch (err) {
      console.error('Registration submission error:', err);
      alert('ምዝገባውን መላክ አልተቻለም። እባክዎ እንደገና ይሞክሩ።');
    } finally {
      setIsSubmittingReg(false);
    }
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !leaveReason.trim()) return;

    setIsSubmittingRegLeave(true);
    try {
      await addDoc(collection(db, 'leave_requests'), {
        requestNumber: `LV-${Math.floor(1000 + Math.random() * 9000)}`,
        studentName: selectedStudent.fullNameAm,
        studentCode: selectedStudent.code,
        memberId: selectedStudent.id,
        leaveType,
        duration: leaveDuration,
        reason: leaveReason.trim(),
        status: 'pending',
        submittedAt: new Date().toISOString(),
      });

      setLeaveSuccessMsg(
`✅ የፈቃድ ጥያቄዎ ተመዝግቧል!
Leave Request Submitted!

📋 Request #: LV-${Math.floor(1000 + Math.random() * 9000)}
⏳ Status: በመጠባበቅ ላይ (Pending Review)

የክፍል ኃላፊዎ ጥያቄዎን መርምረው ውሳኔውን ያሳውቁዎታል።`
      );
      setLeaveReason('');
      setLeaveDuration('');
      setTimeout(() => setLeaveSuccessMsg(''), 8000);
    } catch (err) {
      console.error('Leave submission error:', err);
      alert('የፈቃድ ጥያቄውን መላክ አልተቻለም።');
    } finally {
      setIsSubmittingRegLeave(false);
    }
  };

  // Student specific attendance
  const studentRecords = selectedStudent
    ? attendance.filter((a) => a.memberCode === selectedStudent.code || a.memberId === selectedStudent.id)
    : [];

  const presentCount = studentRecords.filter((a) => a.status !== 'absent').length;
  const absentCount = studentRecords.filter((a) => a.status === 'absent').length;
  const excusedCount = studentRecords.filter((a) => a.status === 'excused').length;
  const totalLogs = studentRecords.length;
  const attendanceRate = totalLogs > 0 ? Math.round((presentCount / totalLogs) * 100) : 100;

  // Grade schedules
  const gradeSchedules = WOLD_WAHID_SCHEDULE.filter((s) => s.gradeLevel === selectedGrade);

  return (
    <div className="min-h-screen bg-[#062414] text-slate-100 flex flex-col font-sans">
      {/* Top Header - Improved responsiveness */}
      <header className="bg-[#09351c]/95 backdrop-blur-md border-b border-[#0f4425] px-4 py-4 sticky top-0 z-50 shadow-xl">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full border-2 border-amber-400 overflow-hidden bg-[#062414] p-0.5 shrink-0 shadow-lg">
              <img src={WOLD_WAHID_LOGO} alt="Wold Wahid" className="w-full h-full object-cover rounded-full" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-black text-white truncate uppercase tracking-tight">
                የወልድ ዋሕድ ሰንበት ት/ቤት
              </h1>
              <p className="text-[10px] text-amber-400 font-bold tracking-widest uppercase">Students Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveTab('register')}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-lg active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>ምዝገባ</span>
            </button>
            <button
              onClick={onOpenAdminLogin}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-[#062414] hover:bg-emerald-900 text-amber-400 border border-[#0f4425] transition-all shadow-md active:scale-95"
            >
              <span>🔐 አድሚን</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs - More visual weight */}
      <div className="bg-[#09351c]/90 backdrop-blur-md border-b border-[#0f4425] px-2 py-3 sticky top-[77px] z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-start sm:justify-center gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'card' as const, label: '🪪 መታወቂያ', icon: QrCode },
            { id: 'schedule' as const, label: '🗓️ መርሐ ግብር', icon: Calendar },
            { id: 'attendance' as const, label: '📊 የመገኘት ታሪክ', icon: UserCheck },
            { id: 'leave' as const, label: '✉️ የፈቃድ መጠየቂያ', icon: FileText },
            { id: 'register' as const, label: '📝 አዲስ ምዝገባ', icon: UserPlus },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-[11px] font-black transition-all whitespace-nowrap flex items-center gap-2 shadow-sm ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-slate-950 scale-105 ring-2 ring-amber-400/50'
                  : 'bg-[#062414]/60 text-emerald-100/70 hover:text-white border border-[#0f4425]'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Body */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 space-y-8 animate-in fade-in duration-500">
        {/* Search Student Bar - More distinct */}
        <form onSubmit={handleSearchStudent} className="flex items-center gap-3 max-w-lg mx-auto bg-[#09351c] p-2.5 rounded-2xl border border-[#0f4425] shadow-2xl focus-within:border-amber-500/50 transition-all">
          <Search className="w-5 h-5 text-amber-500 ml-2 shrink-0" />
          <input
            type="text"
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            placeholder="በመታወቂያ ቁጥር ወይም በስም ይፈልጉ..."
            className="w-full bg-transparent text-sm text-white placeholder-emerald-800/60 focus:outline-none px-2 font-medium"
          />
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg transition-all active:scale-95"
          >
            ፈልግ
          </button>
        </form>

        {activeTab === 'card' && (
          <div className="space-y-8 py-4">
            {selectedStudent ? (
              <div className="max-w-sm mx-auto bg-gradient-to-b from-[#0a4123] to-[#062414] border-2 border-amber-500/40 rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative text-slate-100 overflow-hidden group">
                {/* Decorative Elements */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/20 transition-all duration-500"></div>
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all duration-500"></div>

                <div className="absolute top-5 right-5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {selectedStudent.status === 'active' ? '● Active' : '⏳ Pending'}
                </div>

                <div className="text-center space-y-4 mb-8">
                  <div className="relative inline-block">
                    <div className="absolute -inset-1 bg-amber-500/30 rounded-full blur"></div>
                    <div className="relative w-24 h-24 rounded-full border-2 border-amber-400 mx-auto overflow-hidden bg-emerald-950 shadow-2xl">
                      <img 
                        src={getPhotoUrl(selectedStudent.photoUrl, selectedStudent.gender)} 
                        alt="Student" 
                        className="w-full h-full object-cover" 
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          const placeholder = selectedStudent.gender === 'female' ? '/assets/aistudio/AVATAR_FEMALE.png' : '/assets/aistudio/AVATAR_MALE.png';
                          e.currentTarget.src = placeholder;
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white leading-tight">{selectedStudent.fullNameAm}</h2>
                    <p className="text-xs text-amber-500 font-black tracking-widest mt-1 uppercase">{selectedStudent.code}</p>
                    <p className="text-[10px] text-emerald-200/50 font-medium mt-2 uppercase tracking-tighter italic">መካነ ቅዱሳን ኢያቄም ወሐና ሰ/ት/ቤት</p>
                  </div>
                </div>

                <div className="bg-[#062414]/90 rounded-3xl p-5 border border-[#0f4425] text-xs space-y-3 mb-6 shadow-inner">
                  <div className="flex justify-between items-center pb-2 border-b border-[#0f4425]/50">
                    <span className="text-emerald-200/60 font-bold uppercase tracking-tighter">ስልክ / Phone</span>
                    <span className="font-black text-white font-mono">{selectedStudent.phone || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-[#0f4425]/50">
                    <span className="text-emerald-200/60 font-bold uppercase tracking-tighter">ክፍል / Dept</span>
                    <span className="font-black text-amber-400">{selectedStudent.department}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-emerald-200/60 font-bold uppercase tracking-tighter">አድራሻ / Address</span>
                    <span className="font-black text-white">{selectedStudent.subcity || 'አዲስ አበባ'}</span>
                  </div>
                </div>

                <div className="text-center bg-white p-5 rounded-[2rem] shadow-2xl">
                  <p className="text-[11px] text-slate-950 font-black mb-3 uppercase tracking-tighter italic border-b border-slate-100 pb-2">የመገኘት QR ኮድ (Attendance)</p>
                  <div className="flex justify-center p-2 bg-slate-50 rounded-2xl">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x140&data=${encodeURIComponent(selectedStudent.code)}`}
                      alt="QR Code"
                      className="w-32 h-32 rounded-lg"
                    />
                  </div>
                  <p className="text-[9px] text-slate-500 font-bold mt-3 leading-tight uppercase">በክፍል ሰዓት ለአስተዳዳሪው ያሳዩ<br/>Present this at entry</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 bg-[#09351c]/40 rounded-[3rem] border border-[#0f4425] p-10 space-y-6 shadow-xl">
                <div className="w-20 h-20 bg-[#062414] rounded-3xl flex items-center justify-center mx-auto border border-[#0f4425] text-amber-500/20">
                  <QrCode className="w-10 h-10" />
                </div>
                <p className="text-sm text-emerald-200/70 font-bold max-w-xs mx-auto">ምንም ተማሪ አልተመረጠም። እባክዎ ከላይ በመታወቂያ ቁጥር ይፈልጉ ወይም አዲስ ይመዝገቡ።</p>
                <button
                  onClick={() => setActiveTab('register')}
                  className="px-8 py-3 rounded-2xl bg-amber-500 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                >
                  አዲስ ተማሪ ይመዝገቡ
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="space-y-6">
            <div className="flex justify-center gap-2 overflow-x-auto pb-2 px-2 no-scrollbar">
              {[
                { id: 'pre_kg' as const, label: '🧸 ቅድመ አንደኛ' },
                { id: 'grade_1_2' as const, label: '🎒 1–2ኛ ክፍል' },
                { id: 'grade_3_5' as const, label: '📚 3–5ኛ ክፍል' },
                { id: 'grade_6_9' as const, label: '🎓 6–9ኛ ክፍል' },
              ].map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGrade(g.id)}
                  className={`px-5 py-2.5 rounded-2xl text-[11px] font-black transition-all whitespace-nowrap shadow-md ${
                    selectedGrade === g.id
                      ? 'bg-amber-500 text-slate-950 scale-105'
                      : 'bg-[#09351c] text-emerald-100/70 border border-[#0f4425]'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            <div className="bg-[#09351c]/95 border border-[#0f4425] rounded-[2.5rem] p-6 sm:p-10 shadow-2xl space-y-6">
              <div className="flex items-center gap-4 border-b border-[#0f4425]/50 pb-5">
                <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 border border-amber-500/20">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">ሳምንታዊ መርሐ ግብር</h3>
                  <p className="text-xs text-emerald-200/50">Weekly Class Schedule Overview</p>
                </div>
              </div>

              <div className="space-y-3">
                {gradeSchedules.length > 0 ? (
                  gradeSchedules.map((sch) => (
                    <div key={sch.id} className="group bg-[#062414]/80 p-5 rounded-3xl border border-[#0f4425] hover:border-amber-500/40 transition-all flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-900/30 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                          {sch.activity.includes('መዝሙር') ? <Music className="w-5 h-5" /> : sch.activity.includes('ትምህርት') ? <BookOpen className="w-5 h-5" /> : <Scroll className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="font-black text-white text-sm tracking-tight">{sch.activity}</div>
                          <div className="text-[10px] text-emerald-200/50 font-bold uppercase mt-1">{sch.departmentResponsible}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-amber-400 font-mono text-sm">{sch.timeRange}</div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">{sch.dayAm}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-10 text-emerald-200/40 text-xs font-bold italic">ለዚህ ክፍል የተመዘገበ መርሐ ግብር አልተገኘም።</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'attendance' && selectedStudent && (
          <div className="space-y-8 animate-in zoom-in-95 duration-300">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-emerald-950/40 p-6 rounded-[2rem] border border-emerald-500/20 text-center shadow-lg group hover:bg-emerald-950/60 transition-all">
                <div className="text-3xl font-black text-emerald-400 mb-1">{presentCount}</div>
                <div className="text-[10px] text-emerald-200/60 font-black uppercase tracking-widest">የተገኙበት (Present)</div>
              </div>
              <div className="bg-amber-950/40 p-6 rounded-[2rem] border border-amber-500/20 text-center shadow-lg group hover:bg-amber-950/60 transition-all">
                <div className="text-3xl font-black text-amber-400 mb-1">{attendanceRate}%</div>
                <div className="text-[10px] text-amber-200/60 font-black uppercase tracking-widest">ምጣኔ (Rate)</div>
              </div>
              <div className="bg-rose-950/40 p-6 rounded-[2rem] border border-rose-500/20 text-center shadow-lg group hover:bg-rose-950/60 transition-all">
                <div className="text-3xl font-black text-rose-400 mb-1">{absentCount}</div>
                <div className="text-[10px] text-rose-200/60 font-black uppercase tracking-widest">የቀሩበት (Absent)</div>
              </div>
            </div>

            <div className="bg-[#09351c]/95 border border-[#0f4425] rounded-[2.5rem] p-6 sm:p-10 shadow-2xl space-y-6">
              <div className="flex items-center gap-4 border-b border-[#0f4425]/50 pb-5">
                <div className="w-12 h-12 bg-sky-500/10 rounded-2xl flex items-center justify-center text-sky-400 border border-sky-500/20">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">የቅርብ ጊዜ የመገኘት ታሪክ</h3>
                  <p className="text-xs text-emerald-200/50">Recent Attendance History</p>
                </div>
              </div>

              <div className="space-y-3">
                {studentRecords.length > 0 ? (
                  studentRecords.map((rec) => (
                    <div key={rec.id} className="bg-[#062414]/80 p-5 rounded-3xl border border-[#0f4425] flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full shadow-lg ${rec.status === 'absent' ? 'bg-rose-500 shadow-rose-500/20' : 'bg-emerald-500 shadow-emerald-500/20'}`}></div>
                        <div>
                          <div className="font-black text-white text-sm tracking-tight">{rec.sessionName}</div>
                          <div className="text-[10px] text-emerald-200/40 font-bold uppercase mt-1">{rec.date} · {rec.timestamp}</div>
                        </div>
                      </div>
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                        rec.status === 'absent' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {rec.status === 'absent' ? 'አልተገኘም' : 'ተገኝቷል'}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-10 text-emerald-200/40 text-xs font-bold italic">ምንም የመገኘት ታሪክ አልተመዘገበም።</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'leave' && (
          <div className="max-w-xl mx-auto space-y-8 py-4">
            <div className="bg-[#09351c]/95 border-2 border-[#0f4425] rounded-[3rem] p-8 sm:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.5)] space-y-8">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 mx-auto border border-amber-500/20 mb-4">
                  <FileText className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">የፈቃድ መጠየቂያ</h2>
                <p className="text-xs text-emerald-200/50 font-bold tracking-widest uppercase">Student Leave Request</p>
              </div>

              {!selectedStudent ? (
                <div className="p-10 bg-[#062414]/60 rounded-3xl border border-amber-500/20 text-center">
                  <ShieldAlert className="w-10 h-10 text-amber-500/40 mx-auto mb-4" />
                  <p className="text-sm text-emerald-200/70 font-bold">የፈቃድ ጥያቄ ለመላክ በመጀመሪያ ተማሪዎን ከላይ ይፈልጉ።</p>
                </div>
              ) : (
                <>
                  {leaveSuccessMsg && (
                    <div className="p-4 bg-emerald-950/80 border-2 border-emerald-500/50 rounded-2xl text-xs font-black text-emerald-300 text-center animate-in zoom-in-95 duration-300">
                      {leaveSuccessMsg}
                    </div>
                  )}

                  <form onSubmit={handleLeaveSubmit} className="space-y-6">
                    <div className="space-y-4 bg-[#062414]/40 p-6 rounded-3xl border border-[#0f4425]">
                      <div>
                        <label className="block text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2">የፈቃድ ዓይነት / Leave Type</label>
                        <select
                          value={leaveType}
                          onChange={(e) => setLeaveType(e.target.value)}
                          className="w-full bg-[#062414] border-2 border-[#0f4425] rounded-2xl px-5 py-3 text-sm text-white font-black focus:outline-none focus:border-amber-400 transition-all"
                        >
                          <option>Medical (የጤና)</option>
                          <option>Travel (የጉዞ)</option>
                          <option>Academic (የትምህርት)</option>
                          <option>Family (የቤተሰብ)</option>
                          <option>Other (ሌላ)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2">ጊዜው / Duration (e.g. 2 weeks)</label>
                        <input
                          type="text"
                          required
                          value={leaveDuration}
                          onChange={(e) => setLeaveDuration(e.target.value)}
                          placeholder="ምሳሌ: ለ2 ሳምንት / ለዛሬ ብቻ"
                          className="w-full bg-[#062414] border-2 border-[#0f4425] rounded-2xl px-5 py-3 text-sm text-white placeholder-emerald-900/60 font-black focus:outline-none focus:border-amber-400 transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2">ምክንያት / Detailed Reason</label>
                        <textarea
                          required
                          rows={4}
                          value={leaveReason}
                          onChange={(e) => setLeaveReason(e.target.value)}
                          placeholder="እባክዎ የቀሩበትን ወይም የሚቀሩበትን ምክንያት በዝርዝር ይግለጹ..."
                          className="w-full bg-[#062414] border-2 border-[#0f4425] rounded-3xl px-5 py-4 text-sm text-white placeholder-emerald-900/60 font-medium focus:outline-none focus:border-amber-400 transition-all resize-none"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingLeave}
                      className="w-full py-4 rounded-[2rem] bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-[0_10px_30px_rgba(245,158,11,0.2)] transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isSubmittingLeave ? 'እየተላከ ነው...' : 'የፈቃድ ጥያቄውን ላክ (Send Request)'}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'register' && (
          <div className="max-w-xl mx-auto space-y-8 py-4">
            <div className="bg-[#09351c]/95 border-2 border-[#0f4425] rounded-[3rem] p-8 sm:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.5)] space-y-8">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 mx-auto border border-amber-500/20 mb-4">
                  <UserPlus className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">የተማሪ ምዝገባ (10 መስኮች)</h2>
                <p className="text-xs text-emerald-200/50 font-bold tracking-widest uppercase italic">Student Registration Application</p>
              </div>

              {regSuccessMsg && (
                <div className="p-5 bg-emerald-950/80 border-2 border-emerald-500/50 rounded-2xl text-xs font-black text-emerald-300 text-center leading-relaxed">
                  {regSuccessMsg}
                </div>
              )}

              <form onSubmit={handleRegistrationSubmit} className="space-y-5 text-xs">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1.5 ml-2">1. ሙሉ ስም (Full Name) *</label>
                    <input
                      type="text"
                      required
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      placeholder="ምሳሌ: ዳዊት ተስፋዬ ገብሬ"
                      className="w-full px-5 py-3.5 bg-[#062414] border-2 border-[#0f4425] rounded-2xl text-white font-black focus:outline-none focus:border-amber-400 shadow-inner"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1.5 ml-2">2. የክርስትና ስም *</label>
                      <input
                        type="text"
                        required
                        value={regChristianName}
                        onChange={(e) => setRegChristianName(e.target.value)}
                        placeholder="ምሳሌ: ወልደ ማርያም"
                        className="w-full px-5 py-3.5 bg-[#062414] border-2 border-[#0f4425] rounded-2xl text-white font-black focus:outline-none focus:border-amber-400 shadow-inner"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1.5 ml-2">3. ጾታ (Gender) *</label>
                      <select
                        value={regGender}
                        onChange={(e) => setRegGender(e.target.value as 'male' | 'female')}
                        className="w-full px-5 py-3.5 bg-[#062414] border-2 border-[#0f4425] rounded-2xl text-white font-black focus:outline-none focus:border-amber-400 shadow-inner"
                      >
                        <option value="male">ወንድ (Male)</option>
                        <option value="female">ሴት (Female)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1.5 ml-2">4. የትውልድ ዘመን *</label>
                      <input
                        type="text"
                        required
                        value={regBirthDate}
                        onChange={(e) => setRegBirthDate(e.target.value)}
                        placeholder="ምሳሌ: 1998 ዓ.ም"
                        className="w-full px-5 py-3.5 bg-[#062414] border-2 border-[#0f4425] rounded-2xl text-white font-black focus:outline-none focus:border-amber-400 shadow-inner"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1.5 ml-2">5. ስልክ ቁጥር *</label>
                      <input
                        type="tel"
                        required
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="0911223344"
                        className="w-full px-5 py-3.5 bg-[#062414] border-2 border-[#0f4425] rounded-2xl text-white font-mono font-black focus:outline-none focus:border-amber-400 shadow-inner"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1.5 ml-2">6. የመኖሪያ አድራሻ *</label>
                    <input
                      type="text"
                      required
                      value={regAddress}
                      onChange={(e) => setRegAddress(e.target.value)}
                      placeholder="ምሳሌ: አዲስ አበባ, ቦሌ ወረዳ 03"
                      className="w-full px-5 py-3.5 bg-[#062414] border-2 border-[#0f4425] rounded-2xl text-white font-black focus:outline-none focus:border-amber-400 shadow-inner"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1.5 ml-2">7. የቅርብ ተጠሪ ስም *</label>
                      <input
                        type="text"
                        required
                        value={regEmergencyName}
                        onChange={(e) => setRegEmergencyName(e.target.value)}
                        placeholder="የቤተሰብ ስም"
                        className="w-full px-5 py-3.5 bg-[#062414] border-2 border-[#0f4425] rounded-2xl text-white font-black focus:outline-none focus:border-amber-400 shadow-inner"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1.5 ml-2">8. ተጠሪ ስልክ ቁጥር *</label>
                      <input
                        type="tel"
                        required
                        value={regEmergencyPhone}
                        onChange={(e) => setRegEmergencyPhone(e.target.value)}
                        placeholder="0911..."
                        className="w-full px-5 py-3.5 bg-[#062414] border-2 border-[#0f4425] rounded-2xl text-white font-mono font-black focus:outline-none focus:border-amber-400 shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1.5 ml-2">9. የሚያገለግሉበት ክፍል *</label>
                      <select
                        value={regDepartment}
                        onChange={(e) => setRegDepartment(e.target.value as SundaySchoolDepartment)}
                        className="w-full px-5 py-3.5 bg-[#062414] border-2 border-[#0f4425] rounded-2xl text-white font-black focus:outline-none focus:border-amber-400 shadow-inner"
                      >
                        <option value="education">ትምህርት ክፍል</option>
                        <option value="choir">መዝሙር ክፍል</option>
                        <option value="arts">ኪነ ጥበብ ክፍል</option>
                        <option value="abnet">አብነት ክፍል</option>
                        <option value="discipline">ስነ ስርዓት ክፍል</option>
                        <option value="general">አጠቃላይ አባል</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1.5 ml-2">10. ፎቶ (Profile Photo)</label>
                      <div className="flex items-center gap-3 bg-[#062414] border-2 border-[#0f4425] rounded-2xl p-2">
                        {regPhotoUrl ? (
                          <img src={regPhotoUrl} className="w-10 h-10 rounded-lg object-cover border border-amber-400/50" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-emerald-950 flex items-center justify-center text-emerald-800 border border-emerald-900">
                            <Upload className="w-5 h-5" />
                          </div>
                        )}
                        <label className="flex-1 cursor-pointer">
                          <span className="text-[10px] font-black text-amber-400/80 hover:text-amber-400 transition-colors px-2">ፎቶ ይምረጡ (Select Photo)</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => setRegPhotoUrl(reader.result as string);
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                        {regPhotoUrl && (
                          <button type="button" onClick={() => setRegPhotoUrl('')} className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingReg}
                  className="w-full py-4 rounded-[2rem] bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-[0_10px_30px_rgba(245,158,11,0.2)] transition-all active:scale-95 disabled:opacity-50 mt-6"
                >
                  {isSubmittingReg ? 'እየተላከ ነው...' : 'የምዝገባ ጥያቄውን ላክ (Submit)'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#062414] border-t border-[#0f4425] py-8 px-6 text-center">
        <p className="text-[10px] text-emerald-200/40 font-bold tracking-widest uppercase leading-loose">
          መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን<br/>
          የወልድ ዋሕድ ሰንበት ትምህርት ቤት · {new Date().getFullYear()}<br/>
          የተማሪዎች ዲጂታል ፖርታል ሥርዓት
        </p>
      </footer>
    </div>
  );
};
