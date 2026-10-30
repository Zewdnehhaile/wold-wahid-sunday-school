import React, { useState, useEffect } from 'react';
import { AdminUser, SundaySchoolDepartment, Language, UserRole } from '../types';
import { t } from '../utils/translations';
import { AVATAR_MALE } from '../data/initialData';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDocs } from 'firebase/firestore';
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
  KeyRound,
  Megaphone,
} from 'lucide-react';
import { ChangePasswordModal } from './ChangePasswordModal';

export interface AdminPermission {
  canAccessSchedule: boolean;
  canAccessMembers: boolean;
  canAccessAttendance: boolean;
  canAccessSupport: boolean;
  canAccessAdmins: boolean;
  canAccessAnalytics: boolean;
  canBroadcast?: boolean;
  takeAttendance?: boolean;
  approveStudents?: boolean;
  manageSupport?: boolean;
  exportReports?: boolean;
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
  const [adminsList, setAdminsList] = useState<DetailedAdmin[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<DetailedAdmin | null>(null);
  const [actionNotice, setActionNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedAdminForPassword, setSelectedAdminForPassword] = useState<DetailedAdmin | null>(null);

  // New admin form state
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminPhone, setNewAdminPhone] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<UserRole>('admin');
  const [newAdminTelegramId, setNewAdminTelegramId] = useState('');
  const [newAdminDept, setNewAdminDept] = useState<SundaySchoolDepartment>('education');
  const [customRoleTitle, setCustomRoleTitle] = useState('የትምህርት ክፍል አስተባባሪ');
  const [permSchedule, setPermSchedule] = useState(false);
  const [permMembers, setPermMembers] = useState(false);
  const [permAttendance, setPermAttendance] = useState(true);
  const [permSupport, setPermSupport] = useState(false);
  const [permAdmins, setPermAdmins] = useState(false);
  const [permAnalytics, setPermAnalytics] = useState(false);
  const [permBroadcast, setPermBroadcast] = useState(false);

