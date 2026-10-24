// Wold Wahid Sunday School Mobile API Client
export const API_BASE_URL = 'https://ais-dev-reccyxuqfinpjq7hy5yle5-147288418331.europe-west2.run.app';

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
}

export interface AttendanceRecordPayload {
  memberCode: string;
  memberNameAm: string;
  sessionName: string;
  method: 'qr' | 'manual';
  timestamp: string;
  date: string;
}

export const submitAttendance = async (record: AttendanceRecordPayload) => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    return await res.json();
  } catch (error) {
    console.error('Offline caching or API error:', error);
    throw error;
  }
};

export const submitRegistration = async (registrationData: any) => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/registrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registrationData),
    });
    return await res.json();
  } catch (error) {
    console.error('Registration API error:', error);
    throw error;
  }
};
