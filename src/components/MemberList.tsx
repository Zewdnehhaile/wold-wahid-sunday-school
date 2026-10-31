import React, { useState } from 'react';
import { Member, Department, GradeLevel, UserRole, Language } from '../types';
import { t } from '../utils/translations';
import { AVATAR_MALE, AVATAR_FEMALE } from '../data/initialData';
import { QRCodeView } from './QRCodeView';
import {
  Search,
  UserPlus,
  Printer,
  QrCode,
  Phone,
  Shield,
  X,
  Upload,
  Check,
  CheckCircle2,
  XCircle,
  Clock,
  Key,
  ShieldCheck,
  Sparkles,
  Edit,
  Trash2,
} from 'lucide-react';

interface MemberListProps {
  members: Member[];
  onAddMember: (newMember: Member) => void;
  onApproveMember: (memberId: string, manualStudentId: string) => void;
  onRejectMember: (memberId: string) => void;
  onDeleteMember?: (memberId: string) => void;
  onUpdateMember?: (member: Member) => void;
  onOpenCardStudio: (member?: Member) => void;
  currentAdminRole: UserRole;
  lang: Language;
}

export const MemberList: React.FC<MemberListProps> = ({
  members,
  onAddMember,
  onApproveMember,
  onRejectMember,
  onDeleteMember,
  onUpdateMember,
  onOpenCardStudio,
  currentAdminRole,
  lang,
}) => {
  const [activeTab, setActiveTab] = useState<'approved' | 'pending'>('approved');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [qrModalMember, setQrModalMember] = useState<Member | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  // Auto-switch to pending tab if pending registrations arrive and no approved members exist
  React.useEffect(() => {
    const hasPending = members.some((m) => m.status === 'pending_approval');
    const hasApproved = members.some((m) => m.status === 'active');
    if (hasPending && !hasApproved) {
      setActiveTab('pending');
    }
  }, [members]);

  // Approval modal state
  const [approvingMember, setApprovingMember] = useState<Member | null>(null);
  const [manualIdInput, setManualIdInput] = useState('');
  const [idError, setIdError] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  // Form state
  const [fullNameAm, setFullNameAm] = useState('');
  const [fullNameEn, setFullNameEn] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [department, setDepartment] = useState<Department>('education');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>('pre_kg');
  const [roleAm, setRoleAm] = useState('');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [subcity, setSubcity] = useState('ቦሌ / Bole');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('አባት / Father');
  const [selectedPhoto, setSelectedPhoto] = useState<string>(AVATAR_MALE);

  const dict = t[lang];

  // Separate active/approved vs pending approval
  const approvedMembers = members.filter((m) => m.status === 'active');
  const pendingMembers = members.filter((m) => m.status === 'pending_approval');

  const displayedMembers = (activeTab === 'approved' ? approvedMembers : pendingMembers).filter((m) => {
    const matchesSearch =
      m.fullNameAm.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.fullNameEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.phone.includes(searchTerm);

    const matchesDept =
      selectedDept === 'all' ||
      m.department === selectedDept ||
      (selectedDept === 'education' && (m.department?.toLowerCase().includes('education') || m.department?.includes('ትምህርት'))) ||
      (selectedDept === 'choir' && (m.department?.toLowerCase().includes('choir') || m.department?.includes('መዝሙር'))) ||
      (selectedDept === 'arts' && (m.department?.toLowerCase().includes('art') || m.department?.includes('ኪነ'))) ||
      (selectedDept === 'abnet' && (m.department?.toLowerCase().includes('abnet') || m.department?.includes('አብነት'))) ||
      (selectedDept === 'discipline' && (m.department?.toLowerCase().includes('discipline') || m.department?.includes('ስነ'))) ||
      (selectedDept === 'general' && (m.department?.toLowerCase().includes('general') || m.department?.includes('አጠቃላይ')));
    return matchesSearch && matchesDept;
  });

  const handleCreateMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullNameAm.trim()) return;

    let cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');
    if (cleanPhone.startsWith('251')) {
      cleanPhone = '0' + cleanPhone.slice(3);
    }
    if (cleanPhone && (cleanPhone.length !== 10 || (!cleanPhone.startsWith('09') && !cleanPhone.startsWith('07')))) {
      setPhoneError('ስልክ ቁጥር በትክክል 10 አሃዝ መሆን አለበት እና በ 09 ወይም 07 መጀመር አለበት (ምሳሌ፡ 0911223344)');
      return;
    }
    setPhoneError('');
    const finalPhone = cleanPhone || '0911000000';

    // Student self-registration goes into 'pending_approval' queue waiting for admin manual ID assignment
    const newMember: Member = {
      id: `m-${Date.now()}`,
      code: 'PENDING',
      fullNameAm,
      fullNameEn: fullNameEn || fullNameAm,
      phone: finalPhone,
      gender,
      department,
      gradeLevel,
      roleAm: roleAm || (lang === 'am' ? `ተማሪ (${dict.grades[gradeLevel]})` : `Student (${dict.grades[gradeLevel]})`),
      roleEn: roleAm || 'Student',
      photoUrl: selectedPhoto,
      registeredDate: new Date().toISOString().split('T')[0],
      bloodGroup,
      emergencyContact: {
        name: emergencyName || 'የቤተሰብ አባል',
        phone: emergencyPhone || '0911223344',
        relation: emergencyRelation,
      },
      subcity,
      status: 'pending_approval',
      consecutiveAbsences: 0,
    };

    onAddMember(newMember);
    setIsAddModalOpen(false);
    setActiveTab('pending'); // switch to pending tab to view

    // Reset fields
    setFullNameAm('');
    setFullNameEn('');
    setPhone('');
    setPhoneError('');
    setRoleAm('');
    setEmergencyName('');
    setEmergencyPhone('');
  };

  const openApproveModal = (member: Member) => {
    setApprovingMember(member);
    // Suggest a default template e.g. WW-2026-0150
    const nextNum = 100 + approvedMembers.length + 1;
    setManualIdInput(`WW-2026-0${nextNum}`);
    setIdError('');
  };

  const handleConfirmApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingMember) return;

    const trimmedId = manualIdInput.trim().toUpperCase();
    if (!trimmedId) {
      setIdError('እባክዎ የተማሪውን መታወቂያ ኮድ ያስገቡ (Student ID is required)');
      return;
    }

    // Check if ID already exists among approved members
    const duplicate = members.some(
      (m) => m.id !== approvingMember.id && m.status === 'active' && m.code.toUpperCase() === trimmedId
    );
    if (duplicate) {
      setIdError(`ይህ የተማሪ መታወቂያ ("${trimmedId}") ቀድሞ ለሌላ ተማሪ ተሰጥቷል! የተለየ ኮድ ያስገቡ።`);
      return;
    }

    setIsApproving(true);
    try {
      await onApproveMember(approvingMember.id, trimmedId);
      setApprovingMember(null);
      setActiveTab('approved'); // Immediately switch tab to approved students
    } catch (err) {
      setIdError('ማጽደቅ አልተሳካም። እባክዎ እንደገና ይሞክሩ።');
    } finally {
      setIsApproving(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {dict.members.title}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {dict.members.subtitle} ·{' '}
            <span className="text-slate-200 font-medium font-mono tabular-nums">
              {approvedMembers.length}
            </span>{' '}
            {dict.members.totalMembers.toLowerCase()}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-lg shadow-amber-500/20 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>{dict.members.addMember}</span>
          </button>
        </div>
      </div>

      {/* Primary Tab Switcher: Approved Students vs Pending Approvals Queue */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('approved')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
              activeTab === 'approved'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>የተመዘገቡ ተማሪዎች ({approvedMembers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 relative ${
              activeTab === 'pending'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
            }`}
          >
            <Clock className="w-4 h-4 text-amber-400" />
            <span>የማጽደቂያ ሰሌዳ (Pending Approval)</span>
            {pendingMembers.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'pending' ? 'bg-slate-950 text-amber-300' : 'bg-rose-500 text-white'
              }`}>
                {pendingMembers.length}
              </span>
            )}
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <span>
            ስልጣን፦ <strong className="text-white">{currentAdminRole === 'super_admin' ? 'ዋና አስተዳዳሪ (Super Admin)' : 'ረዳት አስተዳዳሪ (Admin)'}</strong>
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={dict.members.searchPlaceholder}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Department / Committee segmented buttons */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: dict.departments.all },
            { id: 'discipline', label: dict.departments.discipline },
            { id: 'education', label: dict.departments.education },
            { id: 'arts', label: dict.departments.arts },
            { id: 'abnet', label: dict.departments.abnet },
            { id: 'choir', label: dict.departments.choir },
            { id: 'general', label: dict.departments.general },
          ].map((dept) => (
            <button
              key={dept.id}
              onClick={() => setSelectedDept(dept.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedDept === dept.id
                  ? 'bg-slate-800 text-amber-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              {dept.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table / Queue */}
      <div className="bg-slate-900/70 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 font-medium">ተማሪ / አባል (Student)</th>
                <th className="py-3.5 px-4 font-medium">{dict.members.code}</th>
                <th className="py-3.5 px-4 font-medium">{dict.members.department}</th>
                <th className="py-3.5 px-4 font-medium">{dict.members.phone}</th>
                <th className="py-3.5 px-4 font-medium">{dict.members.emergencyContact}</th>
                <th className="py-3.5 px-4 font-medium">የምዝገባ ሁኔታ</th>
                <th className="py-3.5 px-4 font-medium text-right">{dict.members.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {displayedMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    {activeTab === 'pending'
                      ? 'በአሁኑ ወቅት ምንም ያልጸደቀ ማመልከቻ የለም።'
                      : 'ምንም የተገኘ አባል የለም።'}
                  </td>
                </tr>
              ) : (
                displayedMembers.map((member) => (
                  <tr
                    key={member.id}
                    className="hover:bg-slate-800/40 transition-colors group"
                  >
                    <td className="py-3 px-4 cursor-pointer" onClick={() => setSelectedMember(member)}>
                      <div className="flex items-center gap-3">
                        <img
                          src={member.photoUrl}
                          alt={member.fullNameAm}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-700 shrink-0 bg-slate-900"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = member.gender === 'female' ? AVATAR_FEMALE : AVATAR_MALE;
                          }}
                          referrerPolicy="no-referrer"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-100 truncate">
                            {member.fullNameAm}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {member.fullNameEn}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono font-bold cursor-pointer" onClick={() => setSelectedMember(member)}>
                      {member.status === 'pending_approval' ? (
                        <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 text-[10px]">
                          በመጠባበቅ ላይ
                        </span>
                      ) : (
                        <span className="text-amber-400">{member.code}</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-slate-300 cursor-pointer" onClick={() => setSelectedMember(member)}>
                      <div>
                        <span>{dict.departments[member.department]}</span>
                        <p className="text-[10px] text-slate-500">{member.roleAm}</p>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-300 cursor-pointer" onClick={() => setSelectedMember(member)}>
                      {member.phone}
                    </td>

                    <td className="py-3 px-4 text-slate-300 cursor-pointer" onClick={() => setSelectedMember(member)}>
                      <p className="truncate max-w-[150px]">
                        {member.emergencyContact.name}
                      </p>
                      <p className="text-[10px] font-mono text-slate-500">
                        {member.emergencyContact.phone}
                      </p>
                    </td>

                    <td className="py-3 px-4">
                      {member.status === 'active' ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> ጸድቋል
                        </span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1 font-medium">
                          <Clock className="w-3.5 h-3.5" /> ማጽደቅ ይፈልጋል
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {member.status === 'pending_approval' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); openApproveModal(member); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shadow-sm"
                          >
                            <Key className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">አጽድቅና ID ስጥ</span>
                            <span className="sm:hidden">አጽድቅ</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`${member.fullNameAm} የተባለውን ተማሪ ማመልከቻ ውድቅ ማድረግ ይፈልጋሉ?`)) {
                                onRejectMember(member.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                            title="ውድቅ አድርግ"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); setQrModalMember(member); }}
                            title={dict.members.scanQr}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onOpenCardStudio(member); }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-medium transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{dict.members.printBadge}</span>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingMember(member); }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition-colors"
                            title="አርትዕ (Edit)"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              if (confirm(`${member.fullNameAm} የተባለውን ተማሪ መሰረዝ ይፈልጋሉ?`)) {
                                onDeleteMember?.(member.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                            title="ሰርዝ (Delete)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Student ID Assignment Modal upon Approval */}
      {approvingMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setApprovingMember(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  የተማሪ መታወቂያ መመደቢያ (Manual Student ID)
                </h3>
                <p className="text-xs text-slate-400">
                  አስተዳዳሪው ለተማሪው መለያ ቁጥር በእጅ አስገብቶ ያጸድቃል
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmApproval} className="mt-4 space-y-4 text-xs">
              {/* Student Summary */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-3">
                <img
                  src={approvingMember.photoUrl}
                  alt={approvingMember.fullNameAm}
                  className="w-12 h-12 rounded-xl object-cover border border-amber-400 shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0">
                  <h4 className="font-bold text-white truncate text-sm">
                    {approvingMember.fullNameAm}
                  </h4>
                  <p className="text-slate-400">{approvingMember.fullNameEn}</p>
                  <p className="text-amber-400 mt-0.5">{approvingMember.roleAm}</p>
                </div>
              </div>

              {/* Manual ID Input */}
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  የተማሪ መለያ ቁጥር (Student ID Code) *
                </label>
                <input
                  type="text"
                  required
                  value={manualIdInput}
                  onChange={(e) => {
                    setManualIdInput(e.target.value);
                    setIdError('');
                  }}
                  placeholder="ምሳሌ: WW-2026-0150 ወይም የት/ቤቱ መለያ"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-amber-500/60 rounded-xl text-sm font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400 shadow-inner"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  አስተዳዳሪው የፈለገውን ቁጥር ወይም ቅደም ተከተል መመደብ ይችላል።
                </p>
                {idError && (
                  <p className="text-rose-400 text-xs font-medium mt-1.5">{idError}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  disabled={isApproving}
                  onClick={() => setApprovingMember(null)}
                  className="px-3.5 py-2 text-slate-400 hover:text-white disabled:opacity-50"
                >
                  ሰርዝ
                </button>
                <button
                  type="submit"
                  disabled={isApproving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 flex items-center gap-2"
                >
                  {isApproving ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>በማጽደቅ ላይ...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>አጽድቅና Student ID ስጥ</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Detail Modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setSelectedMember(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            <div className="flex items-center gap-4 mb-6">
              <img src={selectedMember.photoUrl} alt={selectedMember.fullNameAm} className="w-20 h-20 rounded-2xl object-cover border-2 border-amber-400" />
              <div>
                <h3 className="text-lg font-bold text-white">{selectedMember.fullNameAm}</h3>
                <p className="text-slate-400">{selectedMember.fullNameEn}</p>
                <p className="text-amber-400 font-mono text-sm">{selectedMember.code}</p>
              </div>
            </div>
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-slate-500">ሙሉ ስም</label><p className="text-white">{selectedMember.fullNameAm}</p></div>
                <div><label className="text-slate-500">ክርስትና ስም</label><p className="text-white">{selectedMember.christianName || 'N/A'}</p></div>
                <div><label className="text-slate-500">ጾታ</label><p className="text-white">{selectedMember.gender === 'male' ? 'ወንድ' : 'ሴት'}</p></div>
                <div><label className="text-slate-500">የትውልድ ዘመን</label><p className="text-white">{selectedMember.birthYear || 'N/A'}</p></div>
                <div><label className="text-slate-500">ስልክ ቁጥር</label><p className="text-white">{selectedMember.phone}</p></div>
                <div><label className="text-slate-500">አድራሻ</label><p className="text-white">{selectedMember.subcity || 'N/A'}</p></div>
                <div><label className="text-slate-500">ክፍል</label><p className="text-white">{selectedMember.department || 'N/A'}</p></div>
              </div>
              <div className="pt-2 border-t border-slate-800">
                <label className="text-slate-500 block mb-1">የአደጋ ጊዜ ተጠሪ</label>
                <p className="text-white font-medium">{selectedMember.emergencyContact.name}</p>
                <p className="text-slate-300">{selectedMember.emergencyContact.phone} ({selectedMember.emergencyContact.relation})</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Quick Modal */}
      {qrModalMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl relative">
            <button
              onClick={() => setQrModalMember(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <img
              src={qrModalMember.photoUrl}
              alt={qrModalMember.fullNameAm}
              className="w-16 h-16 rounded-xl object-cover border-2 border-amber-400 mx-auto mb-3 shadow-md"
              referrerPolicy="no-referrer"
            />
            <h4 className="text-base font-bold text-white">
              {qrModalMember.fullNameAm}
            </h4>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {qrModalMember.code}
            </p>

            <div className="my-5 p-4 bg-white rounded-2xl flex items-center justify-center w-fit mx-auto shadow-inner">
              <QRCodeView value={qrModalMember.code} size={150} />
            </div>

            <button
              onClick={() => {
                setQrModalMember(null);
                onOpenCardStudio(qrModalMember);
              }}
              className="w-full py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold hover:bg-amber-400 transition-colors flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>{dict.members.printBadge}</span>
            </button>
          </div>
        </div>
      )}

      {/* Add / Register New Member Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl relative my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {dict.members.addMember}
                  </h3>
                  <p className="text-xs text-slate-400">
                    የተማሪው ወይም የአባሉ መረጃ ከተመዘገበ በኋላ በአስተዳዳሪ ጸድቆ Student ID ይሰጠዋል
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMember} className="mt-5 space-y-4">
              {/* Photo Upload / Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  የተማሪው ፎቶ
                </label>
                <div className="flex items-center gap-4">
                  <img
                    src={selectedPhoto}
                    alt="Preview"
                    className="w-16 h-16 rounded-xl object-cover border-2 border-amber-400/50 shadow-md shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPhoto(AVATAR_MALE)}
                        className={`text-xs px-2.5 py-1 rounded-lg border ${
                          selectedPhoto === AVATAR_MALE
                            ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        ወንድ
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedPhoto(AVATAR_FEMALE)}
                        className={`text-xs px-2.5 py-1 rounded-lg border ${
                          selectedPhoto === AVATAR_FEMALE
                            ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        ሴት
                      </button>
                    </div>
                    <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300">
                      <Upload className="w-3.5 h-3.5" />
                      <span>ከኮምፒውተር ይጫኑ (Upload Photo)</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Name Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    ሙሉ ስም (በአማርኛ) *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullNameAm}
                    onChange={(e) => setFullNameAm(e.target.value)}
                    placeholder="ምሳሌ: አበበ ከበደ ወርቁ"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Full Name (English)
                  </label>
                  <input
                    type="text"
                    value={fullNameEn}
                    onChange={(e) => setFullNameEn(e.target.value)}
                    placeholder="e.g. Abebe Kebede Worku"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Class Grade Level & Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    የክፍል ደረጃ (Class Grade) *
                  </label>
                  <select
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value as GradeLevel)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="pre_kg">🧸 ቅድመ አንደኛ (Pre-School)</option>
                    <option value="grade_1_2">🎒 1ኛ እና 2ኛ ክፍል (Grades 1 & 2)</option>
                    <option value="grade_3_5">📚 3ኛ–5ኛ ክፍል (Grades 3–5)</option>
                    <option value="grade_6_9">🎓 6ኛ–9ኛ ክፍል (Grades 6–9)</option>
                    <option value="leaders">🛡️ አስተዳዳሪ / መምህር (Staff)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    የአገልግሎት ኮሚቴ
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value as Department)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="discipline">{dict.departments.discipline}</option>
                    <option value="education">{dict.departments.education}</option>
                    <option value="arts">{dict.departments.arts}</option>
                    <option value="abnet">{dict.departments.abnet}</option>
                    <option value="choir">{dict.departments.choir}</option>
                    <option value="general">{dict.departments.general}</option>
                  </select>
                </div>
              </div>

              {/* Phone & Gender */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    ስልክ ቁጥር (10 አሃዝ በ 09 ወይም 07)
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setPhoneError('');
                    }}
                    placeholder="ምሳሌ፡ 0911223344"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500"
                  />
                  {phoneError && (
                    <p className="text-rose-400 text-[10px] font-medium mt-1">{phoneError}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    ጾታ / Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as 'male' | 'female')}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="male">ወንድ</option>
                    <option value="female">ሴት</option>
                  </select>
                </div>
              </div>

              {/* Emergency / Parent Contact */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <span className="text-[11px] font-semibold text-amber-400">
                  የወላጅ / የአደጋ ጊዜ ተጠሪ (Parent / Guardian Contact)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    placeholder="የወላጅ ስም (Name)"
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    placeholder="የወላጅ ስልክ (Phone)"
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono focus:outline-none"
                  />
                  <input
                    type="text"
                    value={emergencyRelation}
                    onChange={(e) => setEmergencyRelation(e.target.value)}
                    placeholder="ዝምድና (Relation)"
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  ሰርዝ / Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold shadow-lg shadow-amber-500/20"
                >
                  መዝግብ (ይላክ)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditingMember(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pb-3 border-b border-slate-800 mb-4">
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Edit className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">የተማሪ መረጃ ማስተካከያ (Edit Student)</h3>
                <p className="text-xs text-slate-400">ID: {editingMember.code}</p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onUpdateMember?.(editingMember);
                setEditingMember(null);
              }}
              className="space-y-4 text-xs"
            >
              {/* Photo Upload for Edit Student */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  የተማሪው ፎቶ (Student Photo)
                </label>
                <div className="flex items-center gap-4">
                  <img
                    src={editingMember.photoUrl || (editingMember.gender === 'female' ? AVATAR_FEMALE : AVATAR_MALE)}
                    alt="Preview"
                    className="w-16 h-22 rounded-xl object-cover border-2 border-amber-400/50 shadow-md shrink-0 bg-slate-950"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = editingMember.gender === 'female' ? AVATAR_FEMALE : AVATAR_MALE;
                    }}
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex flex-col gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-amber-400 hover:text-amber-300 border border-slate-700 transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>ፎቶ ቀይር (Change Photo)</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setEditingMember({ ...editingMember, photoUrl: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[10px] text-slate-500 italic">ከኮምፒውተርዎ አዲስ ፎቶ ይጫኑ (Upload new photo)</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">ሙሉ ስም (Amharic) *</label>
                <input
                  type="text"
                  required
                  value={editingMember.fullNameAm}
                  onChange={(e) => setEditingMember({ ...editingMember, fullNameAm: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Full Name (English)</label>
                <input
                  type="text"
                  value={editingMember.fullNameEn}
                  onChange={(e) => setEditingMember({ ...editingMember, fullNameEn: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">ስልክ ቁጥር (Phone) *</label>
                  <input
                    type="tel"
                    required
                    value={editingMember.phone}
                    onChange={(e) => setEditingMember({ ...editingMember, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">የተማሪ መለያ (Student ID)</label>
                  <input
                    type="text"
                    required
                    value={editingMember.code}
                    onChange={(e) => setEditingMember({ ...editingMember, code: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">ክፍል (Department)</label>
                  <select
                    value={editingMember.department}
                    onChange={(e) => setEditingMember({ ...editingMember, department: e.target.value as Department })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="education">ትምህርት (Education)</option>
                    <option value="discipline">ስነ ስርዓት (Discipline)</option>
                    <option value="arts">ኪነ ጥበብ (Arts)</option>
                    <option value="abnet">አብነት (Abnet)</option>
                    <option value="choir">መዝሙር (Choir)</option>
                    <option value="general">አጠቃላይ (General)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">የክፍል ደረጃ (Grade)</label>
                  <select
                    value={editingMember.gradeLevel || 'pre_kg'}
                    onChange={(e) => setEditingMember({ ...editingMember, gradeLevel: e.target.value as GradeLevel })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="pre_kg">ቅድመ አንደኛ (Pre-KG)</option>
                    <option value="grade_1_2">1ኛ እና 2ኛ ክፍል (Grades 1-2)</option>
                    <option value="grade_3_5">3ኛ–5ኛ ክፍል (Grades 3-5)</option>
                    <option value="grade_6_9">6ኛ–9ኛ ክፍል (Grades 6-9)</option>
                    <option value="leaders">አስተዳዳሪ (Leaders)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">ክርስትና ስም (Christian Name)</label>
                  <input
                    type="text"
                    value={editingMember.christianName || ''}
                    onChange={(e) => setEditingMember({ ...editingMember, christianName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">የትውልድ ዘመን (Birth Year)</label>
                  <input
                    type="text"
                    value={editingMember.birthYear || ''}
                    onChange={(e) => setEditingMember({ ...editingMember, birthYear: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">ጾታ (Gender)</label>
                  <select
                    value={editingMember.gender}
                    onChange={(e) => setEditingMember({ ...editingMember, gender: e.target.value as 'male' | 'female' })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="male">ወንድ (Male)</option>
                    <option value="female">ሴት (Female)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">አድራሻ (Address)</label>
                  <input
                    type="text"
                    value={editingMember.subcity || ''}
                    onChange={(e) => setEditingMember({ ...editingMember, subcity: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <p className="text-amber-400 font-bold">የአደጋ ጊዜ ተጠሪ (Emergency Contact)</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="ስም (Name)"
                    value={editingMember.emergencyContact.name}
                    onChange={(e) => setEditingMember({ ...editingMember, emergencyContact: { ...editingMember.emergencyContact, name: e.target.value } })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white"
                  />
                  <input
                    type="text"
                    placeholder="ስልክ (Phone)"
                    value={editingMember.emergencyContact.phone}
                    onChange={(e) => setEditingMember({ ...editingMember, emergencyContact: { ...editingMember.emergencyContact, phone: e.target.value } })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  ሰርዝ / Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl text-xs font-bold shadow-lg shadow-sky-500/20"
                >
                  ለውጦችን መዝግብ (Save Changes)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
