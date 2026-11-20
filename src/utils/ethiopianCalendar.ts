/**
 * Ethiopian Calendar Converter (የኢትዮጵያ ዘመን አቆጣጠር)
 * Converts Gregorian dates to Ethiopian Calendar format with Amharic month names and day names.
 */

const ETHIOPIAN_MONTHS = [
  'መስከረም', // 1
  'ጥቅምት',  // 2
  'ኅዳር',   // 3
  'ታኅሣሥ',  // 4
  'ጥር',    // 5
  'የካቲት',  // 6
  'መጋቢት',  // 7
  'ሚያዝያ',  // 8
  'ግንቦት',  // 9
  'ሰኔ',    // 10
  'ሐምሌ',   // 11
  'ነሐሴ',   // 12
  'ጳጉሜን',  // 13
];

const ETHIOPIAN_DAYS = [
  'እሁድ',
  'ሰኞ',
  'ማክሰኞ',
  'ረቡዕ',
  'ሐሙስ',
  'አርብ',
  'ቅዳሜ',
];

export interface EthiopianDate {
  year: number;
  month: number;
  monthName: string;
  day: number;
  dayName: string;
  formatted: string;
}

/**
 * Converts a Gregorian Date to an Ethiopian Date
 */
export function toEthiopianDate(gregorianDateInput?: Date | string): EthiopianDate {
  const gDate = gregorianDateInput
    ? (typeof gregorianDateInput === 'string' ? new Date(gregorianDateInput) : gregorianDateInput)
    : new Date();

  const gYear = gDate.getFullYear();
  const gMonth = gDate.getMonth(); // 0-11
  const gDay = gDate.getDate();
  const dayOfWeek = gDate.getDay();

  // Reference epoch conversion
  // Ethiopian new year falls on Sep 11 (or Sep 12 in Gregorian leap years preceding Ethiopian leap year)
  const isLeapGregorian = (gYear % 4 === 0 && gYear % 100 !== 0) || (gYear % 400 === 0);
  
  // Calculate Ethiopian Year
  let ethYear = gYear - 8;
  const newYearDay = ((ethYear + 1) % 4 === 0) ? 12 : 11;

  // Check if before Ethiopian New Year (Sep 11)
  const isBeforeNewYear = gMonth < 8 || (gMonth === 8 && gDay < newYearDay);
  if (isBeforeNewYear) {
    ethYear = gYear - 8;
  } else {
    ethYear = gYear - 7;
  }

  // Days in Gregorian months
  const gMonthDays = [31, isLeapGregorian ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // Calculate day of Gregorian year (1-based)
  let dayOfYear = gDay;
  for (let i = 0; i < gMonth; i++) {
    dayOfYear += gMonthDays[i];
  }

  // Day of year for Sep 11
  let sep11Day = newYearDay; // Day in Sep
  for (let i = 0; i < 8; i++) {
    sep11Day += gMonthDays[i];
  }

  let ethMonth = 1;
  let ethDay = 1;

  if (dayOfYear >= sep11Day) {
    // Meskerem 1 onwards in the current Ethiopian year
    const diff = dayOfYear - sep11Day;
    ethMonth = Math.floor(diff / 30) + 1;
    ethDay = (diff % 30) + 1;
  } else {
    // Before Ethiopian New Year: Part of previous Ethiopian year
    // Pagume is 5 or 6 days
    const ethLeap = (ethYear % 4 === 3);
    const pagumeDays = ethLeap ? 6 : 5;
    
    // Sep 11 of previous year to end of year days
    const prevYearDays = (gYear - 1) % 4 === 0 ? 366 : 365;
    const daysFromPrevNewYear = (prevYearDays - sep11Day) + dayOfYear;
    
    ethMonth = Math.floor(daysFromPrevNewYear / 30) + 1;
    ethDay = (daysFromPrevNewYear % 30) + 1;

    if (ethMonth > 13) {
      ethMonth = 13;
      if (ethDay > pagumeDays) ethDay = pagumeDays;
    }
  }

  // Safety clamps
  if (ethMonth < 1) ethMonth = 1;
  if (ethMonth > 13) ethMonth = 13;
  if (ethDay < 1) ethDay = 1;
  if (ethMonth === 13 && ethDay > 6) ethDay = 6;
  if (ethMonth < 13 && ethDay > 30) ethDay = 30;

  const monthName = ETHIOPIAN_MONTHS[ethMonth - 1] || 'ጥቅምት';
  const dayName = ETHIOPIAN_DAYS[dayOfWeek] || 'እሁድ';

  return {
    year: ethYear,
    month: ethMonth,
    monthName,
    day: ethDay,
    dayName,
    formatted: `${monthName} ${ethDay} ቀን ${ethYear} ዓ.ም`,
  };
}

/**
 * Returns formatted Ethiopian date string e.g. "ጥቅምት 12 ቀን 2017 ዓ.ም"
 */
export function formatEthiopianDate(dateInput?: Date | string): string {
  try {
    const eth = toEthiopianDate(dateInput);
    return eth.formatted;
  } catch {
    return 'ጥቅምት 12 ቀን 2017 ዓ.ም';
  }
}

/**
 * Returns Ethiopian time string. 
 * In Ethiopia, the clock starts at 6:00 AM (Gregorian) which is 12:00 (Ethiopian).
 */
export function formatEthiopianTime(dateInput?: Date | string): string {
  const date = dateInput
    ? (typeof dateInput === 'string' ? new Date(dateInput) : dateInput)
    : new Date();

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();

  // Ethiopian time is 6 hours behind Gregorian for the cycle
  // 6:00 AM -> 12:00 (Day)
  // 7:00 AM -> 01:00 (Day)
  // ...
  // 6:00 PM -> 12:00 (Night)
  // 7:00 PM -> 01:00 (Night)
  
  let ethHours = (hours >= 6) ? hours - 6 : hours + 18;
  const isNight = ethHours >= 12;
  if (ethHours > 12) ethHours -= 12;
  if (ethHours === 0) ethHours = 12;

  const pad = (n: number) => n.toString().padStart(2, '0');
  const period = isNight ? 'ከምሽቱ' : 'ከቀኑ';
  
  return `${period} ${ethHours}:${pad(minutes)}:${pad(seconds)}`;
}

export interface BahireHasabEvent {
  id: string;
  nameAm: string;
  nameEn: string;
  category: 'fast' | 'feast';
  isMovable: boolean;
  ethMonth: number;
  ethMonthName: string;
  ethDay: number;
  ethDateFormatted: string;
  gregorianIso: string;
  gregorianFormatted: string;
  noteAm: string;
}

export interface BahireHasabResult {
  ethYear: number;
  ameteAlem: number;
  wengelawi: string;
  wengelawiEn: string;
  newYearDayName: string;
  meteneRabit: number;
  wenber: number;
  abektie: number;
  metqi: number;
  bealeMetqiStr: string;
  mebajaHamer: number;
  events: BahireHasabEvent[];
}

export function ethiopianToGregorian(ethYear: number, ethMonth: number, ethDay: number): Date {
  const gYearStart = ethYear + 7;
  const sepDay = ethYear % 4 === 0 ? 12 : 11;
  const d = new Date(Date.UTC(gYearStart, 8, sepDay));
  const offset = (ethMonth - 1) * 30 + (ethDay - 1);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

function addEthDays(m: number, d: number, offset: number): { month: number; day: number } {
  const total = (m - 1) * 30 + (d - 1) + offset;
  return {
    month: Math.floor(total / 30) + 1,
    day: (total % 30) + 1,
  };
}

function formatGregShort(d: Date): string {
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Computes complete Ethiopian Orthodox Tewahedo Bahire Hasab (ባሕረ ሐሳብ)
 * values, movable fasts/feasts, and key fixed feasts for a given Ethiopian year.
 */
export function computeBahireHasab(ethYear: number): BahireHasabResult {
  const DAYS_MON_FIRST = ['ሰኞ', 'ማክሰኞ', 'ረቡዕ', 'ሐሙስ', 'አርብ', 'ቅዳሜ', 'እሁድ'];
  const TEWSAK = [6, 5, 4, 3, 2, 8, 7]; // Mon=6, Tue=5, Wed=4, Thu=3, Fri=2, Sat=8, Sun=7
  const WENGELAWI_AM = ['ዮሐንስ', 'ማቴዎስ', 'ማርቆስ', 'ሉቃስ'];
  const WENGELAWI_EN = ['St. John', 'St. Matthew', 'St. Mark', 'St. Luke'];

  const ameteAlem = 5500 + ethYear;
  const meteneRabit = Math.floor(ameteAlem / 4);
  const nyIdx = (ameteAlem + meteneRabit) % 7; // 0=Mon..6=Sun
  const newYearDayName = DAYS_MON_FIRST[nyIdx];
  const wengelawiIdx = ameteAlem % 4;

  const wenber = (ameteAlem - 1) % 19;
  const abektie = (wenber * 11) % 30;
  const metqi = abektie === 0 ? 30 : 30 - abektie;
  const metqiMonth = metqi > 14 ? 1 : 2; // 1=Meskerem, 2=Tikimt
  const metqiWeekdayIdx = (nyIdx + (metqiMonth - 1) * 30 + (metqi - 1)) % 7;
  const tewsak = TEWSAK[metqiWeekdayIdx];
  const mebajaHamer = metqi + tewsak;

  const neneweBaseMonth = metqiMonth === 1 ? 5 : 6; // Tir or Yekatit
  const neneweMonth = mebajaHamer > 30 ? neneweBaseMonth + 1 : neneweBaseMonth;
  const neneweDay = mebajaHamer > 30 ? mebajaHamer - 30 : mebajaHamer;

  const makeEvent = (
    id: string,
    nameAm: string,
    nameEn: string,
    category: 'fast' | 'feast',
    isMovable: boolean,
    ethMonth: number,
    ethDay: number,
    noteAm: string
  ): BahireHasabEvent => {
    const gDate = ethiopianToGregorian(ethYear, ethMonth, ethDay);
    const ethMonthName = ETHIOPIAN_MONTHS[ethMonth - 1] || '';
    return {
      id,
      nameAm,
      nameEn,
      category,
      isMovable,
      ethMonth,
      ethMonthName,
      ethDay,
      ethDateFormatted: `${ethMonthName} ${ethDay}`,
      gregorianIso: gDate.toISOString().split('T')[0],
      gregorianFormatted: formatGregShort(gDate),
      noteAm,
    };
  };

  const abiy = addEthDays(neneweMonth, neneweDay, 14);
  const debreZeit = addEthDays(neneweMonth, neneweDay, 41);
  const hosanna = addEthDays(neneweMonth, neneweDay, 62);
  const siklet = addEthDays(neneweMonth, neneweDay, 67);
  const tinsae = addEthDays(neneweMonth, neneweDay, 69);
  const rikbe = addEthDays(neneweMonth, neneweDay, 93);
  const erget = addEthDays(neneweMonth, neneweDay, 108);
  const peraklitos = addEthDays(neneweMonth, neneweDay, 118);
  const hawaryat = addEthDays(neneweMonth, neneweDay, 119);

  // Genna (ልደት) falls on Tahsas 28 in Zemene Yohannes (year after Pagume 6 leap)
  const gennaDay = ethYear % 4 === 0 ? 28 : 29;

  const events: BahireHasabEvent[] = [
    // Fixed & Movable combined chronologically within the Ethiopian Year
    makeEvent('enkutatash', 'እንቁጣጣሽ (አዲስ ዓመት)', 'Ethiopian New Year', 'feast', false, 1, 1, `ዘመነ ${WENGELAWI_AM[wengelawiIdx]} (${newYearDayName})`),
    makeEvent('meskel', 'በዓለ መስቀል', 'Feast of the Holy Cross (Meskel)', 'feast', false, 1, 17, 'የደመራ እና የመስቀል በዓል'),
    makeEvent('tsige', 'ጾመ ጽጌ መግቢያ', 'Fast of Tsige Begins', 'fast', false, 1, 26, 'እስከ ኅዳር 5 የሚቆይ ጾም'),
    makeEvent('nebiyat', 'ጾመ ነቢያት (የገና ጾም)', 'Nativity Fast Begins', 'fast', false, 3, 15, 'የጌታችን ልደት ጾም መግቢያ (43 ቀናት)'),
    makeEvent('genna', 'በዓለ ልደት (ገና)', 'Nativity / Christmas (Genna)', 'feast', false, 4, gennaDay, 'የጌታችን የመድኃኒታችን የልደት በዓል'),
    makeEvent('timket', 'በዓለ ጥምቀት', 'Epiphany (Timket)', 'feast', false, 5, 11, 'ጥር 10 ከተራ · ጥር 11 ጥምቀት'),
    makeEvent('nenewe', 'ጾመ ነነዌ', 'Fast of Nineveh', 'fast', true, neneweMonth, neneweDay, 'የ3 ቀን ጾም (ሰኞ – ረቡዕ)'),
    makeEvent('abiy', 'ዐቢይ ጾም መግቢያ', 'Great Lent Begins', 'fast', true, abiy.month, abiy.day, 'የ55 ቀናት ታላቁ ጾም መግቢያ'),
    makeEvent('debrezeit', 'ደብረ ዘይት', 'Debre Zeit (Mid-Lent)', 'feast', true, debreZeit.month, debreZeit.day, 'የዐቢይ ጾም አጋማሽ እሁድ'),
    makeEvent('hosanna', 'ሆሣዕና', 'Palm Sunday (Hosanna)', 'feast', true, hosanna.month, hosanna.day, 'የሰሙነ ሕማማት መግቢያ እሁድ'),
    makeEvent('siklet', 'ስቅለት (ዓርብ)', 'Good Friday (Siklet)', 'fast', true, siklet.month, siklet.day, 'የጌታችን የስቅለት ቀን'),
    makeEvent('tinsae', 'ትንሣኤ (ፋሲካ)', 'Easter (Fasika / Tinsae)', 'feast', true, tinsae.month, tinsae.day, 'የጌታችን የትንሣኤ ታላቅ በዓል'),
    makeEvent('rikbe', 'ርክበ ካህናት', 'Rikbe Kahinat', 'feast', true, rikbe.month, rikbe.day, 'ከትንሣኤ በኋላ 24ኛው ቀን (ረቡዕ)'),
    makeEvent('erget', 'በዓለ ዕርገት', 'Ascension (Erget)', 'feast', true, erget.month, erget.day, 'ከትንሣኤ በኋላ 40ኛው ቀን (ሐሙስ)'),
    makeEvent('peraklitos', 'በዓለ ጰራቅሊጦስ', 'Pentecost (Peraklitos)', 'feast', true, peraklitos.month, peraklitos.day, 'ከትንሣኤ በኋላ 50ኛው ቀን (እሁድ)'),
    makeEvent('hawaryat', 'ጾመ ሐዋርያት (ሰኔ ጾም)', 'Fast of the Apostles Begins', 'fast', true, hawaryat.month, hawaryat.day, 'እስከ ሐምሌ 5 የሚቆይ ጾም'),
    makeEvent('filseta', 'ጾመ ፍልሰታ መግቢያ', 'Fast of Assumption (Filseta)', 'fast', false, 12, 1, 'ከነሐሴ 1 እስከ ነሐሴ 15 (15 ቀናት)'),
    makeEvent('buhe', 'ደብረ ታቦር (ቡሄ)', 'Transfiguration (Buhe)', 'feast', false, 12, 13, 'በዓለ ደብረ ታቦር'),
    makeEvent('kidane', 'ፍልሰታ ለማርያም', 'Assumption of St. Mary', 'feast', false, 12, 16, 'የእመቤታችን ዕርገት በዓል'),
  ];

  return {
    ethYear,
    ameteAlem,
    wengelawi: WENGELAWI_AM[wengelawiIdx],
    wengelawiEn: WENGELAWI_EN[wengelawiIdx],
    newYearDayName,
    meteneRabit,
    wenber,
    abektie,
    metqi,
    bealeMetqiStr: `${ETHIOPIAN_MONTHS[metqiMonth - 1]} ${metqi}`,
    mebajaHamer: mebajaHamer > 30 ? mebajaHamer - 30 : mebajaHamer,
    events,
  };
}

export function getUpcomingBahireHasabEvents(fromDate: Date = new Date(), count = 3): BahireHasabEvent[] {
  const todayIso = fromDate.toISOString().split('T')[0];
  const currentEth = toEthiopianDate(fromDate);
  const currentYearData = computeBahireHasab(currentEth.year);
  const nextYearData = computeBahireHasab(currentEth.year + 1);
  const combined = [...currentYearData.events, ...nextYearData.events]
    .filter((ev) => ev.gregorianIso >= todayIso)
    .sort((a, b) => a.gregorianIso.localeCompare(b.gregorianIso));
  return combined.slice(0, count);
}

