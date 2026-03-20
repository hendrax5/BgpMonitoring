/**
 * Shared date/time formatting utilities.
 * Pure functions — safe for Server and Client components.
 */

/**
 * Returns a human-readable relative time from now.
 * e.g. "just now", "5m ago", "3h ago", "2d ago"
 */
export function fmtRelative(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Formats a duration in seconds to a compact human-readable string.
 * e.g. 90 → "1m 30s", 3700 → "1h 1m"
 */
export function fmtDur(sec: number | null | undefined): string {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  if (m < 1) return `${sec}s`;
  if (m < 60) return `${m}m ${sec % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/**
 * Formats a duration since a date string (ISO) to an uptime string.
 * e.g. "1w 3d", "2h 15m", "30s"
 */
export function fmtUptime(dateStr: string): string {
  const date = new Date(dateStr);
  const totalSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  if (m < 60) return `${m}m ${totalSec % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ${h % 24}h`;
  const w = Math.floor(d / 7);
  if (d < 30) return `${w}w ${d % 7}d`;
  const mo = Math.floor(d / 30);
  const remW = Math.floor((d % 30) / 7);
  if (d < 365) return remW > 0 ? `${mo}mo ${remW}w` : `${mo}mo`;
  const yr = Math.floor(d / 365);
  const remMo = Math.floor((d % 365) / 30);
  return remMo > 0 ? `${yr}y ${remMo}mo` : `${yr}y`;
}

/**
 * Formats a date as a locale short date string.
 */
export function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Returns the progress bar CSS modifier class based on percentage.
 */
export function progressClass(pct: number): string {
  if (pct >= 80) return 'progress-bar--success';
  if (pct >= 60) return 'progress-bar--warning';
  return 'progress-bar--danger';
}
