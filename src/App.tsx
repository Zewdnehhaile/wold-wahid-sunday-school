import React, { useState, useEffect } from 'react';
import { Member, AttendanceRecord, SupportTicket, LeaveRequest, ServiceSession, Language, SupportStatus, AdminUser } from './types';
import {
  INITIAL_SESSIONS,
  INITIAL_ADMINS,
  FITHAPOL_LOGO,
  AVATAR_MALE,
  AVATAR_FEMALE,
} from './data/initialData';
import { db, collection, doc, getDoc, addDoc, updateDoc, deleteDoc, getDocs, query, where, setDoc, limit } from './firebase';
import { t } from './utils/translations';
import { getPhotoUrl } from './utils/photoUtils';
import { MemberList } from './components/MemberList';
import { StudentPortalView } from './components/StudentPortalView';
import { AttendanceScanner } from './components/AttendanceScanner';
import { SupportDesk } from './components/SupportDesk';
import { AnalyticsView } from './components/AnalyticsView';
import { TelegramSimulator } from './components/TelegramSimulator';
import { IdCardStudio } from './components/IdCardStudio';
import { ScheduleView } from './components/ScheduleView';
import { AdminManagement } from './components/AdminManagement';
import { LoginPage } from './components/LoginPage';
import { ApkDownloadPage } from './components/ApkDownloadPage';
import { NotificationModal } from './components/NotificationModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import {
  sendLeaveDecisionTelegram,
  sendRegistrationApprovalTelegram,
  sendSupportReplyTelegram,
  sendTelegramMessage,
} from './utils/telegram';
import {
  Calendar,
  Users,
  QrCode,
  HeartHandshake,
  BarChart3,
  Smartphone,
  Globe,
  Printer,
  ChevronRight,
  ShieldCheck,
  FolderArchive,
  LogOut,
  Send,
  Megaphone,
  Bell,
  CheckCircle2,
  X,
  KeyRound,
} from 'lucide-react';

