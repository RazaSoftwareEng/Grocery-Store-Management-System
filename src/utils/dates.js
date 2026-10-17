/**
 * Store time zone helpers. Every "day" in the app (invoice numbers, today's
 * sales, report ranges) is a day in the store time zone setting, not the
 * browser's time zone and not UTC.
 */

let storeTz = 'Asia/Karachi';

function isValidTz(tz) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function setStoreTimeZone(tz) {
  if (tz && isValidTz(tz)) storeTz = tz;
}

export const getStoreTimeZone = () => storeTz;

function parts(date, tz) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const out = {};
  for (const p of f.formatToParts(date)) out[p.type] = p.value;
  return out;
}

/** 'YYYY-MM-DD' of a moment, in the store time zone */
export function dateStr(date = new Date(), tz = storeTz) {
  const p = parts(date instanceof Date ? date : new Date(date), tz);
  return `${p.year}-${p.month}-${p.day}`;
}

export const todayStr = () => dateStr(new Date());

export function addDays(dateString, n) {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export const monthStartStr = () => `${todayStr().slice(0, 8)}01`;

function tzOffsetMs(utcMs, tz) {
  const p = parts(new Date(utcMs), tz);
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - utcMs;
}

/** ISO timestamp of 00:00 on a store-local calendar day */
export function dayStartIso(dateString, tz = storeTz) {
  const [y, m, d] = dateString.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let ts = guess - tzOffsetMs(guess, tz);
  ts = guess - tzOffsetMs(ts, tz);
  return new Date(ts).toISOString();
}

export const nextDayStartIso = (dateString, tz = storeTz) => dayStartIso(addDays(dateString, 1), tz);

export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
