import React, { useState } from 'react';
import { Member, AttendanceRecord, Language, SundaySchoolDepartment } from '../types';
import { WOLD_WAHID_LOGO, WOLD_WAHID_SCHEDULE } from '../data/initialData';
import { formatEthiopianDate } from '../utils/ethiopianCalendar';
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
  const [activeTab, setActiveTab] = useState<'card' | 'schedule' | 'attendance' | 'register'>('card');
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

  const handleSearchStudent = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchCode.trim().toLowerCase();
    if (!clean) return;

    const found = members.find(
      (m) =>
        m.code.toLowerCase().includes(clean) ||
        m.fullNameAm.toLowerCase().includes(clean) ||
        m.phone.replace(/[\s\-\+]/g, '').includes(clean)
    );

    if (found) {
      setSelectedStudent(found);
      setSearchCode('');
      setActiveTab('card');
    } else {
      alert('የተማሪው መረጃ አልተገኘም (Student not found). እባክዎ በትክክለኛ መታወቂያ ወይም ስልክ ይፈልጉ።');
    }
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
        phone: cleanPhone || regPhone.trim(),
        address: regAddress.trim(),
        emergencyContact: {
          name: regEmergencyName.trim(),
          phone: cleanEmergPhone || regEmergencyPhone.trim(),
        },
        emergencyName: regEmergencyName.trim(),
        emergencyPhone: cleanEmergPhone || regEmergencyPhone.trim(),
        department: regDepartment,
        photoUrl: regPhotoUrl.trim() || WOLD_WAHID_LOGO,
        status: 'pending',
        submittedAt: new Date().toISOString(),
      });

      setRegSuccessMsg('የምዝገባ ጥያቄዎ (ከ10ቱ መስኮች ጋር) ለአስተዳዳሪው ተልኳል! ሲጸድቅ መታወቂያ ይደርስዎታል።');
      setRegFullName('');
      setRegChristianName('');
      setRegBirthDate('');
      setRegPhone('');
      setRegAddress('');
      setRegEmergencyName('');
      setRegEmergencyPhone('');
      setRegPhotoUrl('');
    } catch (err) {
      console.error('Registration submission error:', err);
      alert('ምዝገባውን መላክ አልተቻለም። እባክዎ እንደገና ይሞክሩ።');
    } finally {
      setIsSubmittingReg(false);
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
    <div className="min-h-screen bg-[#062414] text-slate-100 flex flex-col font-sans select-none">
      {/* Top Header */}
      <header className="bg-[#09351c] border-b border-[#0f4425] px-4 py-3 sticky top-0 z-40 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full border-2 border-amber-400 overflow-hidden bg-[#062414] p-0.5 shrink-0">
              <img src={WOLD_WAHID_LOGO} alt="Wold Wahid" className="w-full h-full object-cover rounded-full" />
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-bold text-amber-300 truncate">
                መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን
              </h1>
              <p className="text-[10px] text-emerald-200/70">የወልደ ዋሕድ ሰንበት ት/ቤት ተማሪዎች ፖርታል</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('register')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors cursor-pointer shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>ምዝገባ</span>
            </button>
            <button
              onClick={onOpenAdminLogin}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#062414] hover:bg-emerald-950 text-amber-400 border border-[#0f4425] transition-colors cursor-pointer shrink-0"
            >
              <span>🔐 አድሚን</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-[#09351c]/80 border-b border-[#0f4425] px-4 py-2 sticky top-[57px] z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 overflow-x-auto py-1">
          {[
            { id: 'card' as const, label: '🪪 ዲጂታል መታወቂያ (ID)' },
            { id: 'schedule' as const, label: '🗓️ መርሐ ግብር (Schedule)' },
            { id: 'attendance' as const, label: '📊 የመገኘት ታሪክ' },
            { id: 'register' as const, label: '📝 አዲስ ምዝገባ (10 መስኮች)' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'bg-[#062414] text-emerald-200/70 hover:text-white border border-[#0f4425]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Search Student Bar */}
        <form onSubmit={handleSearchStudent} className="flex items-center gap-2 max-w-md mx-auto bg-[#09351c] p-2 rounded-2xl border border-[#0f4425]">
          <Search className="w-4 h-4 text-amber-400 ml-2 shrink-0" />
          <input
            type="text"
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            placeholder="የተማሪ መታወቂያ ቁጥር ወይም ስም ያስገቡ..."
            className="w-full bg-transparent text-xs text-white placeholder-emerald-700/60 focus:outline-none px-2"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shrink-0 cursor-pointer"
          >
            ፈልግ
          </button>
        </form>

        {activeTab === 'card' && (
          <div className="space-y-6">
            {selectedStudent ? (
              <div className="max-w-sm mx-auto bg-gradient-to-b from-[#09351c] to-[#062414] border-2 border-amber-500/50 rounded-3xl p-6 shadow-2xl relative text-slate-100">
                <div className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40">
                  {selectedStudent.status === 'active' ? '🟢 ንቁ ተማሪ' : '⏳ በመጠባበቅ ላይ'}
                </div>

                <div className="text-center space-y-3 mb-6">
                  <div className="w-16 h-16 rounded-full border-2 border-amber-400 mx-auto overflow-hidden bg-emerald-950 shadow-md">
                    <img src={selectedStudent.photoUrl || WOLD_WAHID_LOGO} alt="Student" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">{selectedStudent.fullNameAm}</h2>
                    <p className="text-xs text-amber-300 font-mono font-semibold">{selectedStudent.code}</p>
                    <p className="text-[11px] text-emerald-200/80">መካነ ቅዱሳን ኢያቄም ወሐና ሰ/ት/ቤት</p>
                  </div>
                </div>

                <div className="bg-[#062414]/80 rounded-2xl p-3.5 border border-[#0f4425] text-xs space-y-2 mb-4">
                  <div className="flex justify-between">
                    <span className="text-emerald-200/70">ስልክ ቁጥር:</span>
                    <span className="font-mono text-white">{selectedStudent.phone || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-200/70">የአገልግሎት ክፍል:</span>
                    <span className="font-semibold text-amber-400">{selectedStudent.department}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-200/70">ክፍለ ከተማ / አድራሻ:</span>
                    <span className="text-white">{selectedStudent.subcity || 'አዲስ አበባ'}</span>
                  </div>
                </div>

                <div className="text-center bg-white p-3 rounded-2xl">
                  <p className="text-[10px] text-slate-950 font-bold mb-1">የመገኘት QR ኮድ (Attendance QR)</p>
                  <div className="flex justify-center">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(selectedStudent.code)}`}
                      alt="QR Code"
                      className="w-32 h-32 rounded-lg"
                    />
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1">በክፍል ሰዓት ለአስተዳዳሪው ያሳዩ</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 bg-[#09351c]/60 rounded-3xl border border-[#0f4425] p-6 space-y-4">
                <p className="text-sm text-emerald-200">ምንም ተማሪ አልተመረጠም። እባክዎ ከላይ በቁጥር ወይም በስም ይፈልጉ ወይም አዲስ ምዝገባ ያድርጉ።</p>
                <button
                  onClick={() => setActiveTab('register')}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold cursor-pointer"
                >
                  አዲስ ተማሪ ይመዝገቡ
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="space-y-4">
            <div className="flex justify-center gap-2">
              {[
                { id: 'pre_kg' as const, label: 'ቅድመ አንደኛ' },
                { id: 'grade_1_2' as const, label: '1–2ኛ ክፍል' },
                { id: 'grade_3_5' as const, label: '3–5ኛ ክፍል' },
                { id: 'grade_6_9' as const, label: '6–9ኛ ክፍል' },
              ].map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGrade(g.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                    selectedGrade === g.id
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-[#09351c] text-emerald-200/80 border border-[#0f4425]'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            <div className="bg-[#09351c]/90 border border-[#0f4425] rounded-3xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-amber-300 border-b border-[#0f4425] pb-2">
                የሰንበት ትምህርት ቤቱ ሳምንታዊ መርሐ ግብር
              </h3>
              <div className="space-y-2.5">
                {gradeSchedules.map((sch) => (
                  <div key={sch.id} className="bg-[#062414] p-3 rounded-xl border border-[#0f4425] flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-white">{sch.activity}</div>
                      <div className="text-[11px] text-emerald-200/70">{sch.departmentResponsible}</div>
                    </div>
                    <div className="text-right font-mono text-amber-400">
                      <div>{sch.timeRange}</div>
                      <div className="text-[10px] text-slate-400">{sch.dayAm}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'attendance' && selectedStudent && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-[#09351c] p-3 rounded-2xl border border-[#0f4425]">
                <div className="text-lg font-bold text-emerald-400">{presentCount}</div>
                <div className="text-[11px] text-emerald-200/70">የተገኙበት</div>
              </div>
              <div className="bg-[#09351c] p-3 rounded-2xl border border-[#0f4425]">
                <div className="text-lg font-bold text-amber-400">{attendanceRate}%</div>
                <div className="text-[11px] text-emerald-200/70">የተገኝነት ምጣኔ</div>
              </div>
              <div className="bg-[#09351c] p-3 rounded-2xl border border-[#0f4425]">
                <div className="text-lg font-bold text-rose-400">{absentCount}</div>
                <div className="text-[11px] text-emerald-200/70">የቀሩበት</div>
              </div>
            </div>

            <div className="bg-[#09351c]/90 border border-[#0f4425] rounded-3xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-amber-300">የቅርብ ጊዜ የመገኘት ታሪክ ({selectedStudent.fullNameAm})</h3>
              <div className="space-y-2">
                {studentRecords.length > 0 ? (
                  studentRecords.map((rec) => (
                    <div key={rec.id} className="bg-[#062414] p-3 rounded-xl border border-[#0f4425] flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-white">{rec.sessionName}</div>
                        <div className="text-[10px] text-slate-400">{rec.date} | {rec.timestamp}</div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        rec.status === 'absent' ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {rec.status === 'absent' ? 'አልተገኘም' : 'ተገኝቷል'}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-emerald-200/70 text-py-4 text-center">ምንም የመገኘት ታሪክ አልተመዘገበም።</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'register' && (
          <div className="max-w-xl mx-auto bg-[#09351c]/95 border border-[#0f4425] rounded-3xl p-6 shadow-2xl space-y-5">
            <div>
              <h2 className="text-base font-bold text-amber-300">አስፈላጊ የ10 መስኮች (Fields) የተማሪ ምዝገባ</h2>
              <p className="text-xs text-emerald-200/70 mt-0.5">መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን · የወልደ ዋሕድ ሰንበት ት/ቤት</p>
            </div>

            {regSuccessMsg && (
              <div className="p-3 bg-emerald-950 border border-emerald-500 rounded-xl text-xs text-emerald-200">
                {regSuccessMsg}
              </div>
            )}

            <form onSubmit={handleRegistrationSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-emerald-100 font-semibold mb-1">1. ሙሉ ስም (ስም፣ የአባት ስም፣ የአያት ስም) *</label>
                <input
                  type="text"
                  required
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  placeholder="ምሳሌ: ዳዊት ተስፋዬ ገብሬ"
                  className="w-full px-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-emerald-100 font-medium mb-1">2. የክርስትና ስም *</label>
                  <input
                    type="text"
                    required
                    value={regChristianName}
                    onChange={(e) => setRegChristianName(e.target.value)}
                    placeholder="ምሳሌ: ወልደ ማርያም"
                    className="w-full px-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-emerald-100 font-medium mb-1">3. ጾታ (Gender) *</label>
                  <select
                    value={regGender}
                    onChange={(e) => setRegGender(e.target.value as 'male' | 'female')}
                    className="w-full px-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="male">ወንድ (Male)</option>
                    <option value="female">ሴት (Female)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-emerald-100 font-medium mb-1">4. የትውልድ ዘመን / ዕድሜ *</label>
                  <input
                    type="text"
                    required
                    value={regBirthDate}
                    onChange={(e) => setRegBirthDate(e.target.value)}
                    placeholder="ምሳሌ: 1998 ዓ.ም (ወይንም 20 ዓመት)"
                    className="w-full px-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-emerald-100 font-medium mb-1">5. ስልክ ቁጥር *</label>
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="0911223344"
                    className="w-full px-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-emerald-100 font-medium mb-1">6. የመኖሪያ አድራሻ (ወረዳ / ሰፈር) *</label>
                <input
                  type="text"
                  required
                  value={regAddress}
                  onChange={(e) => setRegAddress(e.target.value)}
                  placeholder="ምሳሌ: አዲስ አበባ, ቦሌ ወረዳ 03"
                  className="w-full px-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-emerald-100 font-medium mb-1">7. የቅርብ ተጠሪ ስም *</label>
                  <input
                    type="text"
                    required
                    value={regEmergencyName}
                    onChange={(e) => setRegEmergencyName(e.target.value)}
                    placeholder="የቤተሰብ ወይም ጠሪ ስም"
                    className="w-full px-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-emerald-100 font-medium mb-1">8. የቅርብ ተጠሪ ስልክ ቁጥር *</label>
                  <input
                    type="tel"
                    required
                    value={regEmergencyPhone}
                    onChange={(e) => setRegEmergencyPhone(e.target.value)}
                    placeholder="0911..."
                    className="w-full px-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-emerald-100 font-medium mb-1">9. የሚያገለግሉበት ክፍል *</label>
                  <select
                    value={regDepartment}
                    onChange={(e) => setRegDepartment(e.target.value as SundaySchoolDepartment)}
                    className="w-full px-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-white focus:outline-none focus:border-amber-400"
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
                  <label className="block text-emerald-100 font-medium mb-1">10. የመገለጫ ፎቶ ሊንክ (Photo URL)</label>
                  <input
                    type="url"
                    value={regPhotoUrl}
                    onChange={(e) => setRegPhotoUrl(e.target.value)}
                    placeholder="https://... (የፎቶ ሊንክ)"
                    className="w-full px-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingReg}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg transition-all cursor-pointer mt-4"
              >
                {isSubmittingReg ? 'እየተላከ ነው...' : 'የምዝገባ ጥያቄ ላክ (Submit 10 Fields)'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};
