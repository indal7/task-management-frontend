const IST_LOCALE = 'en-IN';
const IST_TZ    = 'Asia/Kolkata';

/**
 * Parse a date string returned by the API.
 * Handles both legacy bare timestamps (treated as UTC) and new IST-offset strings.
 */
export function parseApiDate(value: string | Date | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  let dateString = value.trim();
  if (!dateString) {
    return null;
  }

  const hasTimezone = /[zZ]$|[+-]\d{2}:\d{2}$/.test(dateString);
  if (!hasTimezone && dateString.includes('T')) {
    // Legacy bare timestamps from backend are UTC; annotate them.
    dateString = `${dateString}Z`;
  }

  const parsed = new Date(dateString);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Format a date as IST date string, e.g. "18 Mar 2026".
 */
export function formatDateIST(value: string | Date | null | undefined): string {
  const d = parseApiDate(value);
  if (!d) return '';
  return d.toLocaleDateString(IST_LOCALE, { timeZone: IST_TZ, day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Format a date as full IST date+time string, e.g. "18 Mar 2026, 11:17:45 am".
 */
export function formatDateTimeIST(value: string | Date | null | undefined): string {
  const d = parseApiDate(value);
  if (!d) return '';
  return d.toLocaleString(IST_LOCALE, {
    timeZone: IST_TZ,
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true
  });
}

/**
 * Return current IST date string (YYYY-MM-DD) for use in date inputs.
 */
export function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: IST_TZ }); // en-CA gives YYYY-MM-DD
}
