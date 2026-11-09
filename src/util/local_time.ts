// Dates are stored as local-time text ("2026-11-08 09:00") so they read naturally
// in tool output and sort correctly as plain strings.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

export function toLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = twoDigits(date.getMonth() + 1);
  const day = twoDigits(date.getDate());
  return `${year}-${month}-${day}`;
}

export function toLocalDateTime(date: Date): string {
  const hours = twoDigits(date.getHours());
  const minutes = twoDigits(date.getMinutes());
  return `${toLocalDate(date)} ${hours}:${minutes}`;
}

/** Midnight (local) of the given date plus a whole number of days. */
export function startOfDayPlus(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** A specific local time on the day that is `days` away from `date`. */
export function atTimeOnDayPlus(date: Date, days: number, hours: number, minutes: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, hours, minutes);
}

/** Whole calendar days from `earlierText` (a stored local date or date-time) to `now`. */
export function calendarDaysSince(earlierText: string, now: Date): number {
  const earlierDay = startOfDayPlus(parseLocal(earlierText), 0);
  const today = startOfDayPlus(now, 0);
  // Math.round absorbs the one-hour shift on daylight-saving days.
  return Math.round((today.getTime() - earlierDay.getTime()) / MS_PER_DAY);
}

export function parseLocal(text: string): Date {
  const [datePart, timePart] = text.split(' ');
  const [year, month, day] = (datePart ?? '').split('-').map(Number);
  const [hours, minutes] = (timePart ?? '00:00').split(':').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, hours ?? 0, minutes ?? 0);
}
