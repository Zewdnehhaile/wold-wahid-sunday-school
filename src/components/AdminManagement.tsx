import React, { useState, useEffect } from 'react';
import { AdminUser, SundaySchoolDepartment, Language, UserRole } from '../types';
import { t } from '../utils/translations';
import { AVATAR_MALE } from '../data/initialData';
import {
  ShieldCheck,
  UserPlus,
  CheckCircle2,
  XCircle,
  Trash2,
  Users,
  Check,
  X,
  Phone,
  Sparkles,
  Edit,
  Lock,
  UserCheck,
  UserX,
} from 'lucide-react';

export interface AdminPermission {
  approveStudents: boolean;
  takeAttendance: boolean;
  manageSupport: boolean;
  exportReports: boolean;
}

export interface DetailedAdmin extends AdminUser {
  phone: string;
  telegramId?: string;
  customRoleTitle?: string;
  password?: string;
  status?: 'active' | 'suspended';
  permissions: AdminPermission;
}

interface AdminManagementProps {
  currentAdmin: AdminUser;
  lang: Language;
}

export const AdminManagement: React.FC<AdminManagementProps> = ({
  currentAdmin,
  lang,
}) => {
  const [adminsList, setAdminsList] = useState<DetailedAdmin[]>(() => {
    const saved = localStorage.getItem('ww_custom_admins');
    const defaultSuperAdmins: DetailedAdmin[] = [
      {
        id: 'admin-zewdneh',
        nameAm: 'ዘውድነህ',
        nameEn: 'Zewdneh',
        role: 'super_admin',
        department: 'education',
        phone: '0988286610',
        telegramId: '606572754',
        customRoleTitle: 'ዋና አስተዳዳሪ (Super Admin)',
        password: 'admin123password',
        status: 'active',
        avatarUrl: AVATAR_MALE,
        permissions: {
          approveStudents: true,
          takeAttendance: true,
          manageSupport: true,
          exportReports: true,
        },
      },
      {
        id: 'admin-kidusyared',
        nameAm: 'ቅዱስ ያሬድ',
        nameEn: 'Kidusyared',
        role: 'super_admin',
        department: 'education',
        phone: '0927209931',
        telegramId: '549201832',
        customRoleTitle: 'ዋና አስተዳዳሪ (Super Admin)',
        password: 'admin123password',
        status: 'active',
        avatarUrl: AVATAR_MALE,
        permissions: {
          approveStudents: true,
          takeAttendance: true,
          manageSupport: true,
          exportReports: true,
        },
      },
    ];

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((a: any): DetailedAdmin => ({
            ...a,
            status: (a.status === 'suspended' ? 'suspended' : 'active') as 'active' | 'suspended',
            role: (a.role === 'super_admin' ? 'super_admin' : 'admin') as UserRole,
          }));
        }
      } catch {
        // fallback
      }
    }
    return defaultSuperAdmins;
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<DetailedAdmin | null>(null);

  // New admin form state
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminPhone, setNewAdminPhone] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<UserRole>('admin');
  const [newAdminTelegramId, setNewAdminTelegramId] = useState('');
  const [newAdminDept, setNewAdminDept] = useState<SundaySchoolDepartment>('education');
  const [customRoleTitle, setCustomRoleTitle] = useState('የትምህርት ክፍል አስተባባሪ');
  const [permApprove, setPermApprove] = useState(true);
  const [permAttendance, setPermAttendance] = useState(true);
  const [permSupport, setPermSupport] = useState(true);
  const [permReports, setPermReports] = useState(false);

  const dict = t[lang];
  const isMasterSuper = currentAdmin.nameAm === 'ዘውድነህ' || currentAdmin.nameAm === 'ቅዱስ ያሬድ';
  const isSuperAdmin = currentAdmin.role === 'super_admin';

  const visibleAdmins = adminsList.filter((adm: DetailedAdmin) => {
    if (isSuperAdmin) return true;
    return adm.role !== 'super_admin';
  });

  const handleCreateAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminName.trim() || !newAdminPhone.trim() || !newAdminPassword.trim()) return;

    const assignedRole: UserRole = isMasterSuper ? newAdminRole : 'admin';

    const newAdmin: DetailedAdmin = {
      id: `admin-${Date.now()}`,
      nameAm: newAdminName.trim(),
      nameEn: newAdminName.trim(),
      role: assignedRole,
      department: newAdminDept,
      customRoleTitle: customRoleTitle.trim() || (assignedRole === 'super_admin' ? 'ዋና አስተዳዳሪ (Super Admin)' : 'የክፍል አስተባባሪ'),
      phone: newAdminPhone.trim(),
      password: newAdminPassword.trim(),
      status: 'active',
      telegramId: newAdminTelegramId.trim() || `${Math.floor(100000000 + Math.random() * 900000000)}`,
      avatarUrl: AVATAR_MALE,
      permissions: {
        approveStudents: assignedRole === 'super_admin' ? true : permApprove,
        takeAttendance: assignedRole === 'super_admin' ? true : permAttendance,
        manageSupport: assignedRole === 'super_admin' ? true : permSupport,
        exportReports: assignedRole === 'super_admin' ? true : permReports,
      },
    };

    const updated = [...adminsList, newAdmin];
    setAdminsList(updated);
    localStorage.setItem('ww_custom_admins', JSON.stringify(updated));
    setIsAddModalOpen(false);

    // Reset form
    setNewAdminName('');
    setNewAdminPhone('');
    setNewAdminPassword('');
    setNewAdminRole('admin');
    setNewAdminTelegramId('');
    setCustomRoleTitle('የትምህርት ክፍል አስተባባሪ');
  };

  const handleUpdateAdminProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;

    const updated = adminsList.map((adm) => (adm.id === editingAdmin.id ? editingAdmin : adm));
    setAdminsList(updated);
    localStorage.setItem('ww_custom_admins', JSON.stringify(updated));
    setEditingAdmin(null);
  };

  const handleTogglePermission = (adminId: string, permKey: keyof AdminPermission) => {
    const updated = adminsList.map((adm) => {
      if (adm.id === adminId && adm.role !== 'super_admin') {
        return {
          ...adm,
          permissions: {
            ...adm.permissions,
            [permKey]: !adm.permissions[permKey],
          },
        };
      }
      return adm;
    });
    setAdminsList(updated);
    localStorage.setItem('ww_custom_admins', JSON.stringify(updated));
  };

  const handleToggleStatus = (adminId: string) => {
    const updated = adminsList.map((adm) => {
      if (adm.id === adminId && adm.role !== 'super_admin') {
        const nextStatus: 'active' | 'suspended' = adm.status === 'suspended' ? 'active' : 'suspended';
        return { ...adm, status: nextStatus };
      }
      return adm;
    });
    setAdminsList(updated);
    localStorage.setItem('ww_custom_admins', JSON.stringify(updated));
  };

  const handleDeleteAdmin = (adminId: string) => {
    if (confirm('ይህን አገልጋይ / አስተዳዳሪ ከሲስተሙ መሰረዝ ይፈልጋሉ?')) {
      const filtered = adminsList.filter((adm) => adm.id !== adminId);
      setAdminsList(filtered);
      localStorage.setItem('ww_custom_admins', JSON.stringify(filtered));
    }
  };

  const getDeptNameAm = (dept: SundaySchoolDepartment): string => {
    switch (dept) {
      case 'education': return 'ትምህርት ክፍል';
      case 'choir': return 'መዝሙር ክፍል';
      case 'arts': return 'ኪነ ጥበብ ክፍል';
      case 'abnet': return 'አብነት ክፍል';
      case 'discipline': return 'ስነ ስርዓት ክፍል';
      default: return 'አጠቃላይ';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-amber-400" />
            <span>የአስተዳዳሪዎች ማኔጅመንት እና ፈቃድ መስጫ (Admin Management)</span>
          </h2>
          <p className="text-sm text-emerald-200/70 mt-1">
            የሰንበት ትምህርት ቤቱን አገልጋዮች መመደብ፣ ሚና መስጠት (Admin / Super Admin)፣ የይለፍ ቃል ማስተካከል እና የሲስተም ፈቃዶች
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>አዲስ አስተዳዳሪ ጨምር</span>
        </button>
      </div>

      {/* Admins Table */}
      <div className="bg-[#09351c]/90 backdrop-blur-md border border-[#0f4425] rounded-3xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#062414] border-b border-[#0f4425] text-emerald-200 font-semibold">
                <th className="py-3 px-4">አስተዳዳሪ (Admin)</th>
                <th className="py-3 px-4">ሚና (Role) & ስልክ</th>
                <th className="py-3 px-4">ሁኔታ (Status)</th>
                <th className="py-3 px-4 text-center">ተማሪዎችን ማጽደቅ</th>
                <th className="py-3 px-4 text-center">QR ክትትል</th>
                <th className="py-3 px-4 text-center">ድጋፍ</th>
                <th className="py-3 px-4 text-center">ሪፖርት</th>
                <th className="py-3 px-4 text-right">እርምጃዎች</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0f4425]/60">
              {visibleAdmins.map((adm) => {
                const isSuper = adm.role === 'super_admin';
                const isSuspended = adm.status === 'suspended';

                return (
                  <tr key={adm.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={adm.avatarUrl || AVATAR_MALE}
                          alt={adm.nameAm}
                          className="w-9 h-9 rounded-full object-cover border border-amber-400/40 shrink-0"
                        />
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span>{adm.nameAm}</span>
                            {isSuper && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                ዋና
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-emerald-200/70">{adm.customRoleTitle || getDeptNameAm(adm.department)}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-mono text-emerald-200">{adm.phone}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-amber-400" />
                        <span>{adm.password ? '••••••••' : 'ምንም የለም'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          isSuspended
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}
                      >
                        {isSuspended ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                        <span>{isSuspended ? 'ታግዷል (Suspended)' : 'ንቁ (Active)'}</span>
                      </span>
                    </td>

                    {/* Permissions Switches */}
                    <td className="py-3 px-4 text-center">
                      <button
                        disabled={isSuper}
                        onClick={() => handleTogglePermission(adm.id, 'approveStudents')}
                        className={`p-1.5 rounded-lg transition-colors ${
                          adm.permissions.approveStudents
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-[#062414] text-slate-500 border border-[#0f4425]'
                        } ${isSuper ? 'opacity-80 cursor-default' : 'hover:scale-105 cursor-pointer'}`}
                      >
                        {adm.permissions.approveStudents ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      </button>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        disabled={isSuper}
                        onClick={() => handleTogglePermission(adm.id, 'takeAttendance')}
                        className={`p-1.5 rounded-lg transition-colors ${
                          adm.permissions.takeAttendance
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-[#062414] text-slate-500 border border-[#0f4425]'
                        } ${isSuper ? 'opacity-80 cursor-default' : 'hover:scale-105 cursor-pointer'}`}
                      >
                        {adm.permissions.takeAttendance ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      </button>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        disabled={isSuper}
                        onClick={() => handleTogglePermission(adm.id, 'manageSupport')}
                        className={`p-1.5 rounded-lg transition-colors ${
                          adm.permissions.manageSupport
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-[#062414] text-slate-500 border border-[#0f4425]'
                        } ${isSuper ? 'opacity-80 cursor-default' : 'hover:scale-105 cursor-pointer'}`}
                      >
                        {adm.permissions.manageSupport ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      </button>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        disabled={isSuper}
                        onClick={() => handleTogglePermission(adm.id, 'exportReports')}
                        className={`p-1.5 rounded-lg transition-colors ${
                          adm.permissions.exportReports
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-[#062414] text-slate-500 border border-[#0f4425]'
                        } ${isSuper ? 'opacity-80 cursor-default' : 'hover:scale-105 cursor-pointer'}`}
                      >
                        {adm.permissions.exportReports ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      </button>
                    </td>

                    <td className="py-3 px-4 text-right">
                      {!isSuper && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleStatus(adm.id)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer ${
                              isSuspended
                                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                                : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                            }`}
                            title={isSuspended ? 'አንቃ (Activate)' : 'አግድ (Suspend)'}
                          >
                            {isSuspended ? 'አንቃ' : 'አግድ'}
                          </button>

                          <button
                            onClick={() => setEditingAdmin(adm)}
                            className="p-1.5 rounded-lg text-sky-400 hover:bg-sky-950/60 transition-colors cursor-pointer"
                            title="መረጃ አስተካክል (Edit)"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteAdmin(adm.id)}
                            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/60 transition-colors cursor-pointer"
                            title="አስተዳዳሪውን ሰርዝ (Delete)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add New Admin Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#09351c] border border-[#0f4425] rounded-3xl w-full max-w-lg p-6 shadow-2xl relative">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-emerald-200 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 pb-3 border-b border-[#0f4425]">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  አዲስ አድሚን / አስተባባሪ መዝግብ
                </h3>
                <p className="text-xs text-emerald-200/70">
                  የይለፍ ቃል፣ ሚና (Admin / Super Admin) እና የፈቃድ ዝርዝሮችን ያስገቡ
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateAdmin} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-emerald-100 font-semibold mb-1">
                  የአስተዳዳሪው ሙሉ ስም *
                </label>
                <input
                  type="text"
                  required
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="ምሳሌ: ዳዊት ተስፋዬ"
                  className="w-full px-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-emerald-100 font-medium mb-1">
                    ስልክ ቁጥር *
                  </label>
                  <input
                    type="tel"
                    required
                    value={newAdminPhone}
                    onChange={(e) => setNewAdminPhone(e.target.value)}
                    placeholder="0911..."
                    className="w-full px-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-emerald-100 font-medium mb-1">
                    የይለፍ ቃል (Password) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder="የሚስጥር ቁጥር..."
                    className="w-full px-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Role and Department */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-emerald-100 font-medium mb-1">
                    የአስተዳዳሪ ሚና (Role) *
                  </label>
                  <select
                    disabled={!isMasterSuper}
                    value={isMasterSuper ? newAdminRole : 'admin'}
                    onChange={(e) => setNewAdminRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-white focus:outline-none focus:border-amber-400 disabled:opacity-70"
                  >
                    <option value="admin">አስተዳዳሪ (Admin)</option>
                    {isMasterSuper && <option value="super_admin">ዋና አስተዳዳሪ (Super Admin)</option>}
                  </select>
                  {!isMasterSuper && (
                    <p className="text-[10px] text-amber-400 mt-0.5">ማሳሰቢያ፡ ዋና አድሚኖች ብቻ Super Admin መፍጠር ይችላሉ።</p>
                  )}
                </div>

                <div>
                  <label className="block text-emerald-100 font-medium mb-1">
                    የአገልግሎት ክፍል (Department)
                  </label>
                  <select
                    value={newAdminDept}
                    onChange={(e) => {
                      const dept = e.target.value as SundaySchoolDepartment;
                      setNewAdminDept(dept);
                      setCustomRoleTitle(`የ${getDeptNameAm(dept)} አስተባባሪ`);
                    }}
                    className="w-full px-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="education">ትምህርት ክፍል</option>
                    <option value="choir">መዝሙር ክፍል</option>
                    <option value="abnet">አብነት ክፍል</option>
                    <option value="arts">ኪነ ጥበብ ክፍል</option>
                    <option value="discipline">ስነ ስርዓት ክፍል</option>
                    <option value="general">አጠቃላይ አስተዳደር</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-emerald-100 font-medium mb-1">
                    የስራ ድርሻ ስም (Role Title)
                  </label>
                  <input
                    type="text"
                    required
                    value={customRoleTitle}
                    onChange={(e) => setCustomRoleTitle(e.target.value)}
                    placeholder="ምሳሌ: የትምህርት ክፍል አስተባባሪ"
                    className="w-full px-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-emerald-100 font-medium mb-1">
                    የቴሌግራም ID
                  </label>
                  <input
                    type="text"
                    value={newAdminTelegramId}
                    onChange={(e) => setNewAdminTelegramId(e.target.value)}
                    placeholder="ምሳሌ: 606572754"
                    className="w-full px-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Permissions Checklist */}
              <div>
                <label className="block text-emerald-100 font-semibold mb-2">
                  የተፈቀዱ ስራዎች (Allowed Permissions)
                </label>
                <div className="grid grid-cols-2 gap-2 bg-[#062414] p-3 rounded-xl border border-[#0f4425]">
                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permApprove}
                      onChange={(e) => setPermApprove(e.target.checked)}
                      className="rounded text-amber-500 bg-[#09351c] border-[#0f4425]"
                    />
                    <span>ተማሪዎችን ማጽደቅ</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permAttendance}
                      onChange={(e) => setPermAttendance(e.target.checked)}
                      className="rounded text-amber-500 bg-[#09351c] border-[#0f4425]"
                    />
                    <span>የQR ክትትል መመዝገብ</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permSupport}
                      onChange={(e) => setPermSupport(e.target.checked)}
                      className="rounded text-amber-500 bg-[#09351c] border-[#0f4425]"
                    />
                    <span>የድጋፍ ጥያቄ መከታተል</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permReports}
                      onChange={(e) => setPermReports(e.target.checked)}
                      className="rounded text-amber-500 bg-[#09351c] border-[#0f4425]"
                    />
                    <span>ሪፖርት ማውጣት</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-[#0f4425] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-2 text-emerald-200/70 hover:text-white cursor-pointer"
                >
                  ይቅር (Cancel)
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow cursor-pointer"
                >
                  መዝግብና ፍቀድ (Save Admin)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Admin Modal */}
      {editingAdmin && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#09351c] border border-[#0f4425] rounded-3xl w-full max-w-lg p-6 shadow-2xl relative">
            <button
              onClick={() => setEditingAdmin(null)}
              className="absolute top-4 right-4 text-emerald-200 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 pb-3 border-b border-[#0f4425]">
              <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                <Edit className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  የአስተዳዳሪ መረጃ ማስተካከያ (Edit Admin)
                </h3>
                <p className="text-xs text-emerald-200/70">
                  {editingAdmin.nameAm} - ሚና፣ የይለፍ ቃል እና መረጃ አዘምን
                </p>
              </div>
            </div>

            <form onSubmit={handleUpdateAdminProfile} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-emerald-100 font-semibold mb-1">
                  የአስተዳዳሪው ሙሉ ስም *
                </label>
                <input
                  type="text"
                  required
                  value={editingAdmin.nameAm}
                  onChange={(e) => setEditingAdmin({ ...editingAdmin, nameAm: e.target.value, nameEn: e.target.value })}
                  className="w-full px-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-emerald-100 font-medium mb-1">
                    ስልክ ቁጥር *
                  </label>
                  <input
                    type="tel"
                    required
                    value={editingAdmin.phone}
                    onChange={(e) => setEditingAdmin({ ...editingAdmin, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-emerald-100 font-medium mb-1">
                    የይለፍ ቃል (Password) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingAdmin.password || ''}
                    onChange={(e) => setEditingAdmin({ ...editingAdmin, password: e.target.value })}
                    className="w-full px-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-emerald-100 font-medium mb-1">
                    ሚና (Role) *
                  </label>
                  <select
                    value={editingAdmin.role}
                    onChange={(e) => setEditingAdmin({ ...editingAdmin, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="admin">አስተዳዳሪ (Admin)</option>
                    <option value="super_admin">ዋና አስተዳዳሪ (Super Admin)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-emerald-100 font-medium mb-1">
                    የስራ ድርሻ ስም (Role Title)
                  </label>
                  <input
                    type="text"
                    required
                    value={editingAdmin.customRoleTitle || ''}
                    onChange={(e) => setEditingAdmin({ ...editingAdmin, customRoleTitle: e.target.value })}
                    className="w-full px-3 py-2 bg-[#062414] border border-[#0f4425] rounded-xl text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#0f4425] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAdmin(null)}
                  className="px-3.5 py-2 text-emerald-200/70 hover:text-white cursor-pointer"
                >
                  ይቅር (Cancel)
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl shadow cursor-pointer"
                >
                  ለውጦችን አስቀምጥ (Update)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
