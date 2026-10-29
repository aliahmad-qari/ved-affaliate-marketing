// Existing timestamps stay in UTC; calendar controls represent Indian business days.
export const LEAD_FILTER_TIMEZONE = 'Asia/Kolkata';
export interface LeadDateFilters { startDate: string; endDate: string; month: string; year: string; }
export const emptyLeadDateFilters: LeadDateFilters = { startDate: '', endDate: '', month: '', year: '' };
const invalid = (message: string): never => { throw Object.assign(new Error(message), { status: 400 }); };

function calendarDay(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return invalid('Invalid calendar date.');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return invalid('Invalid calendar date.');
  return date.getTime() - 330 * 60000;
}

export function leadDateQuery(input: Record<string, unknown>): { $gte?: Date; $lt?: Date; $lte?: Date } | undefined {
  const values: Record<string, string> = {};
  for (const field of ['startDate', 'endDate', 'month', 'year']) {
    if (input[field] === undefined || input[field] === '') continue;
    if (typeof input[field] !== 'string') return invalid('Invalid date filter.');
    values[field] = input[field] as string;
  }
  let lower: number | undefined, upper: number | undefined, inclusive = false;
  const setLower = (value: number) => { lower = lower === undefined ? value : Math.max(lower, value); };
  const setUpper = (value: number, included = false) => {
    if (upper === undefined || value < upper || (value === upper && !included)) { upper = value; inclusive = included; }
  };
  for (const field of ['startDate', 'endDate']) {
    const value = values[field]; if (!value) continue;
    const day = /^\d{4}-\d{2}-\d{2}$/.test(value);
    // Keep previously supported explicit ISO instants, reject ambiguous local datetimes.
    if (!day && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return invalid('Invalid date filter.');
    const timestamp = day ? calendarDay(value) : Date.parse(value);
    if (!day) calendarDay(value.slice(0, 10));
    if (!Number.isFinite(timestamp)) return invalid('Invalid date filter.');
    if (field === 'startDate') setLower(timestamp);
    else setUpper(day ? timestamp + 86400000 : timestamp, !day);
  }
  if (values.startDate && values.endDate) {
    const start = /^\d{4}-\d{2}-\d{2}$/.test(values.startDate) ? calendarDay(values.startDate) : Date.parse(values.startDate);
    const end = /^\d{4}-\d{2}-\d{2}$/.test(values.endDate) ? calendarDay(values.endDate) + 86400000 - 1 : Date.parse(values.endDate);
    if (start > end) return invalid('From Date must not be after To Date.');
  }
  if (values.month && !values.year) return invalid('Select a year when filtering by month.');
  if (values.year) {
    if (!/^\d{4}$/.test(values.year) || +values.year < 1970 || +values.year > 9998) return invalid('Invalid year filter.');
    const year = +values.year;
    if (values.month && (!/^\d{1,2}$/.test(values.month) || +values.month < 1 || +values.month > 12)) return invalid('Invalid month filter.');
    const month = values.month ? +values.month : 1;
    const pad = (n: number) => String(n).padStart(2, '0');
    setLower(calendarDay(`${year}-${pad(month)}-01`));
    const nextMonth = values.month ? month % 12 + 1 : 1;
    const nextYear = !values.month || month === 12 ? year + 1 : year;
    setUpper(calendarDay(`${nextYear}-${pad(nextMonth)}-01`));
  }
  if (lower === undefined && upper === undefined) return undefined;
  return { ...(lower !== undefined ? { $gte: new Date(lower) } : {}), ...(upper !== undefined ? { [inclusive ? '$lte' : '$lt']: new Date(upper) } : {}) };
}
