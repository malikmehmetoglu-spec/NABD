// التعامل مع الوقت بتوقيت العيادة، مهما كان توقيت الخادم أو المتصفح.

const MONTHS = [
  "كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران",
  "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول",
];
const WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

type Parts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

function partsIn(date: Date, tz: string): Parts {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
  });
  const get = (t: string) => f.formatToParts(date).find((p) => p.type === t)?.value ?? "0";
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return {
    year: Number(get("year")), month: Number(get("month")), day: Number(get("day")),
    hour: Number(get("hour")), minute: Number(get("minute")), weekday: wd,
  };
}

/** فرق التوقيت (بالدقائق) بين المنطقة الزمنية وUTC في لحظة معينة */
function offsetMinutes(date: Date, tz: string) {
  const p = partsIn(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((asUtc - Math.floor(date.getTime() / 60000) * 60000) / 60000);
}

/** تحويل تاريخ ووقت محليين (بتوقيت العيادة) إلى لحظة UTC */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const first = new Date(guess.getTime() - offsetMinutes(guess, tz) * 60000);
  // تصحيح ثانٍ لأيام تغيير التوقيت الصيفي
  return new Date(guess.getTime() - offsetMinutes(first, tz) * 60000);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** تاريخ اليوم بتوقيت العيادة بصيغة YYYY-MM-DD */
export function todayIn(tz: string, now = new Date()) {
  const p = partsIn(now, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function isoDateIn(iso: string | Date, tz: string) {
  const p = partsIn(new Date(iso), tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** بداية ونهاية يوم كامل بتوقيت العيادة، كلحظات UTC للاستعلام */
export function dayRange(date: string, tz: string) {
  const start = zonedToUtc(date, "00:00", tz);
  const end = zonedToUtc(addDays(date, 1), "00:00", tz);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function monthStart(date: string) {
  return `${date.slice(0, 7)}-01`;
}

export function isValidDate(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

export function formatTime(iso: string, tz: string) {
  const p = partsIn(new Date(iso), tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** "الخميس 12 تشرين الثاني" */
export function formatDayLong(date: string) {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[wd]} ${d} ${MONTHS[m - 1]}`;
}

/** "12 تشرين الثاني 2026" */
export function formatDate(iso: string, tz?: string) {
  const date = tz ? isoDateIn(iso, tz) : iso.slice(0, 10);
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function weekdayShort(date: string) {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]!;
}

export function hourIn(tz: string, now = new Date()) {
  return partsIn(now, tz).hour;
}

export function ageFrom(birthDate: string | null, today: string): number | null {
  if (!birthDate) return null;
  const [by, bm, bd] = birthDate.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age--;
  return age >= 0 ? age : null;
}
