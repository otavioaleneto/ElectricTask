// Pure helpers for subscription billing-cycle date math and monthly-spend
// normalization. Dates are stored as "YYYY-MM-DD" text keys.

const AVG_MONTH_DAYS = 30.437;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function parseKey(s: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function toKey(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function daysInMonth(y: number, m: number): number {
  // m is 1-based; day 0 of the next month is the last day of month m.
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function addDaysKey(key: string, days: number): string {
  const p = parseKey(key);
  if (!p) return key;
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return toKey(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function addMonthsKey(key: string, months: number): string {
  const p = parseKey(key);
  if (!p) return key;
  const total = p.y * 12 + (p.m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const nd = Math.min(p.d, daysInMonth(ny, nm));
  return toKey(ny, nm, nd);
}

export function advanceDueDateOnce(
  key: string,
  cycle: string,
  customCycleDays: number | null,
): string {
  switch (cycle) {
    case "weekly":
      return addDaysKey(key, 7);
    case "monthly":
      return addMonthsKey(key, 1);
    case "quarterly":
      return addMonthsKey(key, 3);
    case "yearly":
      return addMonthsKey(key, 12);
    case "custom":
      return addDaysKey(key, Math.max(1, customCycleDays ?? 30));
    default:
      return addMonthsKey(key, 1);
  }
}

// Advance the due date by at least one cycle (a payment covers the current
// period) and keep advancing until the next due date is in the future, so a
// long-overdue subscription lands on a sensible upcoming date.
export function advanceDueDateFuture(
  key: string,
  cycle: string,
  customCycleDays: number | null,
  today: string,
): string {
  let next = advanceDueDateOnce(key, cycle, customCycleDays);
  let guard = 0;
  while (next <= today && guard < 600) {
    next = advanceDueDateOnce(next, cycle, customCycleDays);
    guard += 1;
  }
  return next;
}

// Normalize the amount to an equivalent monthly cost in cents.
export function monthlyCents(
  amountCents: number,
  cycle: string,
  customCycleDays: number | null,
): number {
  switch (cycle) {
    case "weekly":
      return Math.round((amountCents * 52) / 12);
    case "monthly":
      return amountCents;
    case "quarterly":
      return Math.round(amountCents / 3);
    case "yearly":
      return Math.round(amountCents / 12);
    case "custom": {
      const days = Math.max(1, customCycleDays ?? 30);
      return Math.round((amountCents * AVG_MONTH_DAYS) / days);
    }
    default:
      return amountCents;
  }
}

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Whole-day difference from today to the given due date (negative = overdue).
export function daysUntil(key: string): number {
  const p = parseKey(key);
  if (!p) return 0;
  const due = Date.UTC(p.y, p.m - 1, p.d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due - today) / 86_400_000);
}
