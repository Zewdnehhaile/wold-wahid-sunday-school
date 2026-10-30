import React, { useState, useEffect } from 'react';
import { Member, AttendanceRecord, SupportTicket, LeaveRequest, ServiceSession, Language, SupportStatus, AdminUser } from './types';
import {
  INITIAL_SESSIONS,
  INITIAL_ADMINS,
  FITHAPOL_LOGO,
  AVATAR_MALE,
  AVATAR_FEMALE,
} from './data/initialData';
import { db } from './firebase';
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, getDocs, query, where, setDoc } from 'firebase/firestore';
import { t } from './utils/translations';
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
import { apiFetch } from './utils/api';
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
  const isTelegramContext = typeof window !== 'undefined' && (
    Boolean((window as any).Telegram?.WebApp?.initData) ||
    window.location.hash.includes('tgWebAppData') ||
    window.location.search.includes('tgWebApp') ||
    window.location.search.includes('student') ||
    window.location.search.includes('tgWebAppStartParam') ||
    window.location.search.includes('woldwahidsundayschool') ||
    /Telegram/i.test(navigator.userAgent)
  );
  const [hasEnteredApp, setHasEnteredApp] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('members');
  const [showStudentPortal, setShowStudentPortal] = useState(false);

  // Live Firestore state (no mock data)
  const [registrations, setRegistrations] = useState<Member[]>([]);
  const [students, setStudents] = useState<Member[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);

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

  // Real-time Firestore subscriptions
  useEffect(() => {
    // 1. Listen to real-time pending & approved registrations
    const unsubReg = onSnapshot(
      collection(db, 'registrations'),
      (snap) => {
        const regList: Member[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          const isApproved = d.status === 'approved' || Boolean(d.studentCode);
          return {
            id: docSnap.id,
            code: d.studentCode || d.code || `PENDING-${d.telegramId ? String(d.telegramId).slice(-4) : docSnap.id.slice(0, 4)}`,
            fullNameAm: d.fullNameAm || d.fullNameEn || 'ያልተገለጸ ስም',
            fullNameEn: d.fullNameEn || d.fullNameAm || 'Unnamed Student',
            phone: d.phone || '',
            gender: d.gender === 'female' ? 'female' : 'male',
            department: d.department || 'education',
            gradeLevel: d.gradeLevel || 'general',
            roleAm: 'ተማሪ / Student',
            roleEn: 'Student',
            christianName: d.christianName || '',
            birthYear: d.birthYear || d.birthDate || '',
            photoUrl: (d.photoUrl?.startsWith('tg_file:') 
            ? `/api/telegram/file/${d.photoUrl.replace('tg_file:', '')}` 
            : d.photoUrl) || (d.gender === 'female' ? AVATAR_FEMALE : AVATAR_MALE),
            registeredDate: d.submittedAt?.split('T')[0] || new Date().toISOString().split('T')[0],
            bloodGroup: d.bloodGroup || 'O+',
            emergencyContact: d.emergencyContact || { 
              name: d.emergencyName || '', 
              phone: d.emergencyPhone || '', 
              relation: d.emergencyRelation || 'ቤተሰብ / Family' 
            },
            subcity: d.subcity || d.address || '',
            status: isApproved ? 'active' : d.status === 'rejected' ? 'rejected' : 'pending_approval',
            telegramId: d.telegramId || '',
            telegramUsername: d.telegramUsername || '',
            approvedBy: d.approvedBy,
            approvedAt: d.approvedAt,
            consecutiveAbsences: 0,
          };
        });
        setRegistrations(regList);
      },
      (error) => {
        console.error('Firestore registrations snapshot error:', error);
      }
    );

    // 2. Listen to real-time approved students
    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      const studentList: Member[] = snap.docs.map((docSnap) => {
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
          photoUrl: (d.photoUrl?.startsWith('tg_file:') 
            ? `/api/telegram/file/${d.photoUrl.replace('tg_file:', '')}` 
            : d.photoUrl) || (d.gender === 'female' ? AVATAR_FEMALE : AVATAR_MALE),
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
          consecutiveAbsences: d.consecutiveAbsences || 0,
        };
      });
      setStudents(studentList);
    }, (error) => {
      console.error('Students snapshot error:', error);
    });

    // 3. Listen to real-time support tickets
    const unsubTickets = onSnapshot(collection(db, 'support_tickets'), (snap) => {
      const ticketList: SupportTicket[] = snap.docs.map((docSnap) => {
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
    }, (error) => {
      console.error('Support tickets snapshot error:', error);
    });

    // 4. Listen to real-time attendance logs
    const unsubAttendance = onSnapshot(collection(db, 'attendance'), (snap) => {
      const attList: AttendanceRecord[] = snap.docs.map((docSnap) => {
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
    }, (error) => {
      console.error('Attendance snapshot error:', error);
    });

    // 5. Listen to real-time leave requests
    const unsubLeaves = onSnapshot(collection(db, 'leave_requests'), (snap) => {
      const list: LeaveRequest[] = snap.docs.map((docSnap) => {
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
      setLeaveRequests(list);
    }, (error) => {
      console.error('Leave requests snapshot error:', error);
    });

    // 6. Real-time push notification receiver (online & offline PWA support)
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const unsubNotifs = onSnapshot(collection(db, 'notifications'), (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const diffMs = Math.abs(Date.now() - new Date(data.createdAt || Date.now()).getTime());
          // Alert if recent within 5 minutes
          if (diffMs < 5 * 60 * 1000) {
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                navigator.serviceWorker.ready.then((reg) => {
                  reg.showNotification(data.title || 'ወልደ ዋሕድ ሰንበት ት/ቤት', {
                    body: data.message,
                    icon: '/assets/aistudio/photo_2026-10-22_10-46-07__2__5dd80c37.jpg',
                    badge: '/assets/aistudio/photo_2026-10-22_10-46-07__2__5dd80c37.jpg',
                  });
                });
              } else {
                new Notification(data.title || 'ወልደ ዋሕድ ሰንበት ት/ቤት', {
                  body: data.message,
                  icon: '/assets/aistudio/photo_2026-10-22_10-46-07__2__5dd80c37.jpg',
                });
              }
            }
          }
        }
      });
    }, (error) => {
      console.error('Notifications snapshot error:', error);
    });

    return () => {
      unsubReg();
      unsubStudents();
      unsubTickets();
      unsubAttendance();
      unsubLeaves();
      unsubNotifs();
    };
  }, []);

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

  const members = [...approvedList, ...pendingList];
  const pendingCount = pendingList.length;

  // Real-time counter for new messages/requests in Support & Student leave desk
  const newSupportTicketsCount = tickets.filter((t) => t.status === 'new').length;
  const pendingLeavesCount = leaveRequests.filter((l) => l.status === 'pending' || !l.status).length;
  const totalNewSupportCount = newSupportTicketsCount + pendingLeavesCount;

  const dict = t[lang];

  // Real Actions hooked to Firestore and Backend Notification
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

      // 3. Call backend approval API to trigger Telegram notification
      try {
        await apiFetch(`/api/registrations/${memberId}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentCode: manualStudentId,
            approvedBy: currentAdmin.nameAm,
          }),
        });
      } catch (backendErr) {
        console.warn('Backend approval dispatch warning:', backendErr);
      }

      setApprovalBanner({
        message: `ተማሪ "${studentName}" በመታወቂያ ቁጥር "${manualStudentId}" በተሳካ ሁኔታ ጸድቋል! ወደ ጸደቁ ተማሪዎች ዝርዝር ተላልፏል።`,
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

  const handleRejectMember = async (memberId: string) => {
    try {
      await updateDoc(doc(db, 'registrations', memberId), {
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
        rejectedBy: currentAdmin.nameAm,
      });
    } catch (e) {
      console.error('Rejection failed:', e);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    try {
      const targetStudent = students.find((s) => s.id === memberId);
      
      // 1. Delete from students collection
      await deleteDoc(doc(db, 'students', memberId)).catch(() => {});
      
      // 2. Delete from registrations collection by same docId
      await deleteDoc(doc(db, 'registrations', memberId)).catch(() => {});

      // 3. Delete any orphaned registration entries matching target student phone, code, or name
      if (targetStudent) {
        const targetPhone = (targetStudent.phone || '').replace(/\D/g, '').slice(-9);
        const regSnap = await getDocs(collection(db, 'registrations'));
        
        for (const regDoc of regSnap.docs) {
          const d = regDoc.data();
          const rPhone = (d.phone || '').replace(/\D/g, '').slice(-9);
          const matchCode = d.studentCode && targetStudent.code && d.studentCode === targetStudent.code;
          const matchPhone = targetPhone && rPhone && targetPhone === rPhone;
          const matchName = d.fullNameAm && targetStudent.fullNameAm && d.fullNameAm === targetStudent.fullNameAm;
          
          if (matchCode || matchPhone || matchName) {
            await deleteDoc(doc(db, 'registrations', regDoc.id)).catch(() => {});
          }
        }
      }
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
        telegramId: matchingStudent?.telegramUsername || '',
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
      await addDoc(collection(db, 'support_tickets'), ticket);
    } catch (e) {
      console.error('Add ticket failed:', e);
    }
  };

  const handleUpdateTicketStatus = async (ticketId: string, status: SupportStatus, reason?: string) => {
    try {
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status, reason: reason || t.reason, updatedAt: new Date().toISOString() } : t)));
      await updateDoc(doc(db, 'support_tickets', ticketId), {
        status,
        reason: reason || '',
        approvedBy: currentAdmin.nameAm,
        updatedAt: new Date().toISOString(),
      }).catch(console.error);
      await apiFetch(`/api/support_tickets/${ticketId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminName: currentAdmin.nameAm, reason }),
      }).catch((e) => console.warn('Support ticket status API notice:', e));
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

      // Targeted notification for requester (broadcast-style direct delivery)
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

      await apiFetch(`/api/support_tickets/${ticketId}/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author, text }),
      }).catch((e) => console.warn('Support ticket note API notice:', e));
    } catch (e) {
      console.error('Add note failed:', e);
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    try {
      setTickets((prev) => prev.filter((t) => t.id !== ticketId && t.ticketNumber !== ticketId));
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

      await apiFetch(`/api/support_tickets/${ticketId}`, { method: 'DELETE' }).catch(() => {});
    } catch (e) {
      console.error('Delete ticket failed:', e);
    }
  };

  const handleDeleteLeaveRequest = async (requestId: string) => {
    try {
      await deleteDoc(doc(db, 'leave_requests', requestId));
      await apiFetch(`/api/leave_requests/${requestId}`, { method: 'DELETE' }).catch(() => {});
    } catch (error) {
      console.error('Delete leave request failed:', error);
    }
  };

  const handleUpdateLeaveRequestStatus = async (requestId: string, status: 'approved' | 'rejected', reason: string) => {
    try {
      setLeaveRequests((prev) => prev.map((l) => (l.id === requestId ? { ...l, status, reason: reason || l.reason } : l)));
      await updateDoc(doc(db, 'leave_requests', requestId), {
        status,
        reason: reason,
        approvedBy: currentAdmin.nameAm,
        updatedAt: new Date().toISOString(),
      }).catch(console.error);

      await apiFetch(`/api/leave_requests/${requestId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminName: currentAdmin.nameAm, reason }),
      }).catch((e) => console.warn('Leave request status API notice:', e));
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
          }));
          setIsLoggedIn(true);
          setActiveTab('attendance');
        }}
        onOpenStudentPortal={() => setShowStudentPortal(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#062414] text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Bar Contract: Zone 1 (Wordmark) - Zone 2 (Nav Links) - Zone 3 (Profile & Logout) */}
      <header className="no-print border-b border-[#0f4425] bg-[#09351c]/95 backdrop-blur-xl sticky top-0 z-50 px-4 sm:px-8 py-4 flex items-center justify-between gap-8 shadow-2xl shadow-emerald-950/60 transition-all duration-300">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="relative group">
            <div className="absolute -inset-1 bg-amber-500/20 rounded-full blur group-hover:bg-amber-500/40 transition duration-300"></div>
            <img
              src={FITHAPOL_LOGO}
              alt="Wold Wahid Logo"
              className="relative w-12 h-12 rounded-full border-2 border-amber-400 object-cover shadow-lg"
              referrerPolicy="no-referrer"
            />
          </div>
          <a href="#" className="flex flex-col">
            <span className="text-lg font-black tracking-tight text-white leading-tight uppercase">የወልድ ዋሕድ</span>
            <span className="text-amber-400 text-xs font-bold tracking-widest font-sans">ሰንበት ትምህርት ቤት</span>
          </a>
        </div>

        {/* Zone 2: Concise Single-Line Nav Links - Visible on Tablets, Laptops & Desktops */}
        <nav className="hidden md:flex items-center gap-1 bg-[#062414]/40 p-1.5 rounded-2xl border border-[#0f4425]/50 shadow-inner overflow-x-auto max-w-2xl">
          {[
            { id: 'schedule', label: dict.nav.schedule },
            { id: 'members', label: dict.nav.members, count: pendingCount },
            { id: 'attendance', label: dict.nav.attendance },
            { id: 'support', label: dict.nav.support, count: totalNewSupportCount },
            { id: 'admins', label: dict.nav.admins },
            { id: 'analytics', label: dict.nav.analytics },
          ].map((nav) => (
            <button
              key={nav.id}
              onClick={() => setActiveTab(nav.id)}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                activeTab === nav.id 
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 translate-y-[-1px]' 
                  : 'text-emerald-100/70 hover:text-white hover:bg-emerald-900/30'
              }`}
            >
              <span>{nav.label}</span>
              {nav.count !== undefined && nav.count > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 ${
                  activeTab === nav.id ? 'bg-slate-950 text-amber-500' : 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/30'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  {nav.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Zone 3: Profile Badge, Language & Logout */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden sm:flex items-center gap-3 bg-[#062414] border border-[#0f4425] rounded-2xl px-5 py-2.5 shadow-md group">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-lg border border-amber-500/20 group-hover:scale-110 transition-transform">👑</div>
            <div className="flex flex-col">
              <span className="font-black text-sm text-white">{currentAdmin.nameAm || 'አስተዳዳሪ'}</span>
              <span className="text-[10px] text-amber-500 font-extrabold uppercase tracking-tighter">
                {currentAdmin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsChangePasswordModalOpen(true)}
              className="p-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-all shadow-sm hover:scale-105 active:scale-95"
              title="የይለፍ ቃል ቀይር (Change Password)"
            >
              <KeyRound className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsNotificationModalOpen(true)}
              className="p-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-all shadow-sm hover:scale-105 active:scale-95"
              title="ማስታወቂያ ላክ"
            >
              <Megaphone className="w-5 h-5" />
            </button>
            <button
              onClick={() => setLang(lang === 'am' ? 'en' : 'am')}
              className="p-3 rounded-2xl bg-[#062414] hover:bg-emerald-900/40 text-slate-200 border border-[#0f4425] transition-all shadow-sm hover:scale-105 active:scale-95"
              title="Switch Language"
            >
              <Globe className="w-5 h-5 text-amber-400" />
            </button>
            <button
              onClick={() => setIsLoggedIn(false)}
              className="p-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all shadow-sm hover:scale-105 active:scale-95"
              title="Log Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Nav Bar - Always visible and clean on small screens */}
      <div className="no-print md:hidden border-b border-[#0f4425] bg-[#09351c] px-3 py-3 grid grid-cols-3 sm:grid-cols-6 gap-2 z-40 shadow-md">
        {[
          { id: 'schedule', label: 'መርሐ ግብር', icon: Calendar },
          { id: 'members', label: 'ተማሪዎች', icon: Users, count: pendingCount },
          { id: 'attendance', label: 'መገኘት', icon: QrCode },
          { id: 'support', label: 'ድጋፍ', icon: HeartHandshake, count: totalNewSupportCount },
          { id: 'admins', label: 'አድሚኖች', icon: ShieldCheck },
          { id: 'analytics', label: 'ሪፖርት', icon: BarChart3 },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`relative flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all duration-200 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400/50'
                  : 'bg-[#062414]/70 text-emerald-100/70 border border-[#0f4425]'
              }`}
            >
              <Icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-slate-950' : 'text-amber-400'}`} />
              <span className="text-[10px] font-bold tracking-tight leading-tight">{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && activeTab !== tab.id && (
                <span className="absolute -top-1.5 -right-1 bg-rose-500 text-white font-black px-1.5 py-0.2 rounded-full text-[9px] border border-[#09351c] animate-pulse">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
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

        {activeTab === 'schedule' && (
          <ScheduleView
            onSelectSessionForAttendance={handleSelectSessionFromSchedule}
            lang={lang}
          />
        )}

        {activeTab === 'members' && (
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

        {activeTab === 'attendance' && (
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

        {activeTab === 'support' && (
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

        {activeTab === 'admins' && (
          <AdminManagement
            currentAdmin={currentAdmin}
            lang={lang}
          />
        )}

        {activeTab === 'analytics' && (
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
