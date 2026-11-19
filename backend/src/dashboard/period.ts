import { BadRequestException } from '@nestjs/common';

// Store calendar fallback: Asia/Kolkata (UTC+05:30). India has no daylight saving time.
const offset = 330 * 60_000;
export const timezone = 'Asia/Kolkata';
export const localDate = (instant: Date) => new Date(instant.getTime() + offset).toISOString().slice(0, 10);
const localStart = (day: string) => new Date(Date.parse(`${day}T00:00:00.000Z`) - offset);
const advance = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00.000Z`) + days * 86400000).toISOString().slice(0, 10);
export type Preset = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'custom';
export function period(input: { preset: Preset; start?: string; end?: string }, now = new Date()) {
  const today = localDate(now);
  let start = today; let end = today;
  switch (input.preset) {
    case 'yesterday': start = end = advance(today, -1); break;
    case 'last7': start = advance(today, -6); break;
    case 'last30': start = advance(today, -29); break;
    case 'thisMonth': start = `${today.slice(0, 7)}-01`; break;
    case 'lastMonth': end = advance(`${today.slice(0, 7)}-01`, -1); start = `${end.slice(0, 7)}-01`; break;
    case 'custom': start = input.start ?? ''; end = input.end ?? ''; break;
  }
  const valid = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;
  if (!valid(start) || !valid(end) || start > end || end > today || (Date.parse(end) - Date.parse(start)) / 86400000 > 366) throw new BadRequestException({ code: 'INVALID_PERIOD', message: 'Choose valid dates, up to 367 days, ending today or earlier.' });
  const from = localStart(start); const to = localStart(advance(end, 1));
  const elapsedTo = to > now ? now : to;
  const previousFrom = new Date(from.getTime() - (to.getTime() - from.getTime()));
  const previousTo = new Date(previousFrom.getTime() + (elapsedTo.getTime() - from.getTime()));
  const days = Math.round((to.getTime() - from.getTime()) / 86400000);
  const bucket = days === 1 ? 'hour' : days > 90 ? 'week' : 'day';
  return { preset: input.preset, start, end, from, to, elapsedTo, previousFrom, previousTo, timezone, bucket, days };
}