  // Real-time Firestore synchronization for administrators from live database
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'admins'),
      (snap) => {
        const loaded: DetailedAdmin[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          const p = d.permissions || {};
          const isSuper = d.role === 'super_admin';

          const resolvedPerms: AdminPermission = {
            canAccessSchedule: isSuper ? true : Boolean(p.canAccessSchedule),
            canAccessMembers: isSuper ? true : Boolean(p.canAccessMembers ?? p.approveStudents),
            canAccessAttendance: isSuper ? true : Boolean(p.canAccessAttendance ?? p.takeAttendance),
            canAccessSupport: isSuper ? true : Boolean(p.canAccessSupport ?? p.manageSupport),
            canAccessAdmins: isSuper ? true : Boolean(p.canAccessAdmins),
            canAccessAnalytics: isSuper ? true : Boolean(p.canAccessAnalytics ?? p.exportReports),
            canBroadcast: isSuper ? true : Boolean(p.canBroadcast),
            takeAttendance: isSuper ? true : Boolean(p.canAccessAttendance ?? p.takeAttendance),
            approveStudents: isSuper ? true : Boolean(p.canAccessMembers ?? p.approveStudents),
            manageSupport: isSuper ? true : Boolean(p.canAccessSupport ?? p.manageSupport),
            exportReports: isSuper ? true : Boolean(p.canAccessAnalytics ?? p.exportReports),
          };

          return {
            id: docSnap.id,
            nameAm: d.nameAm || '',
            nameEn: d.nameEn || d.nameAm || '',
            role: (d.role === 'super_admin' ? 'super_admin' : 'admin') as UserRole,
            department: (d.department || 'education') as SundaySchoolDepartment,
            phone: d.phone || '',
            telegramId: d.telegramId || '',
            customRoleTitle: d.customRoleTitle || '',
            password: d.password || '',
            status: (d.status === 'suspended' ? 'suspended' : 'active') as 'active' | 'suspended',
            avatarUrl: d.avatarUrl || AVATAR_MALE,
            permissions: resolvedPerms,
          };
        });

        setAdminsList(loaded);
        localStorage.setItem('ww_custom_admins', JSON.stringify(loaded));
      },
      (error) => {
        console.error('Firestore admins snapshot error:', error);
      }
    );

    return () => unsub();
  }, []);

  const dict = t[lang];
  const isMasterSuper = currentAdmin.nameAm === 'ዘውድነህ' || currentAdmin.nameAm === 'ቅዱስ ያሬድ';
  const isSuperAdmin = currentAdmin.role === 'super_admin';

  const visibleAdmins = adminsList.filter((adm: DetailedAdmin) => {
    if (isSuperAdmin) return true;
    return adm.role !== 'super_admin';
  });

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminName.trim() || !newAdminPhone.trim() || !newAdminPassword.trim()) return;

    const cleanPhone = newAdminPhone.trim();
    const phoneDigits = cleanPhone.replace(/\D/g, '').slice(-9);
    const assignedRole: UserRole = isSuperAdmin ? newAdminRole : 'admin';
    const newDocId = `admin-${phoneDigits || Date.now()}`;
    const newDocRef = doc(db, 'admins', newDocId);

    const newAdmin: DetailedAdmin = {
      id: newDocId,
      nameAm: newAdminName.trim(),
      nameEn: newAdminName.trim(),
      role: assignedRole,
      department: newAdminDept,
      customRoleTitle: customRoleTitle.trim() || (assignedRole === 'super_admin' ? 'ዋና አስተዳዳሪ (Super Admin)' : 'የክፍል አስተባባሪ'),
      phone: cleanPhone,
      password: newAdminPassword.trim(),
      status: 'active',
      telegramId: newAdminTelegramId.trim() || `${Math.floor(100000000 + Math.random() * 900000000)}`,
      avatarUrl: AVATAR_MALE,
      permissions: {
        canAccessSchedule: assignedRole === 'super_admin' ? true : permSchedule,
        canAccessMembers: assignedRole === 'super_admin' ? true : permMembers,
        canAccessAttendance: assignedRole === 'super_admin' ? true : permAttendance,
        canAccessSupport: assignedRole === 'super_admin' ? true : permSupport,
        canAccessAdmins: assignedRole === 'super_admin' ? true : permAdmins,
        canAccessAnalytics: assignedRole === 'super_admin' ? true : permAnalytics,
        canBroadcast: assignedRole === 'super_admin' ? true : permBroadcast,
        takeAttendance: assignedRole === 'super_admin' ? true : permAttendance,
        approveStudents: assignedRole === 'super_admin' ? true : permMembers,
        manageSupport: assignedRole === 'super_admin' ? true : permSupport,
        exportReports: assignedRole === 'super_admin' ? true : permAnalytics,
      },
    };

    try {
      // Direct Firestore write
      await setDoc(newDocRef, newAdmin);

      // Optimistically add to state for instant visibility on the page
      setAdminsList((prev) => {
        const without = prev.filter((a) => a.id !== newAdmin.id && a.phone !== newAdmin.phone);
        const updated = [...without, newAdmin];
        try {
          localStorage.setItem('ww_custom_admins', JSON.stringify(updated));
        } catch {}
        return updated;
      });

      setActionNotice({
        message: `አስተዳዳሪ "${newAdmin.nameAm}" በትክክለኛ የይለፍ ቃል በተሳካ ሁኔታ ተመዝግቧል! (Admin saved successfully)`,
        type: 'success',
      });
      setTimeout(() => setActionNotice(null), 5000);
      setIsAddModalOpen(false);

      // Reset form
      setNewAdminName('');
      setNewAdminPhone('');
      setNewAdminPassword('');
      setNewAdminRole('admin');
      setNewAdminTelegramId('');
      setCustomRoleTitle('የትምህርት ክፍል አስተባባሪ');
      setPermSchedule(false);
      setPermMembers(false);
      setPermAttendance(true);
      setPermSupport(false);
      setPermAdmins(false);
      setPermAnalytics(false);
      setPermBroadcast(false);
    } catch (err: any) {
      console.error('Failed to create admin:', err);
      setActionNotice({
        message: 'አስተዳዳሪውን ማስቀመጥ አልተቻለም። እባክዎ እንደገና ይሞክሩ።',
        type: 'error',
      });
      setTimeout(() => setActionNotice(null), 5000);
    }
  };

  const handleUpdateAdminProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;

    try {
      const permsToSave = {
        ...editingAdmin.permissions,
        takeAttendance: editingAdmin.permissions.canAccessAttendance,
        approveStudents: editingAdmin.permissions.canAccessMembers,
        manageSupport: editingAdmin.permissions.canAccessSupport,
        exportReports: editingAdmin.permissions.canAccessAnalytics,
      };

      const updatedToSave = {
        ...editingAdmin,
        permissions: permsToSave,
      };

      await setDoc(doc(db, 'admins', editingAdmin.id), updatedToSave, { merge: true });

      setAdminsList((prev) =>
        prev.map((adm) => (adm.id === editingAdmin.id ? updatedToSave : adm))
      );

      setActionNotice({
        message: `የ"${editingAdmin.nameAm}" መረጃና ፈቃዶች በተሳካ ሁኔታ ተስተካክሏል!`,
        type: 'success',
      });
      setTimeout(() => setActionNotice(null), 5000);
      setEditingAdmin(null);
    } catch (err: any) {
      console.error('Failed to update admin:', err);
      setActionNotice({
        message: 'የአስተዳዳሪውን መረጃ ማስተካከል አልተሳካም።',
        type: 'error',
      });
      setTimeout(() => setActionNotice(null), 5000);
    }
  };

  const handleTogglePermission = async (adminId: string, permKey: keyof AdminPermission) => {
    const target = adminsList.find((a) => a.id === adminId);
    if (!target || target.role === 'super_admin') return;

    const currentPerms: AdminPermission = {
      canAccessSchedule: Boolean(target.permissions?.canAccessSchedule),
      canAccessMembers: Boolean(target.permissions?.canAccessMembers ?? target.permissions?.approveStudents),
      canAccessAttendance: Boolean(target.permissions?.canAccessAttendance ?? target.permissions?.takeAttendance),
      canAccessSupport: Boolean(target.permissions?.canAccessSupport ?? target.permissions?.manageSupport),
      canAccessAdmins: Boolean(target.permissions?.canAccessAdmins),
      canAccessAnalytics: Boolean(target.permissions?.canAccessAnalytics ?? target.permissions?.exportReports),
      canBroadcast: Boolean(target.permissions?.canBroadcast),
    };

    const newPerms: AdminPermission = {
      ...currentPerms,
      [permKey]: !currentPerms[permKey],
    };

    newPerms.takeAttendance = newPerms.canAccessAttendance;
    newPerms.approveStudents = newPerms.canAccessMembers;
    newPerms.manageSupport = newPerms.canAccessSupport;
    newPerms.exportReports = newPerms.canAccessAnalytics;

    setAdminsList((prev) =>
      prev.map((a) => (a.id === adminId ? { ...a, permissions: newPerms } : a))
    );

    try {
      await setDoc(doc(db, 'admins', adminId), { permissions: newPerms }, { merge: true });
    } catch (err) {
      console.error('Failed to toggle permission:', err);
    }
  };

  const handleToggleStatus = async (adminId: string) => {
    const target = adminsList.find((a) => a.id === adminId);
    if (!target || target.role === 'super_admin') return;

    const nextStatus = target.status === 'suspended' ? 'active' : 'suspended';
    setAdminsList((prev) =>
      prev.map((a) => (a.id === adminId ? { ...a, status: nextStatus } : a))
    );

    try {
      await updateDoc(doc(db, 'admins', adminId), { status: nextStatus });
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const handleDeleteAdmin = async (adminId: string) => {
    const target = adminsList.find((a) => a.id === adminId);
    if (!target) return;

    if (confirm(`"${target.nameAm}" የተባሉትን አገልጋይ ከሲስተሙ ሙሉ በሙሉ መሰረዝ ይፈልጋሉ?`)) {
      setAdminsList((prev) => prev.filter((a) => a.id !== adminId));
      try {
        await deleteDoc(doc(db, 'admins', adminId));
        setActionNotice({
          message: `አስተዳዳሪው ከሲስተሙ ተሰርዟል።`,
          type: 'success',
        });
        setTimeout(() => setActionNotice(null), 3000);
      } catch (err) {
        console.error('Failed to delete admin:', err);
      }
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
            <span>የአስተዳዳሪዎች ማኔጅመንት እና ፈቃድ መስጫ ({visibleAdmins.length})</span>
          </h2>
          <p className="text-sm text-emerald-200/70 mt-1">
            የሰንበት ትምህርት ቤቱን አገልጋዮች መመደብ፣ ሚና መስጠት (Admin / Super Admin)፣ የይለፍ ቃል ማስተካከል እና የሲስተም ፈቃዶች
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setSelectedAdminForPassword(null);
              setIsPasswordModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs shadow-lg transition-all cursor-pointer shrink-0"
          >
            <KeyRound className="w-4 h-4" />
            <span>የይለፍ ቃል ቀይር (Change Password)</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>አዲስ አስተዳዳሪ ጨምር</span>
          </button>
        </div>
      </div>

      {/* Action Notice */}
      {actionNotice && (
        <div
          className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs border animate-in fade-in slide-in-from-top-1 ${
            actionNotice.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 shrink-0 text-amber-400" />
            <span className="font-medium">{actionNotice.message}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-white/60 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Admins Table */}
      <div className="bg-[#09351c]/90 backdrop-blur-md border border-[#0f4425] rounded-3xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#062414] border-b border-[#0f4425] text-emerald-200 font-semibold">
                <th className="py-3 px-4">አስተዳዳሪ (Admin)</th>
                <th className="py-3 px-4">ሚና (Role) & ስልክ</th>
                <th className="py-3 px-4">ሁኔታ (Status)</th>
                <th className="py-3 px-3 text-center">መርሐ ግብር</th>
                <th className="py-3 px-3 text-center">ተማሪዎች</th>
                <th className="py-3 px-3 text-center">QR ክትትል</th>
                <th className="py-3 px-3 text-center">ድጋፍ</th>
                <th className="py-3 px-3 text-center">አድሚኖች</th>
                <th className="py-3 px-3 text-center">ሪፖርት</th>
                <th className="py-3 px-3 text-center">ማስታወቂያ</th>
                <th className="py-3 px-4 text-right">እርምጃዎች</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0f4425]/60">
              {visibleAdmins.map((adm) => {
                const isSuper = adm.role === 'super_admin';
                const isSuspended = adm.status === 'suspended';

                const isTargetSuper = adm.role === 'super_admin';
                const admPhoneDigits = adm.phone.replace(/\D/g, '').slice(-9);
                
                const currentPhoneDigits = currentAdmin.phone?.replace(/\D/g, '').slice(-9);
                const isCurrentAdminThisTarget = 
                  adm.id === currentAdmin.id || 
                  (Boolean(currentPhoneDigits && admPhoneDigits) && admPhoneDigits === currentPhoneDigits);

                // IMPORTANT: Super admins CANNOT change each other's passwords!
                // They can change their OWN password and regular admins' passwords only.
                const canChangeThisPassword = isCurrentAdminThisTarget || (!isTargetSuper && isSuperAdmin);

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
                      <div className="font-mono text-emerald-200 font-bold">{adm.phone}</div>
                      <div className="text-[11px] text-slate-300 flex items-center gap-1.5 mt-0.5">
                        <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="font-mono tracking-widest text-slate-400">••••••••</span>
                        {canChangeThisPassword ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAdminForPassword(adm);
                              setIsPasswordModalOpen(true);
                            }}
                            className="text-amber-400/80 hover:text-amber-300 p-0.5 transition-colors cursor-pointer ml-1"
                            title="የይለፍ ቃል ቀይር (Change password)"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-emerald-300/40 ml-1 font-sans italic" title="የሌላ ዋና አስተዳዳሪን የይለፍ ቃል መቀየር አይቻልም">
                            (የተጠበቀ)
                          </span>
                        )}
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

                    {/* Nav Permissions Toggles */}
                    <td className="py-3 px-4 text-center">
                      <button
                        disabled={isSuper}
                        onClick={() => handleTogglePermission(adm.id, 'canAccessSchedule')}
                        className={`p-1.5 rounded-lg transition-colors ${
                          adm.permissions?.canAccessSchedule
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-[#062414] text-slate-500 border border-[#0f4425]'
                        } ${isSuper ? 'opacity-80 cursor-default' : 'hover:scale-105 cursor-pointer'}`}
                        title="መርሐ ግብር ፈቃድ"
                      >
                        {adm.permissions?.canAccessSchedule ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      </button>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        disabled={isSuper}
                        onClick={() => handleTogglePermission(adm.id, 'canAccessMembers')}
                        className={`p-1.5 rounded-lg transition-colors ${
                          adm.permissions?.canAccessMembers
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-[#062414] text-slate-500 border border-[#0f4425]'
                        } ${isSuper ? 'opacity-80 cursor-default' : 'hover:scale-105 cursor-pointer'}`}
                        title="ተማሪዎች ፈቃድ"
                      >
                        {adm.permissions?.canAccessMembers ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      </button>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        disabled={isSuper}
                        onClick={() => handleTogglePermission(adm.id, 'canAccessAttendance')}
                        className={`p-1.5 rounded-lg transition-colors ${
                          adm.permissions?.canAccessAttendance
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-[#062414] text-slate-500 border border-[#0f4425]'
                        } ${isSuper ? 'opacity-80 cursor-default' : 'hover:scale-105 cursor-pointer'}`}
                        title="QR ክትትል ፈቃድ"
                      >
                        {adm.permissions?.canAccessAttendance ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      </button>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        disabled={isSuper}
                        onClick={() => handleTogglePermission(adm.id, 'canAccessSupport')}
                        className={`p-1.5 rounded-lg transition-colors ${
                          adm.permissions?.canAccessSupport
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-[#062414] text-slate-500 border border-[#0f4425]'
                        } ${isSuper ? 'opacity-80 cursor-default' : 'hover:scale-105 cursor-pointer'}`}
                        title="ድጋፍ እና ፈቃድ ፈቃድ"
                      >
                        {adm.permissions?.canAccessSupport ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      </button>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        disabled={isSuper}
                        onClick={() => handleTogglePermission(adm.id, 'canAccessAdmins')}
                        className={`p-1.5 rounded-lg transition-colors ${
                          adm.permissions?.canAccessAdmins
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-[#062414] text-slate-500 border border-[#0f4425]'
                        } ${isSuper ? 'opacity-80 cursor-default' : 'hover:scale-105 cursor-pointer'}`}
                        title="አድሚኖች ማኔጅመንት ፈቃድ"
                      >
                        {adm.permissions?.canAccessAdmins ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      </button>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        disabled={isSuper}
                        onClick={() => handleTogglePermission(adm.id, 'canAccessAnalytics')}
                        className={`p-1.5 rounded-lg transition-colors ${
                          adm.permissions?.canAccessAnalytics
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-[#062414] text-slate-500 border border-[#0f4425]'
                        } ${isSuper ? 'opacity-80 cursor-default' : 'hover:scale-105 cursor-pointer'}`}
                        title="ሪፖርት እና ትንተና ፈቃድ"
                      >
                        {adm.permissions?.canAccessAnalytics ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      </button>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <button
                        disabled={isSuper}
                        onClick={() => handleTogglePermission(adm.id, 'canBroadcast')}
                        className={`p-1.5 rounded-lg transition-colors ${
                          adm.permissions?.canBroadcast
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-[#062414] text-slate-500 border border-[#0f4425]'
                        } ${isSuper ? 'opacity-80 cursor-default' : 'hover:scale-105 cursor-pointer'}`}
                        title="ማስታወቂያ መላክ ፈቃድ"
                      >
                        {adm.permissions?.canBroadcast ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      </button>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canChangeThisPassword && (
                          <button
                            onClick={() => {
                              setSelectedAdminForPassword(adm);
                              setIsPasswordModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-amber-400 hover:bg-amber-950/60 transition-colors cursor-pointer"
                            title="የይለፍ ቃል ቀይር (Change Password)"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                        )}

                        {!isSuper && (
                          <>
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
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibleAdmins.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <p className="text-sm font-semibold">ምንም የተመዘገበ አድሚን አልተገኘም።</p>
                    <p className="text-xs text-slate-500 mt-1">አዲስ አድሚን ለመመዝገብ ከላይ "አዲስ አስተዳዳሪ ጨምር" የሚለውን ይጫኑ።</p>
                  </td>
                </tr>
              )}
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
                  የተፈቀዱ የናቪጌሽን ባር ሜኑዎች (Allowed Nav Tabs)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-[#062414] p-3 rounded-xl border border-[#0f4425]">
                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permSchedule}
                      onChange={(e) => setPermSchedule(e.target.checked)}
                      className="rounded text-amber-500 bg-[#09351c] border-[#0f4425]"
                    />
                    <span>መርሐ ግብር</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permMembers}
                      onChange={(e) => setPermMembers(e.target.checked)}
                      className="rounded text-amber-500 bg-[#09351c] border-[#0f4425]"
                    />
                    <span>ተማሪዎች</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permAttendance}
                      onChange={(e) => setPermAttendance(e.target.checked)}
                      className="rounded text-amber-500 bg-[#09351c] border-[#0f4425]"
                    />
                    <span>QR ክትትል</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permSupport}
                      onChange={(e) => setPermSupport(e.target.checked)}
                      className="rounded text-amber-500 bg-[#09351c] border-[#0f4425]"
                    />
                    <span>ድጋፍና ፈቃድ</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permAdmins}
                      onChange={(e) => setPermAdmins(e.target.checked)}
                      className="rounded text-amber-500 bg-[#09351c] border-[#0f4425]"
                    />
                    <span>አድሚኖች ማኔጅመንት</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permAnalytics}
                      onChange={(e) => setPermAnalytics(e.target.checked)}
                      className="rounded text-amber-500 bg-[#09351c] border-[#0f4425]"
                    />
                    <span>ሪፖርትና ትንተና</span>
                  </label>

                  <label className="flex items-center gap-2 text-amber-300 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permBroadcast}
                      onChange={(e) => setPermBroadcast(e.target.checked)}
                      className="rounded text-amber-500 bg-[#09351c] border-[#0f4425]"
                    />
                    <span className="flex items-center gap-1">
                      <Megaphone className="w-3.5 h-3.5 text-amber-400" />
                      <span>ማስታወቂያ መላክ (Broadcast)</span>
                    </span>
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

              {/* Edit Permissions Checklist */}
              <div>
                <label className="block text-emerald-100 font-semibold mb-2">
                  የተፈቀዱ የናቪጌሽን ባር ሜኑዎች (Allowed Nav Tabs)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-[#062414] p-3 rounded-xl border border-[#0f4425]">
                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingAdmin.permissions?.canAccessSchedule ?? true}
                      onChange={(e) => setEditingAdmin({
                        ...editingAdmin,
                        permissions: { ...(editingAdmin.permissions || {}), canAccessSchedule: e.target.checked } as any
                      })}
                      className="rounded text-amber-500 bg-[#09351c] border-[#0f4425]"
                    />
                    <span>መርሐ ግብር</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingAdmin.permissions?.canAccessMembers ?? true}
                      onChange={(e) => setEditingAdmin({
                        ...editingAdmin,
                        permissions: { ...(editingAdmin.permissions || {}), canAccessMembers: e.target.checked } as any
                      })}
                      className="rounded text-amber-500 bg-[#09351c] border-[#0f4425]"
                    />
                    <span>ተማሪዎች</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingAdmin.permissions?.canAccessAttendance ?? true}
                      onChange={(e) => setEditingAdmin({
                        ...editingAdmin,
                        permissions: { ...(editingAdmin.permissions || {}), canAccessAttendance: e.target.checked } as any
                      })}
                      className="rounded text-amber-500 bg-[#09351c] border-[#0f4425]"
                    />
                    <span>QR ክትትል</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingAdmin.permissions?.canAccessSupport ?? true}
                      onChange={(e) => setEditingAdmin({
                        ...editingAdmin,
                        permissions: { ...(editingAdmin.permissions || {}), canAccessSupport: e.target.checked } as any
                      })}
                      className="rounded text-amber-500 bg-[#09351c] border-[#0f4425]"
                    />
                    <span>ድጋፍና ፈቃድ</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingAdmin.permissions?.canAccessAdmins ?? false}
                      onChange={(e) => setEditingAdmin({
                        ...editingAdmin,
                        permissions: { ...(editingAdmin.permissions || {}), canAccessAdmins: e.target.checked } as any
                      })}
                      className="rounded text-amber-500 bg-[#09351c] border-[#0f4425]"
                    />
                    <span>አድሚኖች ማኔጅመንት</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingAdmin.permissions?.canAccessAnalytics ?? false}
                      onChange={(e) => setEditingAdmin({
                        ...editingAdmin,
                        permissions: { ...(editingAdmin.permissions || {}), canAccessAnalytics: e.target.checked } as any
                      })}
                      className="rounded text-amber-500 bg-[#09351c] border-[#0f4425]"
                    />
                    <span>ሪፖርትና ትንተና</span>
                  </label>

                  <label className="flex items-center gap-2 text-amber-300 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingAdmin.permissions?.canBroadcast ?? false}
                      onChange={(e) => setEditingAdmin({
                        ...editingAdmin,
                        permissions: { ...(editingAdmin.permissions || {}), canBroadcast: e.target.checked } as any
                      })}
                      className="rounded text-amber-500 bg-[#09351c] border-[#0f4425]"
                    />
                    <span className="flex items-center gap-1">
                      <Megaphone className="w-3.5 h-3.5 text-amber-400" />
                      <span>ማስታወቂያ መላክ (Broadcast)</span>
                    </span>
                  </label>
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

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => {
          setIsPasswordModalOpen(false);
          setSelectedAdminForPassword(null);
        }}
        currentAdmin={currentAdmin}
        targetAdmin={selectedAdminForPassword}
        onPasswordChanged={(adminId, newPass) => {
          const selectedPhone = selectedAdminForPassword?.phone?.replace(/\D/g, '').slice(-9);
          setAdminsList((prev) =>
            prev.map((a) => {
              const aPhone = (a.phone || '').replace(/\D/g, '').slice(-9);
              if (a.id === adminId || (selectedPhone && aPhone === selectedPhone)) {
                return { ...a, password: newPass };
              }
              return a;
            })
          );
          setActionNotice({
            message: 'የይለፍ ቃል በተሳካ ሁኔታ ተቀይሯል! (Password updated successfully)',
            type: 'success',
          });
          setTimeout(() => setActionNotice(null), 5000);
        }}
      />
    </div>
  );
};
