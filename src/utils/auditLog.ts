import { AuditLogEntry, AuditTargetType, UserRole } from '../types';
import { db, collection, addDoc, getDocs, query, where, limit } from '../firebase';

const SUPER_CACHE_KEY = 'ww_audit_super_cache';
const ADMIN_CACHE_KEY = 'ww_audit_admin_cache';
const FETCH_AT_PREFIX = 'ww_audit_fetch_at_';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10-minute cache to minimize Firestore reads

const STUDENT_ACTION_TARGETS: AuditTargetType[] = ['student', 'attendance', 'leave'];

export function filterAuditLogsForRole(entries: AuditLogEntry[], role: UserRole): AuditLogEntry[] {
  const sorted = [...entries].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  if (role === 'super_admin') {
    return sorted;
  }
  // Regular admins MUST NOT see super_admin activity, and only see admin actions on students
  return sorted.filter(
    (e) => e.actorRole === 'admin' && STUDENT_ACTION_TARGETS.includes(e.targetType)
  );
}

export function getCachedAuditLogs(role: UserRole): AuditLogEntry[] {
  try {
    const key = role === 'super_admin' ? SUPER_CACHE_KEY : ADMIN_CACHE_KEY;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? filterAuditLogsForRole(parsed, role) : [];
  } catch {
    return [];
  }
}

function saveAuditCache(role: UserRole, entries: AuditLogEntry[]) {
  try {
    const filtered = filterAuditLogsForRole(entries, role);
    const key = role === 'super_admin' ? SUPER_CACHE_KEY : ADMIN_CACHE_KEY;
    localStorage.setItem(key, JSON.stringify(filtered.slice(0, 60)));
  } catch {}
}

export async function recordAuditLog(
  entry: Omit<AuditLogEntry, 'id' | 'timestamp'>
): Promise<void> {
  const newEntry: AuditLogEntry = {
    ...entry,
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  };

  // Update local cache immediately so UI reflects action with 0 extra reads
  try {
    const superCached = getCachedAuditLogs('super_admin');
    saveAuditCache('super_admin', [newEntry, ...superCached]);
    if (newEntry.actorRole === 'admin' && STUDENT_ACTION_TARGETS.includes(newEntry.targetType)) {
      const adminCached = getCachedAuditLogs('admin');
      saveAuditCache('admin', [newEntry, ...adminCached]);
    }
  } catch {}

  try {
    await addDoc(collection(db, 'audit_logs'), {
      actorId: newEntry.actorId,
      actorName: newEntry.actorName,
      actorRole: newEntry.actorRole,
      targetType: newEntry.targetType,
      targetName: newEntry.targetName,
      action: newEntry.action,
      summaryAm: newEntry.summaryAm,
      summaryEn: newEntry.summaryEn,
      timestamp: newEntry.timestamp,
    });
  } catch {
    // Silent fallback — never expose DB quota or network warnings in UI
  }
}

export async function fetchAuditLogs(role: UserRole, force = false): Promise<AuditLogEntry[]> {
  const cacheKey = role === 'super_admin' ? SUPER_CACHE_KEY : ADMIN_CACHE_KEY;
  const fetchAtKey = `${FETCH_AT_PREFIX}${role}`;

  if (!force) {
    try {
      const lastFetch = Number(localStorage.getItem(fetchAtKey) || '0');
      const hasCache = Boolean(localStorage.getItem(cacheKey));
      if (hasCache && Date.now() - lastFetch < CACHE_TTL_MS) {
        return getCachedAuditLogs(role);
      }
    } catch {}
  }

  try {
    // Query scoped by role so regular admins never pull super_admin log docs
    const q =
      role === 'super_admin'
        ? query(collection(db, 'audit_logs'), limit(60))
        : query(collection(db, 'audit_logs'), where('actorRole', '==', 'admin'), limit(50));

    const snap = await getDocs(q);
    const loaded: AuditLogEntry[] = snap.docs.map((d: any) => {
      const data = d.data();
      return {
        id: d.id,
        actorId: data.actorId || '',
        actorName: data.actorName || 'አስተዳዳሪ',
        actorRole: data.actorRole === 'super_admin' ? 'super_admin' : 'admin',
        targetType: data.targetType || 'student',
        targetName: data.targetName || '',
        action: data.action || '',
        summaryAm: data.summaryAm || '',
        summaryEn: data.summaryEn || '',
        timestamp: data.timestamp || new Date().toISOString(),
      };
    });

    const filtered = filterAuditLogsForRole(loaded, role);
    saveAuditCache(role, filtered);
    try {
      localStorage.setItem(fetchAtKey, String(Date.now()));
    } catch {}
    return filtered;
  } catch {
    return getCachedAuditLogs(role);
  }
}
