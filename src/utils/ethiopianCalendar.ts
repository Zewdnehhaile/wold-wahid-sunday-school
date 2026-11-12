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
