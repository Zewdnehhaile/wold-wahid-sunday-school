export type Language = 'am' | 'en';

export type DayOfWeek = 'friday' | 'saturday' | 'sunday';

export type GradeLevel = 'pre_kg' | 'grade_1_2' | 'grade_3_5' | 'grade_6_9' | 'leaders';

export type SundaySchoolDepartment = 'discipline' | 'education' | 'arts' | 'abnet' | 'choir' | 'general';

export type Department = SundaySchoolDepartment;

export type SupportCategory = 'prayer' | 'visitation' | 'welfare' | 'counseling' | 'general';

export type SupportStatus = 'new' | 'assigned' | 'in_contact' | 'resolved';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface ScheduleItem {
  id: string;
  day: DayOfWeek;
  dayAm: string;
  dayEn: string;
  gradeLevel: GradeLevel;
  gradeAm: string;
  gradeEn: string;
  activity: string;
  timeRange: string;
  departmentResponsible: string;
  departmentKey: SundaySchoolDepartment;
}

export type MemberStatus = 'active' | 'pending_approval' | 'rejected' | 'inactive';

export type UserRole = 'super_admin' | 'admin';

export interface AdminUser {
  id: string;
  nameAm: string;
  nameEn: string;
  role: UserRole;
  department: SundaySchoolDepartment;
  avatarUrl?: string;
  phone?: string;
}

export interface Member {
  id: string;
  code: string; // e.g. "WW-2026-0042" (assigned manually upon approval)
  fullNameAm: string;
  fullNameEn: string;
  phone: string;
  gender: 'male' | 'female';
  department: SundaySchoolDepartment;
  gradeLevel?: GradeLevel;
  roleAm: string;
  roleEn: string;
  christianName?: string;
  birthYear?: string;
  photoUrl: string;
  registeredDate: string;
  bloodGroup: string;
  emergencyContact: {
    name: string;
    phone: string;
    relation: string;
  };
  subcity: string;
  status: MemberStatus;
  approvedBy?: string;
  approvedAt?: string;
  telegramId?: string | number;
  telegramUsername?: string;
  consecutiveAbsences: number;
}

export interface AttendanceRecord {
  id: string;
  memberId: string;
  memberNameAm: string;
  memberNameEn: string;
  memberCode: string;
  department: SundaySchoolDepartment;
  sessionName: string;
  gradeLevel?: string;
  timestamp: string; // HH:mm:ss
  date: string; // YYYY-MM-DD
  method: 'qr' | 'kiosk' | 'manual';
  status?: 'present' | 'absent' | 'excused';
  note?: string;
  isGuest?: boolean;
  scannedBy?: string;
  scannedByRole?: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string; // e.g. "WW-SPT-108"
  memberId?: string;
  requesterName: string;
  phone: string;
  category: SupportCategory;
  title: string;
  description: string;
  priority: Priority;
  status: SupportStatus;
  assignedTo?: string;
  telegramId?: string | number;
  createdAt: string;
  updatedAt: string;
  isConfidential: boolean;
  notes: {
    id: string;
    author: string;
    text: string;
    date: string;
  }[];
}

export interface ServiceSession {
  id: string;
  nameAm: string;
  nameEn: string;
  dayAm: string;
  gradeAm: string;
  timeRange: string;
  departmentResponsible: string;
  isActive: boolean;
}

export interface LeaveRequest {
  id: string;
  requestNumber: string;
  memberId?: string;
  studentName: string;
  studentCode?: string;
  telegramId?: number;
  leaveType: string;
  duration: string;
  startDate?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  createdAt: string;
}

