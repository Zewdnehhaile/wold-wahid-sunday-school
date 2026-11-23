import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { Resvg } from '@resvg/resvg-js';
import { getDepartmentLabelAm } from './idCodes';

const CARD_WIDTH = 1016;
const CARD_HEIGHT = 638;

let cachedLogoDataUrl: string | null = null;
let cachedFontFiles: string[] | null = null;

function getFontFiles(): string[] {
  if (cachedFontFiles && cachedFontFiles.length > 0) return cachedFontFiles;
  const fontDirs = [
    path.resolve(__dirname, '../../fonts'),
    path.resolve(process.cwd(), 'fonts'),
    path.resolve(process.cwd(), 'backend/fonts'),
    path.resolve(__dirname, '../../../backend/fonts'),
  ];
  const bundledNames = [
    'NotoSansEthiopic-Regular.ttf',
    'NotoSansEthiopic-Bold.ttf',
    'DejaVuSans.ttf',
    'DejaVuSans-Bold.ttf',
  ];
  const candidates: string[] = [];
  for (const dir of fontDirs) {
    for (const name of bundledNames) {
      candidates.push(path.join(dir, name));
    }
  }
  candidates.push(
    '/usr/share/fonts/truetype/noto/NotoSansEthiopic-Regular.ttf',
    '/usr/share/fonts/truetype/noto/NotoSansEthiopic-Bold.ttf',
    '/usr/share/fonts/truetype/noto/NotoSerifEthiopic-Regular.ttf',
    '/usr/share/fonts/truetype/noto/NotoSerifEthiopic-Bold.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSerif.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  );
  const seen = new Set<string>();
  const resolved: string[] = [];
  for (const p of candidates) {
    const fileName = path.basename(p);
    if (!seen.has(fileName) && fs.existsSync(p)) {
      seen.add(fileName);
      resolved.push(p);
    }
  }
  cachedFontFiles = resolved;
  return cachedFontFiles;
}

function getLogoDataUrl(): string {
  if (cachedLogoDataUrl !== null) return cachedLogoDataUrl;
  const candidates = [
    path.resolve(process.cwd(), 'public/assets/aistudio/image_6d91f294.png'),
    path.resolve(process.cwd(), 'dist/assets/aistudio/image_6d91f294.png'),
    path.resolve(process.cwd(), '../public/assets/aistudio/image_6d91f294.png'),
    path.resolve(process.cwd(), '../dist/assets/aistudio/image_6d91f294.png'),
    path.resolve(__dirname, '../../../public/assets/aistudio/image_6d91f294.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const b64 = fs.readFileSync(p).toString('base64');
        cachedLogoDataUrl = `data:image/png;base64,${b64}`;
        return cachedLogoDataUrl;
      } catch {}
    }
  }
  cachedLogoDataUrl = '';
  return '';
}

