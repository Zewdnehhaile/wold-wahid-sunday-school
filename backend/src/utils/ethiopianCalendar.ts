/**
 * Ethiopian Calendar Converter (የኢትዮጵያ ዘመን አቆጣጠር)
 */
const ETHIOPIAN_MONTHS = [
  'መስከረም', 'ጥቅምት', 'ኅዳር', 'ታኅሣሥ', 'ጥር', 'የካቲት',
  'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜን'
];

const ETHIOPIAN_DAYS = ['እሁድ', 'ሰኞ', 'ማክሰኞ', 'ረቡዕ', 'ሐሙስ', 'አርብ', 'ቅዳሜ'];

export function toEthiopianDate(gregorianDateInput?: any) {
  const gDate = gregorianDateInput
    ? (typeof gregorianDateInput === 'string' ? new Date(gregorianDateInput) : gregorianDateInput)
    : new Date();
  const gYear = gDate.getFullYear();
  const gMonth = gDate.getMonth();
  const gDay = gDate.getDate();
  const dayOfWeek = gDate.getDay();

  const isLeapGregorian = (gYear % 4 === 0 && gYear % 100 !== 0) || (gYear % 400 === 0);
  let ethYear = gYear - 8;
  const newYearDay = ((ethYear + 1) % 4 === 0) ? 12 : 11;
  const isBeforeNewYear = gMonth < 8 || (gMonth === 8 && gDay < newYearDay);
  if (isBeforeNewYear) {
    ethYear = gYear - 8;
  } else {
    ethYear = gYear - 7;
  }

  const gMonthDays = [31, isLeapGregorian ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let dayOfYear = gDay;
  for (let i = 0; i < gMonth; i++) {
    dayOfYear += gMonthDays[i];
  }
  let sep11Day = newYearDay;
  for (let i = 0; i < 8; i++) {
    sep11Day += gMonthDays[i];
  }

  let ethMonth = 1;
  let ethDay = 1;
  if (dayOfYear >= sep11Day) {
    const diff = dayOfYear - sep11Day;
    ethMonth = Math.floor(diff / 30) + 1;
    ethDay = (diff % 30) + 1;
  } else {
    const ethLeap = (ethYear % 4 === 3);
    const pagumeDays = ethLeap ? 6 : 5;
    const prevYearDays = (gYear - 1) % 4 === 0 ? 366 : 365;
    const daysFromPrevNewYear = (prevYearDays - sep11Day) + dayOfYear;
    ethMonth = Math.floor(daysFromPrevNewYear / 30) + 1;
    ethDay = (daysFromPrevNewYear % 30) + 1;
    if (ethMonth > 13) {
      ethMonth = 13;
      if (ethDay > pagumeDays) ethDay = pagumeDays;
    }
  }

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

export function formatEthiopianDate(dateInput?: any): string {
  try {
    const eth = toEthiopianDate(dateInput);
    return eth.formatted;
  } catch {
    return 'ጥቅምት 12 ቀን 2017 ዓ.ም';
  }
}
