export type Language = 'am' | 'en';

export type DayOfWeek = 'friday' | 'saturday' | 'sunday';

export type GradeLevel = 'pre_kg' | 'grade_1_2' | 'grade_3_5' | 'grade_6_9' | 'leaders';

export type SundaySchoolDepartment = 'discipline' | 'education' | 'arts' | 'abnet' | 'choir' | 'family' | 'general';

export type Department = SundaySchoolDepartment;

export type SupportCategory = 'prayer' | 'visitation' | 'welfare' | 'counseling' | 'general';

export type SupportStatus = 'new' | 'assigned' | 'in_contact' | 'resolved' | 'approved' | 'rejected';

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

export interface AdminPermission {
  canAccessSchedule: boolean;
  canAccessMembers: boolean;
  canAccessAttendance: boolean;
  canAccessSupport: boolean;
  canAccessAdmins: boolean;
  canAccessAnalytics: boolean;
  canAccessParents?: boolean;
  canBroadcast?: boolean;
  // Legacy aliases
  takeAttendance?: boolean;
  approveStudents?: boolean;
  manageSupport?: boolean;
  exportReports?: boolean;
}

export interface AdminUser {
  id: string;
  nameAm: string;
  nameEn: string;
  role: UserRole;
  department: SundaySchoolDepartment;
  avatarUrl?: string;
  phone?: string;
  permissions?: AdminPermission;
  password?: string;
  customRoleTitle?: string;
  status?: 'active' | 'suspended';
}

export interface PendingEditSummary {
  oldPhone?: string;
  newPhone?: string;
  oldBirthYear?: string;
  newBirthYear?: string;
  editedField?: string;
  editedFieldLabel?: string;
  oldValue?: string;
  newValue?: string;
  editedAt: string;
}

export interface Member {
  id: string;
  code: string; // e.g. "EDU001", "MEZ001", "ABN001", "ART001", "DIS001", "FAM001", "GEN001"
  legacyCode?: string; // Previous WW-2026-... code preserved for old QR cards
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
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  telegramId?: string | number;
  telegramUsername?: string;
  consecutiveAbsences: number;
  hasEditedProfileOnce?: boolean;
  pendingEditSummary?: PendingEditSummary;
  parentTelegramId?: string;
  parentTelegramIds?: string[];
  parentName?: string;
  parentPhone?: string;
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
  reason?: string;
  approvedBy?: string;
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

export interface DutyRosterItem {
  id: string;
  day: DayOfWeek;
  gradeLevel: GradeLevel | 'all';
  dutyAm: string;
  assigneeName: string;
  assigneePhone?: string;
  notes?: string;
  updatedAt?: string;
}

export interface LessonItem {
  id: string;
  title: string;
  type: 'lesson' | 'mezmur';
  gradeLevel: GradeLevel | 'all';
  summary: string;
  reference?: string;
  linkUrl?: string;
  authorName: string;
  createdAt: string;
}

export interface ParentLinkRequest {
  id: string;
  parentTelegramId: string;
  parentTelegramUsername?: string;
  parentName: string;
  parentPhone: string;
  relation: string;
  studentId: string;
  studentCode: string;
  studentNameAm: string;
  department: string;
  registeredEmergencyName?: string;
  registeredEmergencyPhone?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface StudentExamScore {
  id: string;
  subject: string;
  score: number;
  maxScore: number;
  term: string;
  date: string;
  remark?: string;
}

export interface StudentConductNote {
  id: string;
  type: 'commendation' | 'warning' | 'notice';
  title: string;
  description: string;
  date: string;
  issuer: string;
}

export interface StudentReportDoc {
  studentId: string;
  studentCode: string;
  exams: StudentExamScore[];
  conductNotes: StudentConductNote[];
  updatedAt?: string;
}

export type AuditTargetType =
  | 'student'
  | 'attendance'
  | 'leave'
  | 'support'
  | 'admin'
  | 'schedule'
  | 'broadcast'
  | 'roster'
  | 'lesson'
  | 'parent';

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  targetType: AuditTargetType;
  targetName: string;
  action: string;
  summaryAm: string;
  summaryEn: string;
  timestamp: string;
}