function escapeXml(str?: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function makeAvatarDataUrl(gender?: string): string {
  const accent = gender === 'female' ? '#ec4899' : '#f59e0b';
  const avatarSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="240" viewBox="0 0 100 120"><rect width="100" height="120" fill="#0f172a"/><path d="M50 48a17 17 0 1 0 0-34 17 17 0 0 0 0 34zm0 10c-20 0-38 11-38 28v16h76V86c0-17-18-28-38-28z" fill="${accent}"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(avatarSvg, 'utf8').toString('base64')}`;
}

async function resolvePhotoDataUrl(photoUrl?: string, gender?: string): Promise<string> {
  const raw = String(photoUrl || '').trim();
  if (!raw || raw === 'None') return makeAvatarDataUrl(gender);

  if (raw.startsWith('data:image/')) {
    return raw;
  }

  // Local public asset path
  if (raw.startsWith('/assets/')) {
    const rel = raw.replace(/^\/+/, '');
    const localCandidates = [
      path.resolve(process.cwd(), 'public', rel),
      path.resolve(process.cwd(), '../public', rel),
      path.resolve(__dirname, '../../../public', rel),
    ];
    const localPath = localCandidates.find((p) => fs.existsSync(p));
    if (localPath) {
      try {
        const ext = path.extname(localPath).toLowerCase() === '.png' ? 'png' : 'jpeg';
        const b64 = fs.readFileSync(localPath).toString('base64');
        return `data:image/${ext};base64,${b64}`;
      } catch {}
    }
  }

  // Telegram file proxy or external HTTP URL
  let fetchUrl = raw;
  if (raw.startsWith('tg_file:')) {
    const fileId = raw.replace('tg_file:', '').trim();
    const token = process.env.TELEGRAM_BOT_TOKEN || '';
    if (token && fileId) {
      try {
        const infoRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
        const infoJson: any = await infoRes.json();
        if (infoJson?.ok && infoJson.result?.file_path) {
          fetchUrl = `https://api.telegram.org/file/bot${token}/${infoJson.result.file_path}`;
        }
      } catch {}
    }
  }

  if (fetchUrl.startsWith('http://') || fetchUrl.startsWith('https://')) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(fetchUrl, { signal: controller.signal });
      clearTimeout(t);
      if (res.ok) {
        const ct = res.headers.get('content-type') || 'image/jpeg';
        if (ct.startsWith('image/')) {
          const buf = Buffer.from(await res.arrayBuffer());
          return `data:${ct};base64,${buf.toString('base64')}`;
        }
      }
    } catch {}
  }

  return makeAvatarDataUrl(gender);
}

function wrapTextLines(input: string, maxChars: number, maxLines: number): string[] {
  const words = String(input || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';

  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = w.slice(0, maxChars);
      if (lines.length >= maxLines) break;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  return lines.slice(0, maxLines);
}

function renderSvgToPng(svg: string): Buffer {
  const fontFiles = getFontFiles();
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: CARD_WIDTH },
    font: {
      fontFiles,
      loadSystemFonts: true,
      defaultFontFamily: 'Noto Sans Ethiopic',
    },
  });
  const pngData = resvg.render();
  return pngData.asPng();
}

export interface StudentCardInput {
  code: string;
  fullNameAm?: string;
  fullNameEn?: string;
  department?: string;
  phone?: string;
  photoUrl?: string;
  gender?: string;
  bloodGroup?: string;
  registeredDate?: string;
  subcity?: string;
  address?: string;
  emergencyContact?: {
    name?: string;
    phone?: string;
    relation?: string;
  };
  emergencyName?: string;
  emergencyPhone?: string;
  emergencyRelation?: string;
}

