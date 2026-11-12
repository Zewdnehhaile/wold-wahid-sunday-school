// API Configuration for Wold Wahid Sunday School

export const BACKEND_URL = 'https://ais-pre-reccyxuqfinpjq7hy5yle5-147288418331.europe-west2.run.app';

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  // If we are in AI Studio or localhost, we can use relative paths
  const isDevEnv = typeof window !== 'undefined' && 
    (window.location.hostname.includes('run.app') || window.location.hostname === 'localhost');
    
  if (isDevEnv) return cleanPath;
  
  // Otherwise (Vercel, etc.), use the absolute backend URL
  return `${BACKEND_URL}${cleanPath}`;
}
