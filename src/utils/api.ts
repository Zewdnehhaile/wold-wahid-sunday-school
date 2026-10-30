/**
 * Unified API Client for Wold-Wahid Sunday School
 * Seamlessly dispatches requests to:
 * - Production Render backend (https://wold-wahid-sunday-school.onrender.com) when hosted on Vercel or external static domains
 * - Local / relative /api endpoints when running full-stack
 */

export const RENDER_BACKEND_URL = 'https://wold-wahid-sunday-school.onrender.com';

export function getApiEndpointUrl(endpoint: string): string {
  const clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // 1. Explicit environment variable override
  if (import.meta.env.VITE_BACKEND_URL) {
    return `${import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '')}${clean}`;
  }

  // 2. If running on Vercel or external static domain, route directly to Render backend
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (
      hostname.includes('vercel.app') ||
      hostname.includes('web.app') ||
      hostname.includes('firebaseapp.com') ||
      hostname.includes('github.io') ||
      hostname.includes('run.app')
    ) {
      return `${RENDER_BACKEND_URL}${clean}`;
    }
  }

  // 3. Otherwise use relative endpoint (handles local Express dev server)
  return clean;
}

export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const targetUrl = getApiEndpointUrl(endpoint);

  try {
    const res = await fetch(targetUrl, options);
    // If relative endpoint returned 404 (e.g. static preview without backend proxy), fallback to Render
    if (!res.ok && res.status === 404 && !targetUrl.startsWith('http')) {
      console.warn(`[apiFetch] Endpoint 404 at ${targetUrl}, falling back to Render backend...`);
      return await fetch(`${RENDER_BACKEND_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`, options);
    }
    return res;
  } catch (err) {
    // Network error on relative path: fallback to Render backend
    if (!targetUrl.startsWith('http')) {
      console.warn(`[apiFetch] Network error at ${targetUrl}, falling back to Render backend...`, err);
      return await fetch(`${RENDER_BACKEND_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`, options);
    }
    throw err;
  }
}
