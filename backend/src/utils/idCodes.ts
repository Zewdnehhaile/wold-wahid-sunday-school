export type SundaySchoolDepartment = 'discipline' | 'education' | 'arts' | 'abnet' | 'choir' | 'general';

export const DEPT_ID_PREFIXES: Record<SundaySchoolDepartment, string> = {
  education: 'EDU',
  choir: 'MEZ',
  abnet: 'ABN',
  arts: 'ART',
  discipline: 'DIS',
  general: 'GEN',
};

export function resolveDepartmentKey(rawDept?: string): SundaySchoolDepartment {
  const val = String(rawDept || '').toLowerCase().trim();
  if (!val) return 'general';
  if (val === 'education' || val.includes('education') || val.includes('ትምህርት')) return 'education';
  if (val === 'choir' || val.includes('choir') || val.includes('መዝሙር')) return 'choir';
  if (val === 'abnet' || val.includes('abnet') || val.includes('አብነት')) return 'abnet';
  if (val === 'arts' || val.includes('art') || val.includes('ኪነ')) return 'arts';
  if (val === 'discipline' || val.includes('discipline') || val.includes('ስነ')) return 'discipline';
  if (val === 'general' || val.includes('general') || val.includes('አጠቃላይ')) return 'general';
  return 'general';
}

export function getDepartmentLabelAm(rawDept?: string): string {
  switch (resolveDepartmentKey(rawDept)) {
    case 'education': return 'ትምህርት ክፍል';
    case 'choir': return 'መዝሙር ክፍል';
    case 'abnet': return 'አብነት ክፍል';
    case 'arts': return 'ኪነ ጥበብ ክፍል';
    case 'discipline': return 'ስነ ስርዓት ክፍል';
    default: return 'አጠቃላይ ክፍል';
  }
}

export function normalizeStudentCode(code?: string): string {
  return String(code || '')
    .trim()
    .replace(/[\s\-_]+/g, '')
    .toUpperCase();
}

export function isDepartmentShortCode(code?: string): boolean {
  const norm = normalizeStudentCode(code);
  return /^(EDU|MEZ|ABN|ART|DIS|GEN)\d{3,}$/.test(norm);
}

export function getDepartmentPrefix(rawDept?: string): string {
  return DEPT_ID_PREFIXES[resolveDepartmentKey(rawDept)] || 'GEN';
}
