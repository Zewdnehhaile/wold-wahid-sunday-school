import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';

// --- Supabase Configuration ---
const supabaseUrl = 'https://heiujpytsdeiggxwwbzt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlaXVqcHl0c2RlaWdneHd3Ynp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2MDM1NTcsImV4cCI6MjEwOTE3OTU1N30.uP0K_OxEycQ5WGh9tvZHxTzPag6lureTrB7a58_rA7g';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export interface MobileStudent {
  id: string;
  code: string;
  fullNameAm: string;
  fullNameEn: string;
  department: string;
  gradeLevel: string;
  status: string;
  photoUrl?: string;
  phone: string;
  role?: 'student' | 'admin';
  christianName?: string;
  password?: string;
}

export interface AttendanceRecordPayload {
  memberCode: string;
  memberNameAm: string;
  sessionName: string;
  method: 'qr' | 'manual';
  timestamp: string;
  date: string;
}

// --- Supabase Direct Queries (No Mock Fallbacks) ---

export const checkAdminLogin = async (phone: string): Promise<any | null> => {
  const cleanPhone = phone.replace(/\D/g, '').slice(-9);
  
  const { data, error } = await supabase
    .from('admins')
    .select('*')
    .ilike('phone', `%${cleanPhone}%`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Supabase admin check error:', error);
    return null;
  }
  return data;
};

export const adminLogin = async (phone: string, password: string): Promise<any | null> => {
  const cleanPhone = phone.replace(/\D/g, '').slice(-9);
  const cleanPass = password.trim();

  const { data, error } = await supabase
    .from('admins')
    .select('*')
    .ilike('phone', `%${cleanPhone}%`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Supabase admin login error:', error);
    throw new Error('Database connection error');
  }

  if (!data) {
    throw new Error('Admin not found');
  }

  if (data.password !== cleanPass) {
    throw new Error('Invalid password');
  }

  return { success: true, role: data.role, admin: data };
};

export const studentLogin = async (identifier: string): Promise<any | null> => {
  const raw = String(identifier || '').trim();
  const cleanPhone = raw.replace(/\D/g, '').slice(-9);
  const upper = raw.toUpperCase();

  // Query by code OR phone
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .or(`code.eq.${upper},phone.ilike.%${cleanPhone}%`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Supabase student login error:', error);
    throw new Error('Database connection error');
  }

  if (!data) {
    throw new Error('Student not found');
  }

  return { success: true, student: data };
};

export const getStudentProfile = async (identifier: string): Promise<MobileStudent | null> => {
  const raw = String(identifier || '').trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  const cleanPhone = raw.replace(/\D/g, '').slice(-9);

  const { data, error } = await supabase
    .from('students')
    .select('*')
    .or(`code.eq.${upper},phone.ilike.%${cleanPhone}%,id.eq.${raw}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Supabase profile error:', error);
    return null;
  }
  return data;
};

// --- Real Actions (Supabase) ---

export const submitLeaveRequest = async (leaveData: any) => {
  const { data, error } = await supabase.from('leave_requests').insert([leaveData]).select();
  if (error) throw error;
  return { success: true, id: data[0]?.id };
};

export const submitAttendance = async (record: AttendanceRecordPayload) => {
  const { data, error } = await supabase.from('attendance').insert([record]).select();
  if (error) throw error;
  return { success: true, id: data[0]?.id };
};

export const submitRegistration = async (registrationData: any) => {
  const { data, error } = await supabase.from('registrations').insert([registrationData]).select();
  if (error) throw error;
  return { success: true, id: data[0]?.id };
};

export const getSupportTickets = async (studentCode: string) => {
  const { data, error } = await supabase.from('support_tickets').select('*').eq('memberCode', studentCode);
  if (error) return [];
  return data;
};

export const submitSupportTicket = async (ticketData: any) => {
  const { data, error } = await supabase.from('support_tickets').insert([ticketData]).select();
  if (error) throw error;
  return { success: true, id: data[0]?.id };
};

export const getAttendanceHistory = async (studentCode: string) => {
  const { data, error } = await supabase.from('attendance').select('*').eq('memberCode', studentCode);
  if (error) return [];
  return data;
};

export const getAllSupportTickets = async () => {
  const { data, error } = await supabase.from('support_tickets').select('*');
  if (error) return [];
  return data;
};

export const getAllRegistrations = async () => {
  const { data, error } = await supabase.from('registrations').select('*');
  if (error) return [];
  return data;
};