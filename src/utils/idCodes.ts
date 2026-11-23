import { Member, SundaySchoolDepartment } from '../types';

export const DEPT_ID_PREFIXES: Record<SundaySchoolDepartment, string> = {
  education: 'EDU',
  choir: 'MEZ',
  abnet: 'ABN',
  arts: 'ART',
  discipline: 'DIS',
  family: 'FAM',
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
  if (val === 'family' || val.includes('family') || val.includes('ቤተሰብ')) return 'family';
  if (val === 'general' || val.includes('general') || val.includes('አጠቃላይ')) return 'general';
  return 'general';
}

export function normalizeStudentCode(code?: string): string {
  return String(code || '')
    .trim()
    .replace(/[\s\-_]+/g, '')
    .toUpperCase();
}

export function isDepartmentShortCode(code?: string): boolean {
  const norm = normalizeStudentCode(code);
  return /^(EDU|MEZ|ABN|ART|DIS|FAM|GEN)\d{3,}$/.test(norm);
}

export function studentCodesMatch(a?: string, b?: string): boolean {
  const na = normalizeStudentCode(a);
  const nb = normalizeStudentCode(b);
  if (!na || !nb) return false;
  return na === nb;
}

export function getDepartmentPrefix(rawDept?: string): string {
  const key = resolveDepartmentKey(rawDept);
  return DEPT_ID_PREFIXES[key] || 'GEN';
}

export function suggestNextDepartmentCode(
  rawDept: string | undefined,
  existingMembers: Pick<Member, 'code' | 'status' | 'department'>[]
): string {
  const prefix = getDepartmentPrefix(rawDept);
  let maxNum = 0;

  for (const m of existingMembers) {
    const norm = normalizeStudentCode(m.code);
    if (norm.startsWith(prefix)) {
      const suffix = norm.slice(prefix.length);
      if (/^\d+$/.test(suffix)) {
        const parsed = parseInt(suffix, 10);
        if (!Number.isNaN(parsed) && parsed > maxNum) {
          maxNum = parsed;
        }
      }
    }
  }

  const nextNum = maxNum + 1;
  return `${prefix}${String(nextNum).padStart(3, '0')}`;
}
