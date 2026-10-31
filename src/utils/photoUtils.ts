import { AVATAR_MALE, AVATAR_FEMALE } from '../data/initialData';
import { getApiUrl } from './apiConfig';

export function getPhotoUrl(raw: string | undefined, gender?: 'male' | 'female'): string {
  if (!raw) return gender === 'female' ? AVATAR_FEMALE : AVATAR_MALE;

  const isTg = raw.startsWith('tg_file:');
  const isProxy = raw.startsWith('/api/telegram/file/');
  const isData = raw.startsWith('data:');
  const isFull = raw.startsWith('http');
  const isBrokenLocal = raw.includes('src/assets/') || raw.includes('assets/images/');

  if (isData || isFull) return raw;
  if (isBrokenLocal) return gender === 'female' ? AVATAR_FEMALE : AVATAR_MALE;

  if (isTg) return getApiUrl(`/api/telegram/file/${raw.replace('tg_file:', '')}`);
  if (isProxy) return getApiUrl(raw);

  return raw;
}
