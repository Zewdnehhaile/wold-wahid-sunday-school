import { AVATAR_MALE, AVATAR_FEMALE } from '../data/initialData';

export function getPhotoUrl(raw: string | undefined, gender?: 'male' | 'female'): string {
  if (!raw) return gender === 'female' ? AVATAR_FEMALE : AVATAR_MALE;

  const isTg = raw.startsWith('tg_file:');
  const isProxy = raw.startsWith('/api/telegram/file/');
  const isData = raw.startsWith('data:');
  const isFull = raw.startsWith('http');
  const isBrokenLocal = raw.includes('src/assets/') || raw.includes('assets/images/');

  if (isData || isFull) return raw;
  if (isBrokenLocal) return gender === 'female' ? AVATAR_FEMALE : AVATAR_MALE;

  // Production backend is hosted on Render
  const prodBackendUrl = 'https://wold-wahid-sunday-school.onrender.com';
  
  // If we are on Vercel or any custom domain (not AI Studio or localhost), we must use the Render backend for API routes
  const isDevEnv = typeof window !== 'undefined' && (window.location.hostname.includes('run.app') || window.location.hostname === 'localhost');
  const baseUrl = isDevEnv ? '' : prodBackendUrl;

  if (isTg) return `${baseUrl}/api/telegram/file/${raw.replace('tg_file:', '')}`;
  if (isProxy) return `${baseUrl}${raw}`;

  return raw;
}