export default function App() {
  const [lang, setLang] = useState<Language>('am');
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [approvalBanner, setApprovalBanner] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleSnapshotError = (name: string) => (error: any) => {
    const isQuota =
      error?.message?.includes('Quota limit exceeded') ||
      error?.code === 'resource-exhausted' ||
      error?.message?.includes('quota');
    if (isQuota) {
      console.warn(`${name} cache fallback active.`, error?.message || error);
    } else {
      console.error(`${name} data error:`, error);
    }
  };

  const isTelegramContext = typeof window !== 'undefined' && (
    Boolean((window as any).Telegram?.WebApp?.initData) ||
    window.location.hash.includes('tgWebAppData') ||
    window.location.search.includes('tgWebApp') ||
    window.location.search.includes('student') ||
    window.location.search.includes('tgWebAppStartParam') ||
    window.location.search.includes('woldwahidsundayschool') ||
    /Telegram/i.test(navigator.userAgent)
  );
  const [hasEnteredApp, setHasEnteredApp] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('members');
  const [showStudentPortal, setShowStudentPortal] = useState(false);

  // Live Firestore state with fallback cache for quota limits
  const [registrations, setRegistrations] = useState<Member[]>(() => {
    try { return JSON.parse(localStorage.getItem('ww_registrations_cache') || '[]'); } catch { return []; }
  });
  const [students, setStudents] = useState<Member[]>(() => {
    try { return JSON.parse(localStorage.getItem('ww_students_cache') || '[]'); } catch { return []; }
  });
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => {
    try { return JSON.parse(localStorage.getItem('ww_attendance_cache') || '[]'); } catch { return []; }
  });
  const [tickets, setTickets] = useState<SupportTicket[]>(() => {
    try { return JSON.parse(localStorage.getItem('ww_tickets_cache') || '[]'); } catch { return []; }
  });
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => {
    try { return JSON.parse(localStorage.getItem('ww_leave_cache') || '[]'); } catch { return []; }
  });

  const [sessions] = useState<ServiceSession[]>(INITIAL_SESSIONS);
  const [activeSession, setActiveSession] = useState<ServiceSession>(INITIAL_SESSIONS[0]);

  // Role-Based Access Control: Admin state loaded from authenticated Firestore session
  const [admins] = useState<AdminUser[]>(INITIAL_ADMINS);
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser>({
    id: '',
    nameAm: 'አስተዳዳሪ',
    nameEn: 'Admin',
    role: 'admin',
    department: 'education',
  });

  // Card Studio state
  const [isCardStudioOpen, setIsCardStudioOpen] = useState(false);
  const [studioTargetMember, setStudioTargetMember] = useState<Member | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async (force = false) => {
    if (isRefreshing && !force) return;
    if (!force) {
      try {
        const lastFetch = Number(localStorage.getItem('ww_last_fetch_at') || '0');
        const hasCache = registrations.length > 0 || students.length > 0;
        if (hasCache && Date.now() - lastFetch < 2 * 60 * 1000) {
          return;
        }
      } catch {}
    }
    setIsRefreshing(true);
    try {
      // 1. Fetch registrations
      const regSnap = await getDocs(query(collection(db, 'registrations'), limit(200)));
      const regList: Member[] = regSnap.docs
        .filter((docSnap: any) => docSnap.data()?.status !== 'deleted')
        .map((docSnap: any) => {
          const d = docSnap.data();
          const isApproved = d.status === 'approved' || d.status === 'active';
          const isRejected = d.status === 'rejected';
          return {
            id: docSnap.id,
            code: d.studentCode || d.code || `PENDING-${d.telegramId ? String(d.telegramId).slice(-4) : docSnap.id.slice(0, 4)}`,
            fullNameAm: d.fullNameAm || d.fullNameEn || d.nameAm || 'ያልተገለጸ ስም',
            fullNameEn: d.fullNameEn || d.fullNameAm || d.nameEn || 'Unnamed Student',
            phone: d.phone || '',
            gender: d.gender === 'female' ? 'female' : 'male',
            department: d.department || 'education',
            gradeLevel: d.gradeLevel || 'general',
            roleAm: 'ተማሪ / Student',
            roleEn: 'Student',
            christianName: d.christianName || '',
            birthYear: d.birthYear || d.birthDate || '',
            photoUrl: getPhotoUrl(d.photoUrl, d.gender === 'female' ? 'female' : 'male'),
            registeredDate: d.submittedAt?.split('T')[0] || new Date().toISOString().split('T')[0],
            bloodGroup: d.bloodGroup || 'O+',
            emergencyContact: d.emergencyContact || { 
              name: d.emergencyName || '', 
              phone: d.emergencyPhone || '', 
              relation: d.emergencyRelation || 'ቤተሰብ / Family' 
            },
            subcity: d.subcity || d.address || '',
            status: isApproved ? 'active' : (isRejected ? 'rejected' : 'pending_approval'),
            telegramId: d.telegramId || '',
            telegramUsername: d.telegramUsername || '',
            approvedBy: d.approvedBy,
            approvedAt: d.approvedAt,
            rejectedBy: d.rejectedBy,
            rejectedAt: d.rejectedAt,
            rejectionReason: d.rejectionReason,
            consecutiveAbsences: 0,
          };
        });
      setRegistrations(regList);
      localStorage.setItem('ww_registrations_cache', JSON.stringify(regList));

      // 2. Fetch students
      const studSnap = await getDocs(query(collection(db, 'students'), limit(500)));
      const studentList: Member[] = studSnap.docs
        .filter((docSnap: any) => docSnap.data()?.status !== 'deleted')
        .map((docSnap: any) => {
          const d = docSnap.data();
          const isPending = d.status === 'pending_approval' || d.status === 'pending';
          return {
            id: docSnap.id,
            code: d.code || d.studentCode || 'WW-2026-0001',
            fullNameAm: d.fullNameAm || d.fullNameEn || '',
            fullNameEn: d.fullNameEn || d.fullNameAm || '',
            christianName: d.christianName || '',
            birthYear: d.birthYear || d.birthDate || '',
            phone: d.phone || '',
            gender: d.gender === 'female' ? 'female' : 'male',
            department: d.department || 'education',
            gradeLevel: d.gradeLevel || 'general',
            roleAm: 'ተማሪ / Student',
            roleEn: 'Student',
            photoUrl: getPhotoUrl(d.photoUrl, d.gender === 'female' ? 'female' : 'male'),
            registeredDate: d.registeredDate || new Date().toISOString().split('T')[0],
            bloodGroup: d.bloodGroup || 'O+',
            emergencyContact: d.emergencyContact || { 
              name: d.emergencyName || '', 
              phone: d.emergencyPhone || '', 
              relation: d.emergencyRelation || 'ቤተሰብ / Family' 
            },
            subcity: d.subcity || d.address || '',
            status: isPending ? 'pending_approval' : (d.status === 'rejected' ? 'rejected' : 'active'),
            telegramId: d.telegramId || '',
            telegramUsername: d.telegramUsername || '',
            approvedBy: d.approvedBy,
            approvedAt: d.approvedAt,
            rejectedBy: d.rejectedBy,
            rejectedAt: d.rejectedAt,
            rejectionReason: d.rejectionReason,
            consecutiveAbsences: d.consecutiveAbsences || 0,
          };
        });
      setStudents(studentList);
      localStorage.setItem('ww_students_cache', JSON.stringify(studentList));

      // 3. Fetch tickets
      const ticketSnap = await getDocs(query(collection(db, 'support_tickets'), limit(50)));
      const ticketList: SupportTicket[] = ticketSnap.docs.map((docSnap: any) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          ticketNumber: d.ticketNumber || `WW-SPT-${docSnap.id.slice(0, 4)}`,
          requesterName: d.requesterName || d.studentName || 'Sunday School Member',
          phone: d.phone || '',
          category: d.category || 'general',
          title: d.title || d.category || 'Support Request',
          description: d.description || d.message || '',
          priority: d.priority || 'medium',
          status: d.status || 'new',
          createdAt: d.createdAt || new Date().toISOString(),
          updatedAt: d.updatedAt || new Date().toISOString(),
          isConfidential: !!d.isConfidential,
          notes: d.notes || [],
        };
      });
      setTickets(ticketList);
      localStorage.setItem('ww_tickets_cache', JSON.stringify(ticketList));

      // 4. Fetch attendance (Last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const dateStr = sevenDaysAgo.toISOString().split('T')[0];
      const attSnap = await getDocs(query(collection(db, 'attendance'), where('date', '>=', dateStr), limit(300)));
      const attList: AttendanceRecord[] = attSnap.docs.map((docSnap: any) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          memberId: d.memberId || d.studentId || '',
          memberNameAm: d.memberNameAm || d.fullNameAm || 'Student',
          memberNameEn: d.memberNameEn || d.fullNameEn || 'Student',
          memberCode: d.memberCode || d.studentCode || '',
          department: d.department || d.departmentResponsible || 'education',
          sessionName: d.sessionName || 'Sunday School Session',
          timestamp: d.timestamp || '',
          date: d.date || '',
          method: d.method || 'qr',
          status: d.status || 'present',
        };
      });
      setAttendance(attList);
      localStorage.setItem('ww_attendance_cache', JSON.stringify(attList));

      // 5. Fetch leave requests
      const leaveSnap = await getDocs(query(collection(db, 'leave_requests'), limit(50)));
      const leaveList: LeaveRequest[] = leaveSnap.docs.map((docSnap: any) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          requestNumber: d.requestNumber || `LV-${docSnap.id.slice(0, 4)}`,
          studentName: d.studentName || d.fullNameAm || 'Student',
          telegramId: d.telegramId,
          leaveType: d.leaveType || 'ፈቃድ',
          duration: d.duration || 'N/A',
          reason: d.reason || '',
          status: d.status || 'pending',
          createdAt: d.submittedAt || new Date().toISOString(),
        };
      });
      setLeaveRequests(leaveList);
      localStorage.setItem('ww_leave_cache', JSON.stringify(leaveList));
      
      // 6. Check recent notifications once (avoids persistent onSnapshot quota burn)
      try {
        const notifSnap = await getDocs(query(collection(db, 'notifications'), limit(5)));
        notifSnap.docs.forEach((docSnap: any) => {
          const data = docSnap.data();
          const diffMs = Math.abs(Date.now() - new Date(data.createdAt || Date.now()).getTime());
          if (diffMs < 2 * 60 * 1000) {
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              new Notification(data.title || 'ወልደ ዋሕድ ሰንበት ት/ቤት', {
                body: data.message,
                icon: '/assets/aistudio/photo_2026-10-22_10-46-07__2__5dd80c37.jpg',
              });
            }
          }
        });
      } catch {}

      try {
        localStorage.setItem('ww_last_fetch_at', String(Date.now()));
      } catch {}
    } catch (error: any) {
      handleSnapshotError('Data Load')(error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn && !showStudentPortal) return;
    loadData();
  }, [isLoggedIn, showStudentPortal]);

  // Security Protection: Disable right-click & inspect unless Super Admin
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if (!isLoggedIn || currentAdmin.role !== 'super_admin') {
        e.preventDefault();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isLoggedIn || currentAdmin.role !== 'super_admin') {
        if (
          e.key === 'F12' ||
          (e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'i', 'j', 'c'].includes(e.key)) ||
          (e.ctrlKey && ['u', 'U'].includes(e.key))
        ) {
          e.preventDefault();
        }
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLoggedIn, currentAdmin.role]);

  // Deduplicate and combine approved students + pending applications
  const activeStudents = students.filter((s) => s.status === 'active');
  const activeRegistrations = registrations.filter((r) => r.status === 'active');
  const pendingRegistrations = registrations.filter((r) => r.status === 'pending_approval');
  const pendingStudents = students.filter((s) => s.status === 'pending_approval');
  const rejectedRegistrations = registrations.filter((r) => r.status === 'rejected');
  const rejectedStudents = students.filter((s) => s.status === 'rejected');

  // Combined approved members without duplicates
  const approvedList = [
    ...activeStudents,
    ...activeRegistrations.filter((r) => !activeStudents.some((s) => s.code === r.code || (s.phone && r.phone && s.phone === r.phone))),
  ];

  // Combined pending queue
  const pendingList = [
    ...pendingRegistrations,
    ...pendingStudents.filter((s) => !pendingRegistrations.some((r) => r.id === s.id)),
  ];

  // Combined rejected queue
  const rejectedList = [
    ...rejectedRegistrations,
    ...rejectedStudents.filter((r) => !rejectedRegistrations.some((s) => s.id === r.id)),
  ];

  const members = [...approvedList, ...pendingList, ...rejectedList];
  const pendingCount = pendingList.length;

  // Counter for new support tickets (matches SupportDesk 'አዲስ' count exactly)
  const newSupportTicketsCount = tickets.filter((t) => t.status === 'new').length;

  const dict = t[lang];

  // Granular Nav Tab Permissions based on current admin's role and permission checkboxes
  const isSuperAdmin = currentAdmin.role === 'super_admin';
  const perms = (currentAdmin.permissions || {}) as any;

  const canSchedule = isSuperAdmin || Boolean(perms.canAccessSchedule);
  const canMembers = isSuperAdmin || Boolean(perms.canAccessMembers ?? perms.approveStudents);
  const canAttendance = isSuperAdmin || Boolean(perms.canAccessAttendance ?? perms.takeAttendance);
  const canSupport = isSuperAdmin || Boolean(perms.canAccessSupport ?? perms.manageSupport);
  const canAdmins = isSuperAdmin || Boolean(perms.canAccessAdmins);
  const canAnalytics = isSuperAdmin || Boolean(perms.canAccessAnalytics ?? perms.exportReports);
  const canBroadcast = isSuperAdmin || Boolean(perms.canBroadcast);

  const allowedNavTabs = [
    { id: 'schedule', label: dict.nav.schedule, mobileLabel: 'መርሐ ግብር', icon: Calendar, allowed: canSchedule },
    { id: 'members', label: dict.nav.members, mobileLabel: 'ተማሪዎች', icon: Users, count: pendingCount, allowed: canMembers },
    { id: 'attendance', label: dict.nav.attendance, mobileLabel: 'መገኘት', icon: QrCode, allowed: canAttendance },
    { id: 'support', label: dict.nav.support, mobileLabel: 'ድጋፍ', icon: HeartHandshake, count: newSupportTicketsCount, allowed: canSupport },
    { id: 'admins', label: dict.nav.admins, mobileLabel: 'አድሚኖች', icon: ShieldCheck, allowed: canAdmins },
    { id: 'analytics', label: dict.nav.analytics, mobileLabel: 'ሪፖርት', icon: BarChart3, allowed: canAnalytics },
  ].filter((t) => t.allowed);

  // Auto-redirect if active tab is revoked or not allowed
  useEffect(() => {
    if (isLoggedIn && allowedNavTabs.length > 0) {
      if (!allowedNavTabs.some((t) => t.id === activeTab)) {
        setActiveTab(allowedNavTabs[0].id);
      }
    }
  }, [isLoggedIn, activeTab, allowedNavTabs]);

  // Load logged-in admin permissions from Firestore once on login
  useEffect(() => {
    if (!isLoggedIn || !currentAdmin.id) return;
    let active = true;
    getDoc(doc(db, 'admins', currentAdmin.id))
      .then((snap) => {
        if (!active || !snap.exists()) return;
        const d = snap.data();
        if (d.status === 'suspended') {
          setIsLoggedIn(false);
          return;
        }
        if (d.permissions) {
          setCurrentAdmin((prev) => ({
            ...prev,
            permissions: d.permissions,
            role: d.role || prev.role,
            customRoleTitle: d.customRoleTitle || prev.customRoleTitle,
          }));
        }
      })
      .catch(handleSnapshotError('Admin session'));
    return () => {
      active = false;
    };
  }, [isLoggedIn, currentAdmin.id]);
  const handleAddMember = async (newMember: Member) => {
    try {
      await addDoc(collection(db, 'students'), {
        code: newMember.code,
        fullNameAm: newMember.fullNameAm,
        fullNameEn: newMember.fullNameEn,
        phone: newMember.phone,
        gender: newMember.gender,
        department: newMember.department,
        gradeLevel: newMember.gradeLevel || 'general',
        status: 'active',
        registeredDate: new Date().toISOString().split('T')[0],
      });
    } catch (e) {
      console.error('Error adding member to Firestore:', e);
    }
  };

  const handleApproveMember = async (memberId: string, manualStudentId: string) => {
    try {
      const targetReg = registrations.find((r) => r.id === memberId) || students.find((s) => s.id === memberId);
      const studentName = targetReg?.fullNameAm || targetReg?.fullNameEn || 'ተማሪ';

      // 1. Update the registration document in Firestore
      const regRef = doc(db, 'registrations', memberId);
      await updateDoc(regRef, {
        status: 'approved',
        studentCode: manualStudentId,
        code: manualStudentId,
        approvedBy: currentAdmin.nameAm,
        approvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).catch((err) => {
        console.warn('Registration update notice:', err);
      });

      // 2. Add or update active student record in students collection using the SAME ID as registration
      const studentData = {
        code: manualStudentId,
        studentCode: manualStudentId,
        fullNameAm: targetReg?.fullNameAm || 'ተማሪ',
        fullNameEn: targetReg?.fullNameEn || 'Student',
        christianName: targetReg?.christianName || '',
        birthYear: targetReg?.birthYear || '',
        phone: targetReg?.phone || '',
        gender: targetReg?.gender || 'male',
        department: targetReg?.department || 'education',
        gradeLevel: targetReg?.gradeLevel || 'general',
        photoUrl: targetReg?.photoUrl || '',
        emergencyContact: targetReg?.emergencyContact || { name: '', phone: '', relation: '' },
        subcity: targetReg?.subcity || '',
        telegramId: targetReg?.telegramId || '',
        telegramUsername: targetReg?.telegramUsername || '',
        status: 'active',
        registeredDate: targetReg?.registeredDate || new Date().toISOString().split('T')[0],
        approvedBy: currentAdmin.nameAm,
        approvedAt: new Date().toISOString(),
        consecutiveAbsences: 0,
      };

      // Use setDoc with the same ID as the registration to ensure consistency
      await setDoc(doc(db, 'students', memberId), studentData);

      // 3. Dispatch Telegram approval directly to student
      let sentTg = false;
      if (targetReg?.telegramId) {
        try {
          const tgRes = await sendRegistrationApprovalTelegram({
            telegramId: targetReg.telegramId,
            studentName,
            studentCode: manualStudentId,
            approvedBy: currentAdmin.nameAm,
          });
          sentTg = tgRes.ok;
        } catch (tgErr) {
          console.warn('Direct Telegram registration approval notice:', tgErr);
        }
      }

      setApprovalBanner({
        message: sentTg
          ? `ተማሪ "${studentName}" በመታወቂያ ቁጥር "${manualStudentId}" ጸድቋል፤ ለተማሪው በቴሌግራም ተልኳል!`
          : `ተማሪ "${studentName}" በመታወቂያ ቁጥር "${manualStudentId}" በተሳካ ሁኔታ ጸድቋል!`,
        type: 'success',
      });
      setTimeout(() => setApprovalBanner(null), 7000);
    } catch (e) {
      console.error('Approval failed:', e);
      setApprovalBanner({
        message: 'ይቅርታ! ማጽደቅ አልተሳካም። እባክዎ እንደገና ይሞክሩ።',
        type: 'error',
      });
      setTimeout(() => setApprovalBanner(null), 7000);
    }
  };

  const handleRejectMember = async (memberId: string, reason?: string) => {
    try {
      const targetReg = registrations.find((r) => r.id === memberId) || students.find((s) => s.id === memberId);
      const studentName = targetReg?.fullNameAm || targetReg?.fullNameEn || 'ተማሪ';
      const rejectionReason = reason || 'የምዝገባ መስፈርቱን አላሟላም (Did not meet requirements)';

      await updateDoc(doc(db, 'registrations', memberId), {
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
        rejectedBy: currentAdmin.nameAm || currentAdmin.nameEn || 'አስተዳዳሪ',
        rejectionReason: rejectionReason,
      });

      // Also ensure all older registrations for this same user are marked rejected so no stale pending registration remains
      if (targetReg) {
        const tgId = targetReg.telegramId ? String(targetReg.telegramId) : '';
        const phone = (targetReg.phone || '').replace(/\D/g, '').slice(-9);
        registrations.forEach(async (r) => {
          if (r.id !== memberId) {
            const rTg = r.telegramId ? String(r.telegramId) : '';
            const rPhone = (r.phone || '').replace(/\D/g, '').slice(-9);
            if ((tgId && rTg === tgId) || (phone && rPhone && rPhone === phone)) {
              await updateDoc(doc(db, 'registrations', r.id), {
                status: 'rejected',
                rejectedAt: new Date().toISOString(),
                rejectedBy: currentAdmin.nameAm || currentAdmin.nameEn || 'አስተዳዳሪ',
                rejectionReason: rejectionReason,
              }).catch(() => {});
            }
          }
        });
      }

      // Remove from active students if exists
      await deleteDoc(doc(db, 'students', memberId)).catch(() => {});

      if (targetReg?.telegramId) {
        await sendTelegramMessage(
          targetReg.telegramId,
          `❌ *የምዝገባ ጥያቄዎ አልተቀበለም*\n` +
          `ውድ ${studentName}፡ በመካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን የወልደ ዋሕድ ሰ/ት/ቤት የቀረበው የምዝገባ ጥያቄ አልተቀበለም።\n\n` +
          `📌 *የውድቅ ምክንያት*፦ ${rejectionReason}\n` +
          `✍️ *ውድቅ ያደረገው*፦ ${currentAdmin.nameAm || 'አስተዳዳሪ'}\n\n` +
          `ለበለጠ መረጃ የሰንበት ት/ቤቱን አስተዳደር በአካል ያነጋግሩ።`,
          { parseMode: 'Markdown' }
        ).catch(console.warn);
      }

      setApprovalBanner({
        message: `ተማሪ "${studentName}" ውድቅ ተደርጓል (ምክንያት፡ ${rejectionReason})።`,
        type: 'error',
      });
      setTimeout(() => setApprovalBanner(null), 7000);
    } catch (e) {
      console.error('Rejection failed:', e);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    try {
      const targetMember = registrations.find((r) => r.id === memberId) || students.find((s) => s.id === memberId);
      
      // Optimistic UI updates
      setRegistrations((prev) => prev.filter((r) => r.id !== memberId));
      setStudents((prev) => prev.filter((s) => s.id !== memberId));

      // 1. Direct doc deletion from both collections
      await deleteDoc(doc(db, 'registrations', memberId)).catch(() => {});
      await deleteDoc(doc(db, 'students', memberId)).catch(() => {});

      // 2. Cascade delete any associated registration/student entries by phone, telegramId, code, or name
      if (targetMember) {
        const targetPhone = (targetMember.phone || '').replace(/\D/g, '').slice(-9);
        const targetTgId = targetMember.telegramId ? String(targetMember.telegramId) : '';
        const targetName = targetMember.fullNameAm || targetMember.fullNameEn || '';

        // Clean matching registrations
        const regSnap = await getDocs(collection(db, 'registrations')).catch(() => null);
        if (regSnap && regSnap.docs) {
          for (const regDoc of regSnap.docs) {
            const d = regDoc.data();
            const rPhone = (d.phone || '').replace(/\D/g, '').slice(-9);
            const rTgId = d.telegramId ? String(d.telegramId) : '';
            
            const matchTg = targetTgId && rTgId && targetTgId === rTgId;
            const matchCode = d.studentCode && targetMember.code && d.studentCode === targetMember.code;
            const matchPhone = targetPhone && rPhone && targetPhone === rPhone;
            const matchName = targetName && d.fullNameAm && targetName === d.fullNameAm;

            if (matchTg || matchCode || matchPhone || matchName) {
              await deleteDoc(doc(db, 'registrations', regDoc.id)).catch(() => {});
            }
          }
        }

        // Clean matching students
        const studSnap = await getDocs(collection(db, 'students')).catch(() => null);
        if (studSnap && studSnap.docs) {
          for (const studDoc of studSnap.docs) {
            const d = studDoc.data();
            const sPhone = (d.phone || '').replace(/\D/g, '').slice(-9);
            const sTgId = d.telegramId ? String(d.telegramId) : '';

            const matchTg = targetTgId && sTgId && targetTgId === sTgId;
            const matchCode = d.code && targetMember.code && d.code === targetMember.code;
            const matchPhone = targetPhone && sPhone && targetPhone === sPhone;
            const matchName = targetName && d.fullNameAm && targetName === d.fullNameAm;

            if (matchTg || matchCode || matchPhone || matchName) {
              await deleteDoc(doc(db, 'students', studDoc.id)).catch(() => {});
            }
          }
        }
      }

      setApprovalBanner({
        message: 'ተማሪው ከሲስተሙ ተሰርዟል (Student record deleted).',
        type: 'success',
      });
      setTimeout(() => setApprovalBanner(null), 5000);
    } catch (e) {
      console.error('Delete member failed:', e);
    }
  };

  const handleUpdateMember = async (updated: Member) => {
    try {
      const studentRef = doc(db, 'students', updated.id);
      const regRef = doc(db, 'registrations', updated.id);

      const updateData = {
        fullNameAm: updated.fullNameAm,
        fullNameEn: updated.fullNameEn,
        christianName: updated.christianName || '',
        birthYear: updated.birthYear || '',
        birthDate: updated.birthYear || '', // bot compatibility
        gender: updated.gender,
        phone: updated.phone,
        department: updated.department,
        gradeLevel: updated.gradeLevel,
        code: updated.code,
        studentCode: updated.code,
        subcity: updated.subcity || '',
        address: updated.subcity || '', // bot compatibility
        emergencyContact: updated.emergencyContact,
        emergencyName: updated.emergencyContact.name, // bot compatibility
        emergencyPhone: updated.emergencyContact.phone, // bot compatibility
        emergencyRelation: updated.emergencyContact.relation, // bot compatibility
        photoUrl: updated.photoUrl,
        updatedAt: new Date().toISOString(),
      };

      // Try updating both collections using setDoc with merge for robustness
      await setDoc(studentRef, updateData, { merge: true }).catch(() => console.log('Member not in students collection'));
      await setDoc(regRef, updateData, { merge: true }).catch(() => console.log('Member not in registrations collection'));

      setApprovalBanner({
        message: 'የተማሪ መረጃ በተሳካ ሁኔታ ተስተካክሏል።',
        type: 'success',
      });
      setTimeout(() => setApprovalBanner(null), 3000);
    } catch (e) {
      console.error('Update member failed:', e);
      setApprovalBanner({
        message: 'ማስተካከል አልተሳካም። እባክዎ እንደገና ይሞክሩ።',
        type: 'error',
      });
      setTimeout(() => setApprovalBanner(null), 5000);
    }
  };

  const handleCheckIn = async (record: AttendanceRecord) => {
    try {
      const matchingStudent = students.find(
        (s) => s.code === record.memberCode || s.id === record.memberId
      );

      await addDoc(collection(db, 'attendance'), {
        memberId: record.memberId,
        memberNameAm: record.memberNameAm || matchingStudent?.fullNameAm || 'Student',
        memberNameEn: record.memberNameEn || matchingStudent?.fullNameEn || 'Student',
        memberCode: record.memberCode || matchingStudent?.code || '',
        department: record.department || matchingStudent?.department || 'education',
        sessionName: record.sessionName || activeSession.nameAm,
        timestamp: record.timestamp || new Date().toLocaleTimeString(),
        date: record.date || new Date().toISOString().split('T')[0],
        method: record.method || 'qr',
        status: record.status || 'present',
        phone: matchingStudent?.phone || '',
        telegramId: matchingStudent?.telegramId || '',
      });
    } catch (e) {
      console.error('Check-in failed:', e);
    }
  };

  const handleDeleteAttendance = async (attendanceId: string) => {
    try {
      setAttendance((prev) => prev.filter((a) => a.id !== attendanceId));
      await deleteDoc(doc(db, 'attendance', attendanceId));
    } catch (e) {
      console.error('Delete attendance failed:', e);
    }
  };

  const handleUpdateAttendance = async (attendanceId: string, updated: Partial<AttendanceRecord>) => {
    try {
      setAttendance((prev) => prev.map((a) => (a.id === attendanceId ? { ...a, ...updated } : a)));
      await updateDoc(doc(db, 'attendance', attendanceId), updated);
    } catch (e) {
      console.error('Update attendance failed:', e);
    }
  };

  const handleAddTicket = async (ticket: SupportTicket) => {
    try {
      const docRef = await addDoc(collection(db, 'support_tickets'), ticket);
      const savedTicket = { ...ticket, id: docRef.id || ticket.id };
      setTickets((prev) => {
        const next = [savedTicket, ...prev];
        try { localStorage.setItem('ww_tickets_cache', JSON.stringify(next)); } catch {}
        return next;
      });
    } catch (e) {
      console.error('Add ticket failed:', e);
    }
  };

  const handleUpdateTicketStatus = async (ticketId: string, status: SupportStatus, reason?: string) => {
    try {
      setTickets((prev) => {
        const next = prev.map((t) => (t.id === ticketId ? { ...t, status, reason: reason || t.reason, updatedAt: new Date().toISOString() } : t));
        try { localStorage.setItem('ww_tickets_cache', JSON.stringify(next)); } catch {}
        return next;
      });
      await updateDoc(doc(db, 'support_tickets', ticketId), {
        status,
        reason: reason || '',
        approvedBy: currentAdmin.nameAm,
        updatedAt: new Date().toISOString(),
      }).catch(console.error);

      const ticket = tickets.find((t) => t.id === ticketId);
      let targetTg = ticket?.telegramId;
      if (!targetTg && ticket) {
        const matchStudent = students.find((s) => (ticket.phone && s.phone === ticket.phone) || (ticket.requesterName && s.fullNameAm === ticket.requesterName));
        const matchReg = registrations.find((r) => (ticket.phone && r.phone === ticket.phone) || (ticket.requesterName && r.fullNameAm === ticket.requesterName));
        targetTg = matchStudent?.telegramId || matchReg?.telegramId;
      }
      if (targetTg && ticket) {
        const statusAm = status === 'approved' ? '✅ ጸድቋል (Approved)' : status === 'rejected' ? '❌ አልተቀበለም (Rejected)' : status === 'resolved' ? '✅ ተፈትቷል (Resolved)' : status === 'in_contact' ? '📞 በሂደት ላይ' : '📌 ታይቷል';
        await sendTelegramMessage(
          targetTg,
          `💬 *የድጋፍ ጥያቄ ሁኔታ (Support Ticket Update)*\n` +
          `⛪ *መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን*\n` +
          `═══════════════════════\n\n` +
          `🎫 *ቲኬት ቁጥር:* \`${ticket.ticketNumber || ticketId}\`\n` +
          `📌 *ጉዳይ:* ${ticket.title || ticket.category}\n` +
          `🟢 *ሁኔታ:* *${statusAm}*\n` +
          `📝 *ምክንያት/አስተያየት:* ${reason || 'የለም'}\n` +
          `✍️ *ያየው:* ${currentAdmin.nameAm}`,
          { parseMode: 'Markdown' }
        ).catch(console.warn);
      }
    } catch (e) {
      console.error('Update ticket failed:', e);
    }
  };

  const handleAddNote = async (ticketId: string, author: string, text: string) => {
    try {
      const ticket = tickets.find((t) => t.id === ticketId);
      if (!ticket) return;
      const newNote = {
        id: `n-${Date.now()}`,
        author,
        text,
        date: new Date().toISOString().replace('T', ' ').slice(0, 16),
      };
      const updatedNotes = [...ticket.notes, newNote];
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, notes: updatedNotes } : t)));

      await updateDoc(doc(db, 'support_tickets', ticketId), {
        notes: updatedNotes,
        updatedAt: new Date().toISOString(),
      }).catch(console.error);

      // Targeted notification for requester
      await addDoc(collection(db, 'notifications'), {
        title: `💬 ለድጋፍ ጥያቄዎ (${ticket.ticketNumber || ticketId}) ምላሽ ተሰጥቷል`,
        message: `ከ${author || 'አስተዳዳሪ'}: "${text}"`,
        senderName: author || 'አስተባባሪ',
        targetRequesterName: ticket.requesterName || '',
        targetPhone: ticket.phone || '',
        targetTelegramId: ticket.telegramId || '',
        ticketId: ticketId,
        ticketNumber: ticket.ticketNumber || ticketId,
        createdAt: new Date().toISOString(),
        isDirectReply: true,
      }).catch(console.error);

      // Direct Telegram reply
      let targetTg = ticket.telegramId;
      if (!targetTg) {
        const matchStudent = students.find((s) => (ticket.phone && s.phone === ticket.phone) || (ticket.requesterName && s.fullNameAm === ticket.requesterName));
        const matchReg = registrations.find((r) => (ticket.phone && r.phone === ticket.phone) || (ticket.requesterName && r.fullNameAm === ticket.requesterName));
        targetTg = matchStudent?.telegramId || matchReg?.telegramId;
      }
      if (targetTg) {
        await sendSupportReplyTelegram({
          telegramId: targetTg,
          ticketNumber: ticket.ticketNumber || ticketId,
          requesterName: ticket.requesterName,
          title: ticket.title,
          author: author || currentAdmin.nameAm,
          replyText: text,
        }).catch(console.warn);
      }
    } catch (e) {
      console.error('Add note failed:', e);
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    try {
      setTickets((prev) => {
        const next = prev.filter((t) => t.id !== ticketId && t.ticketNumber !== ticketId);
        try { localStorage.setItem('ww_tickets_cache', JSON.stringify(next)); } catch {}
        return next;
      });
      await deleteDoc(doc(db, 'support_tickets', ticketId)).catch(() => {});
      
      // Also delete from Firestore if ticket has different document ID
      const querySnap = await getDocs(collection(db, 'support_tickets')).catch(() => null);
      if (querySnap) {
        for (const d of querySnap.docs) {
          if (d.id === ticketId || d.data().id === ticketId || d.data().ticketNumber === ticketId) {
            await deleteDoc(doc(db, 'support_tickets', d.id)).catch(() => {});
          }
        }
      }
    } catch (e) {
      console.error('Delete ticket failed:', e);
    }
  };

  const handleDeleteLeaveRequest = async (requestId: string) => {
    try {
      setLeaveRequests((prev) => {
        const next = prev.filter((l) => l.id !== requestId);
        try { localStorage.setItem('ww_leave_cache', JSON.stringify(next)); } catch {}
        return next;
      });
      await deleteDoc(doc(db, 'leave_requests', requestId));
    } catch (error) {
      console.error('Delete leave request failed:', error);
    }
  };

  const handleUpdateLeaveRequestStatus = async (
    requestId: string,
    status: 'approved' | 'rejected',
    reason: string,
    extraLeaveData?: any
  ) => {
    try {
      setLeaveRequests((prev) => {
        const next = prev.map((l) => (l.id === requestId ? { ...l, status, reason: reason || l.reason } : l));
        try { localStorage.setItem('ww_leave_cache', JSON.stringify(next)); } catch {}
        return next;
      });
      await updateDoc(doc(db, 'leave_requests', requestId), {
        status,
        reason: reason,
        approvedBy: currentAdmin.nameAm,
        updatedAt: new Date().toISOString(),
      }).catch(console.error);

      // 1. First priority: Use immediately supplied extraLeaveData snapshot
      let targetTelegramId = extraLeaveData?.telegramId;
      let studentName = extraLeaveData?.studentName;
      let requestNumber = extraLeaveData?.requestNumber;
      let leaveType = extraLeaveData?.leaveType;
      let duration = extraLeaveData?.duration;

      // 2. Second priority: Fresh direct read from Firestore document
      if (!targetTelegramId || !studentName) {
        try {
          const freshSnap = await getDoc(doc(db, 'leave_requests', requestId));
          if (freshSnap.exists()) {
            const data = freshSnap.data();
            targetTelegramId = targetTelegramId || data.telegramId || data.tgId || data.chatId;
            studentName = studentName || data.studentName || data.fullNameAm || 'ተማሪ';
            requestNumber = requestNumber || data.requestNumber || `LV-${requestId.slice(0, 4)}`;
            leaveType = leaveType || data.leaveType || 'ፈቃድ';
            duration = duration || data.duration || 'N/A';
          }
        } catch (fetchErr) {
          console.warn('Fresh leave doc lookup warning:', fetchErr);
        }
      }

      // 3. Third priority: Check React state
      if (!targetTelegramId) {
        const targetLeave = leaveRequests.find((l) => l.id === requestId);
        targetTelegramId = targetLeave?.telegramId;
        studentName = studentName || targetLeave?.studentName || 'ተማሪ';
        requestNumber = requestNumber || targetLeave?.requestNumber || 'LV-N/A';
        leaveType = leaveType || targetLeave?.leaveType || 'ፈቃድ';
        duration = duration || targetLeave?.duration || 'N/A';
      }

      // 4. Fallback search in students and registrations
      if (!targetTelegramId) {
        const matchStudent = students.find(
          (s) => (requestNumber && s.code === requestNumber) ||
                 (studentName && s.fullNameAm === studentName)
        );
        const matchReg = registrations.find(
          (r) => (requestNumber && r.code === requestNumber) ||
                 (studentName && r.fullNameAm === studentName)
        );
        targetTelegramId = (matchStudent?.telegramId || matchReg?.telegramId) as any;
      }

      // 5. Send Telegram notification directly
      let sentTg = false;
      if (targetTelegramId) {
        try {
          const res = await sendLeaveDecisionTelegram({
            telegramId: targetTelegramId,
            studentName: studentName || 'ተማሪ',
            requestNumber: requestNumber || 'LV-N/A',
            leaveType: leaveType || 'ፈቃድ',
            duration: duration || 'N/A',
            status,
            reason,
            approvedBy: currentAdmin.nameAm,
          });
          sentTg = res.ok;
        } catch (tgErr) {
          console.warn('Direct Telegram leave decision notice:', tgErr);
        }
      }

      setApprovalBanner({
        message: sentTg
          ? (status === 'approved'
              ? `የተማሪ "${studentName}" የፈቃድ ጥያቄ ጸድቋል፤ ለተማሪው በቴሌግራም ተልኳል!`
              : `የተማሪ "${studentName}" የፈቃድ ጥያቄ ውድቅ ሆኗል፤ ለተማሪው በቴሌግራም ተልኳል!`)
          : (status === 'approved'
              ? `የተማሪ "${studentName}" የፈቃድ ጥያቄ ጸድቋል!`
              : `የተማሪ "${studentName}" የፈቃድ ጥያቄ ውድቅ ሆኗል!`),
        type: 'success',
      });
      setTimeout(() => setApprovalBanner(null), 7000);
    } catch (e) {
      console.error('Update leave request status failed:', e);
    }
  };

  const handleOpenCardStudio = (member?: Member) => {
    setStudioTargetMember(member || members[0] || null);
    setIsCardStudioOpen(true);
  };

  const handleSelectSessionFromSchedule = (sessionName: string, grade: string) => {
    const matching = sessions.find((s) => s.gradeAm === grade || s.nameAm.includes(grade));
    if (matching) {
      setActiveSession(matching);
    }
    setActiveTab('attendance');
  };

  if (!hasEnteredApp) {
    return (
      <ApkDownloadPage
        onOpenApp={(asStudent) => {
          if (asStudent) {
            setShowStudentPortal(true);
          }
          setHasEnteredApp(true);
        }}
      />
    );
  }

  if (showStudentPortal) {
    return (
      <StudentPortalView
        members={members}
        attendance={attendance}
        onOpenAdminLogin={() => {
          setShowStudentPortal(false);
          setIsLoggedIn(false);
        }}
        lang={lang}
      />
    );
  }

  if (!isLoggedIn) {
    return (
      <LoginPage
        onLogin={(admin) => {
          setCurrentAdmin((prev) => ({
            ...prev,
            id: admin.id || prev.id,
            nameAm: admin.nameAm,
            nameEn: admin.nameEn,
            phone: admin.phone,
            role: admin.role,
            permissions: admin.permissions,
          }));
          setIsLoggedIn(true);

          const p = admin.permissions || {};
          const isSuper = admin.role === 'super_admin';
          const pAttendance = isSuper || Boolean(p.canAccessAttendance ?? p.takeAttendance);
          const pSchedule = isSuper || Boolean(p.canAccessSchedule);
          const pMembers = isSuper || Boolean(p.canAccessMembers ?? p.approveStudents);
          const pSupport = isSuper || Boolean(p.canAccessSupport ?? p.manageSupport);
          const pAdmins = isSuper || Boolean(p.canAccessAdmins);
          const pAnalytics = isSuper || Boolean(p.canAccessAnalytics ?? p.exportReports);

          if (pAttendance) {
            setActiveTab('attendance');
          } else if (pSchedule) {
            setActiveTab('schedule');
          } else if (pMembers) {
            setActiveTab('members');
          } else if (pSupport) {
            setActiveTab('support');
          } else if (pAdmins) {
            setActiveTab('admins');
          } else if (pAnalytics) {
            setActiveTab('analytics');
          } else {
            setActiveTab('attendance');
          }
        }}
        onOpenStudentPortal={() => setShowStudentPortal(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#062414] text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Header: Brand Wordmark - Desktop Nav Links - Profile & Actions */}
      <header className="no-print border-b border-[#0f4425] bg-[#09351c]/95 backdrop-blur-xl sticky top-0 z-50 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 shadow-2xl shadow-emerald-950/60 transition-all duration-300">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative group">
            <div className="absolute -inset-1 bg-amber-500/20 rounded-full blur group-hover:bg-amber-500/40 transition duration-300"></div>
            <img
              src={FITHAPOL_LOGO}
              alt="Wold Wahid Logo"
              className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 border-amber-400 object-cover shadow-lg"
              referrerPolicy="no-referrer"
            />
          </div>
          <a href="#" className="flex flex-col">
            <span className="text-base sm:text-lg font-black tracking-tight text-white leading-tight uppercase">የወልድ ዋሕድ</span>
            <span className="text-amber-400 text-[11px] sm:text-xs font-bold tracking-widest font-sans">ሰንበት ትምህርት ቤት</span>
          </a>
        </div>

        {/* Zone 2: Navigation Links for Wide Screens (All visible without dragging) */}
        <nav className="hidden xl:flex items-center gap-1.5 bg-[#062414]/50 p-1.5 rounded-2xl border border-[#0f4425]/50 shadow-inner">
          {allowedNavTabs.map((nav) => (
            <button
              key={nav.id}
              onClick={() => setActiveTab(nav.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                activeTab === nav.id 
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-black translate-y-[-1px]' 
                  : 'text-emerald-100/70 hover:text-white hover:bg-emerald-900/40'
              }`}
            >
              <span>{nav.label}</span>
              {nav.count !== undefined && nav.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 ${
                  activeTab === nav.id ? 'bg-slate-950 text-amber-500' : 'bg-rose-500 text-white shadow-md shadow-rose-500/30'
                }`}>
                  {nav.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Zone 3: Profile Badge, Language & Logout */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2.5 bg-[#062414] border border-[#0f4425] rounded-2xl px-3.5 py-2 shadow-md group">
            <div className="w-7 h-7 rounded-full bg-amber-500/10 flex items-center justify-center text-base border border-amber-500/20 group-hover:scale-110 transition-transform">👑</div>
            <div className="flex flex-col">
              <span className="font-black text-xs sm:text-sm text-white">{currentAdmin.nameAm || 'አስተዳዳሪ'}</span>
              <span className="text-[9px] sm:text-[10px] text-amber-500 font-extrabold uppercase tracking-tighter">
                {currentAdmin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className={`p-2.5 sm:p-3 rounded-2xl transition-all shadow-sm hover:scale-105 active:scale-95 cursor-pointer ${
                isRefreshing 
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' 
                  : 'bg-emerald-900/40 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-800/60'
              }`}
              title="Refresh Data"
            >
              <div className={isRefreshing ? 'animate-spin' : ''}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
              </div>
            </button>
            <button
              onClick={() => setIsChangePasswordModalOpen(true)}
              className="p-2.5 sm:p-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-all shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
              title="የይለፍ ቃል ቀይር (Change Password)"
            >
              <KeyRound className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            {canBroadcast && (
              <button
                onClick={() => setIsNotificationModalOpen(true)}
                className="p-2.5 sm:p-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-all shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
                title="ማስታወቂያ ላክ"
              >
                <Megaphone className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}
            <button
              onClick={() => setLang(lang === 'am' ? 'en' : 'am')}
              className="p-2.5 sm:p-3 rounded-2xl bg-[#062414] hover:bg-emerald-900/40 text-slate-200 border border-[#0f4425] transition-all shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
              title="Switch Language"
            >
              <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            </button>
            <button
              onClick={() => setIsLoggedIn(false)}
              className="p-2.5 sm:p-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
              title="Log Out"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="no-print xl:hidden sticky top-[60px] z-40 bg-[#09351c] border-b border-[#0f4425] shadow-lg">
        <div className="relative group">
          <div className="flex items-center justify-start overflow-x-auto no-scrollbar gap-2 px-4 py-3 active:cursor-grabbing select-none"
               style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}>
            {allowedNavTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`shrink-0 relative flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-all duration-300 cursor-pointer text-[11px] font-black uppercase tracking-wider shadow-sm ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-amber-500/20 ring-1 ring-amber-400/50'
                      : 'bg-[#062414] text-emerald-200/60 border border-[#0f4425] hover:text-white hover:bg-[#0f4425]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${activeTab === tab.id ? 'text-slate-950' : 'text-amber-500'}`} />
                  <span className="whitespace-nowrap">{tab.mobileLabel || tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-lg text-[9px] font-black shadow-inner ${
                      activeTab === tab.id ? 'bg-slate-950 text-amber-400' : 'bg-rose-600 text-white'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {/* Scroll Hint Gradient */}
          <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#09351c] to-transparent pointer-events-none opacity-80" />
        </div>
      </div>

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {approvalBanner && (
          <div
            className={`mb-5 p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-3 shadow-lg transition-all ${
              approvalBanner.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{approvalBanner.message}</span>
            </div>
            <button
              onClick={() => setApprovalBanner(null)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {activeTab === 'schedule' && canSchedule && (
          <ScheduleView
            onSelectSessionForAttendance={handleSelectSessionFromSchedule}
            lang={lang}
          />
        )}

        {activeTab === 'members' && canMembers && (
          <MemberList
            members={members}
            onAddMember={handleAddMember}
            onApproveMember={handleApproveMember}
            onRejectMember={handleRejectMember}
            onDeleteMember={handleDeleteMember}
            onUpdateMember={handleUpdateMember}
            onOpenCardStudio={handleOpenCardStudio}
            currentAdminRole={currentAdmin.role}
            lang={lang}
          />
        )}

        {activeTab === 'attendance' && canAttendance && (
          <AttendanceScanner
            members={members}
            attendance={attendance}
            sessions={sessions}
            activeSession={activeSession}
            onSelectSession={setActiveSession}
            onCheckIn={handleCheckIn}
            onDeleteAttendance={handleDeleteAttendance}
            onUpdateAttendance={handleUpdateAttendance}
            currentAdmin={currentAdmin}
            lang={lang}
          />
        )}

        {activeTab === 'support' && canSupport && (
          <SupportDesk
            tickets={tickets}
            leaveRequests={leaveRequests}
            members={members}
            attendance={attendance}
            onAddTicket={handleAddTicket}
            onUpdateTicketStatus={handleUpdateTicketStatus}
            onDeleteTicket={handleDeleteTicket}
            onDeleteLeaveRequest={handleDeleteLeaveRequest}
            onUpdateLeaveRequestStatus={handleUpdateLeaveRequestStatus}
            onAddNote={handleAddNote}
            onUpdateAttendance={handleUpdateAttendance}
            lang={lang}
          />
        )}

        {activeTab === 'admins' && canAdmins && (
          <AdminManagement
            currentAdmin={currentAdmin}
            lang={lang}
          />
        )}

        {activeTab === 'analytics' && canAnalytics && (
          <AnalyticsView
            members={members}
            attendance={attendance}
            tickets={tickets}
            leaveRequests={leaveRequests}
            lang={lang}
          />
        )}
      </main>

      {/* Printable ID Card Studio Modal */}
      {isCardStudioOpen && (
        <IdCardStudio
          members={members}
          selectedMember={studioTargetMember}
          onClose={() => setIsCardStudioOpen(false)}
          lang={lang}
        />
      )}

      {/* Broadcast Notification Modal */}
      <NotificationModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        adminName={currentAdmin.nameAm}
      />

      {/* Change Password Modal for Active Admin */}
      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
        currentAdmin={currentAdmin}
      />

      {/* Official Church Footer */}
      <footer className="no-print border-t border-[#0f4425] bg-[#062414] py-6 px-6 text-center text-xs text-emerald-200/70">
        <p>
          መካነ ቅዱሳን ኢያቄም ወሐና ቤተ-ክርስቲያን የወልደ ዋሕድ ሰንበት ትምህርት ቤት · {new Date().getFullYear()} · የአባላት አስተዳደርና የመገኘት ክትትል ሥርዓት
        </p>
      </footer>
    </div>
  );
}
