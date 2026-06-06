/**
 * Formats a date value as an ISO 8601-style string using the browser's local
 * timezone: "YYYY-MM-DD HH:mm:ss UTC+x" / "UTC-x".
 * Returns '-' when the input is null, undefined, or an empty string.
 */
export function formatISODateTime(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') return '-';

    const d = new Date(value);

    if (isNaN(d.getTime())) return '-';

    const pad = (n: number) => String(n).padStart(2, '0');

    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());

    // getTimezoneOffset() returns minutes behind UTC; negate to get the display offset.
    const offsetTotal = -d.getTimezoneOffset();
    const sign = offsetTotal >= 0 ? '+' : '-';
    const absMinutes = Math.abs(offsetTotal);
    const offsetHours = Math.floor(absMinutes / 60);
    const offsetMins = absMinutes % 60;

    // Include minutes only for non-whole-hour zones (e.g. UTC+5:30, UTC+9:30).
    const tzLabel = offsetMins > 0 ? `UTC${sign}${offsetHours}:${pad(offsetMins)}` : `UTC${sign}${offsetHours}`;

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${tzLabel}`;
}
