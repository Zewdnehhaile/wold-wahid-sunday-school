// API Configuration for Wold Wahid Sunday School

export const BACKEND_URL = 'https://wold-wahid-sunday-school.onrender.com';

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  // If we are in AI Studio or localhost, we can use relative paths
  const isDevEnv = typeof window !== 'undefined' && 
    (window.location.hostname.includes('run.app') || window.location.hostname === 'localhost');
    
  if (isDevEnv) return cleanPath;
  
  // Otherwise (Vercel, etc.), use the absolute backend URL
  return `${BACKEND_URL}${cleanPath}`;
}