export async function renderDualIdCardPngs(student: StudentCardInput): Promise<{ front: Buffer; back: Buffer }> {
  const code = String(student.code || 'EDU001').trim().toUpperCase();
  const fullNameAm = String(student.fullNameAm || student.fullNameEn || 'ተማሪ').trim();
  const fullNameEn = String(student.fullNameEn || fullNameAm).trim();
  const deptAm = getDepartmentLabelAm(student.department);
  const phone = String(student.phone || 'N/A').trim();
  const bloodGroup = String(student.bloodGroup || 'O+').trim();
  const regDate = String(student.registeredDate || new Date().toISOString().split('T')[0]).split('T')[0];

  const emergName = student.emergencyContact?.name || student.emergencyName || 'የቤተሰብ አባል';
  const emergRel = student.emergencyContact?.relation || student.emergencyRelation || 'ቤተሰብ';
  const emergPhone = student.emergencyContact?.phone || student.emergencyPhone || 'N/A';
  const address = String(student.subcity || student.address || 'አዲስ አበባ').trim();

  const [logoDataUrl, photoDataUrl, qrDataUrl] = await Promise.all([
    Promise.resolve(getLogoDataUrl()),
    resolvePhotoDataUrl(student.photoUrl, student.gender),
    QRCode.toDataURL(code, { width: 220, margin: 1 }),
  ]);

  const amNameLines = wrapTextLines(fullNameAm, 22, 2);
  const enNameLines = wrapTextLines(fullNameEn, 26, 1);

  const fontStack = 'Noto Sans Ethiopic, DejaVu Sans, sans-serif';

  const frontSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
  <defs>
    <linearGradient id="cardBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="50%" stop-color="#062414"/>
      <stop offset="100%" stop-color="#022c22"/>
    </linearGradient>
    <linearGradient id="goldBar" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#d97706"/>
      <stop offset="50%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
    <clipPath id="logoClip">
      <circle cx="96" cy="90" r="40"/>
    </clipPath>
    <clipPath id="photoClip">
      <rect x="48" y="190" width="196" height="248" rx="22"/>
    </clipPath>
  </defs>

  <rect x="2" y="2" width="${CARD_WIDTH - 4}" height="${CARD_HEIGHT - 4}" rx="34" fill="url(#cardBg)" stroke="#f59e0b" stroke-width="5"/>
  <rect x="2" y="2" width="${CARD_WIDTH - 4}" height="18" rx="8" fill="url(#goldBar)"/>

  ${logoDataUrl
    ? `<image href="${escapeXml(logoDataUrl)}" x="56" y="50" width="80" height="80" clip-path="url(#logoClip)" preserveAspectRatio="xMidYMid slice"/>`
    : `<circle cx="96" cy="90" r="40" fill="#09351c"/>`
  }
  <circle cx="96" cy="90" r="40" fill="none" stroke="#fbbf24" stroke-width="2.5"/>

  <text x="156" y="84" fill="#fbbf24" font-family="${fontStack}" font-size="28" font-weight="700">የወልድ ዋሕድ ሰንበት ት/ቤት</text>
  <text x="156" y="116" fill="#cbd5e1" font-family="${fontStack}" font-size="18" font-weight="600">WOLD WAHID SUNDAY SCHOOL</text>

  <rect x="740" y="56" width="228" height="58" rx="14" fill="#f59e0b" fill-opacity="0.18" stroke="#f59e0b" stroke-opacity="0.55" stroke-width="2"/>
  <text x="854" y="95" text-anchor="middle" fill="#fcd34d" font-family="DejaVu Sans, monospace" font-size="30" font-weight="700">${escapeXml(code)}</text>

  <line x1="48" y1="152" x2="968" y2="152" stroke="#1e293b" stroke-width="2"/>

  <image href="${escapeXml(photoDataUrl)}" x="48" y="190" width="196" height="248" clip-path="url(#photoClip)" preserveAspectRatio="xMidYMid slice"/>
  <rect x="48" y="190" width="196" height="248" rx="22" fill="none" stroke="#fbbf24" stroke-opacity="0.7" stroke-width="3.5"/>

  <rect x="176" y="394" width="58" height="34" rx="8" fill="#020617" fill-opacity="0.88" stroke="#fbbf24" stroke-opacity="0.5" stroke-width="1.5"/>
  <text x="205" y="418" text-anchor="middle" fill="#fcd34d" font-family="DejaVu Sans, sans-serif" font-size="18" font-weight="700">${escapeXml(bloodGroup)}</text>

  <text x="276" y="232" fill="#ffffff" font-family="${fontStack}" font-size="34" font-weight="700">${escapeXml(amNameLines[0])}</text>
  ${amNameLines[1] ? `<text x="276" y="274" fill="#ffffff" font-family="${fontStack}" font-size="32" font-weight="700">${escapeXml(amNameLines[1])}</text>` : ''}
  <text x="276" y="${amNameLines[1] ? 314 : 274}" fill="#cbd5e1" font-family="${fontStack}" font-size="22" font-weight="500">${escapeXml(enNameLines[0])}</text>

  <text x="276" y="370" fill="#fbbf24" font-family="${fontStack}" font-size="23" font-weight="700">ክፍል:</text>
  <text x="358" y="370" fill="#e2e8f0" font-family="${fontStack}" font-size="23" font-weight="600">${escapeXml(deptAm)}</text>

  <text x="276" y="416" fill="#fbbf24" font-family="${fontStack}" font-size="23" font-weight="700">ስልክ:</text>
  <text x="358" y="416" fill="#e2e8f0" font-family="DejaVu Sans, monospace" font-size="23" font-weight="600">${escapeXml(phone)}</text>

  <rect x="742" y="194" width="224" height="248" rx="22" fill="#ffffff"/>
  <image href="${escapeXml(qrDataUrl)}" x="760" y="206" width="188" height="188"/>
  <text x="854" y="424" text-anchor="middle" fill="#0f172a" font-family="DejaVu Sans, monospace" font-size="19" font-weight="700">SCAN ID</text>

  <line x1="48" y1="538" x2="968" y2="538" stroke="#1e293b" stroke-width="2"/>
  <text x="52" y="586" fill="#94a3b8" font-family="${fontStack}" font-size="20">ተመዝግቧል: ${escapeXml(regDate)}</text>
  <text x="964" y="586" text-anchor="end" fill="#fbbf24" font-family="${fontStack}" font-size="21" font-weight="700">የአባልነት መታወቂያ (OFFICIAL ID)</text>
</svg>`.trim();

  const backSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
  <defs>
    <linearGradient id="cardBgBack" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="50%" stop-color="#062414"/>
      <stop offset="100%" stop-color="#022c22"/>
    </linearGradient>
    <linearGradient id="goldBarBack" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#d97706"/>
      <stop offset="50%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
  </defs>

  <rect x="2" y="2" width="${CARD_WIDTH - 4}" height="${CARD_HEIGHT - 4}" rx="34" fill="url(#cardBgBack)" stroke="#f59e0b" stroke-width="5"/>
  <rect x="2" y="2" width="${CARD_WIDTH - 4}" height="18" rx="8" fill="url(#goldBarBack)"/>

  <text x="52" y="88" fill="#fbbf24" font-family="${fontStack}" font-size="28" font-weight="700">የአባልነት ውል እና ደንብ</text>
  <rect x="780" y="52" width="188" height="48" rx="12" fill="#f59e0b" fill-opacity="0.16" stroke="#f59e0b" stroke-opacity="0.5" stroke-width="2"/>
  <text x="874" y="85" text-anchor="middle" fill="#fcd34d" font-family="DejaVu Sans, monospace" font-size="24" font-weight="700">${escapeXml(code)}</text>

  <line x1="52" y1="114" x2="964" y2="114" stroke="#1e293b" stroke-width="2"/>

  <text x="52" y="162" fill="#cbd5e1" font-family="${fontStack}" font-size="22">ይህ ካርድ የወልድ ዋሕድ ሰንበት ት/ቤት አባልነት ማረጋገጫ ሲሆን</text>
  <text x="52" y="198" fill="#cbd5e1" font-family="${fontStack}" font-size="22">ለሶስተኛ ወገን አይተላለፍም።</text>

  <rect x="52" y="244" width="912" height="196" rx="22" fill="#020617" fill-opacity="0.68" stroke="#1e293b" stroke-width="2.5"/>
  <text x="84" y="294" fill="#fcd34d" font-family="${fontStack}" font-size="22" font-weight="700">የአደጋ ጊዜ ተጠሪ (Emergency Contact):</text>
  <text x="84" y="346" fill="#f8fafc" font-family="${fontStack}" font-size="27" font-weight="700">${escapeXml(emergName)} (${escapeXml(emergRel)})</text>
  <text x="84" y="394" fill="#cbd5e1" font-family="DejaVu Sans, monospace" font-size="25" font-weight="600">${escapeXml(emergPhone)}</text>

  <line x1="52" y1="496" x2="964" y2="496" stroke="#1e293b" stroke-width="2"/>
  <text x="52" y="556" fill="#94a3b8" font-family="${fontStack}" font-size="21">አድራሻ፡ ${escapeXml(address)}</text>

  <line x1="680" y1="548" x2="964" y2="548" stroke="#fbbf24" stroke-opacity="0.65" stroke-width="2" stroke-dasharray="8 6"/>
  <text x="822" y="584" text-anchor="middle" fill="#94a3b8" font-family="${fontStack}" font-size="19">የአስተዳዳሪ ፊርማ</text>
</svg>`.trim();

  return {
    front: renderSvgToPng(frontSvg),
    back: renderSvgToPng(backSvg),
  };
}
