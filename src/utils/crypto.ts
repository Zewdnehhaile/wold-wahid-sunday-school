export async function hashPasswordWeb(password: string): Promise<string> {
  const clean = password.trim();
  if (!clean) return '';
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(clean);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.warn('WebCrypto hash fallback:', err);
    return clean;
  }
}
