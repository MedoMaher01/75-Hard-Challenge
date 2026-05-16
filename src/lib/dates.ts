export function todayISO() {
  return new Date().toLocaleDateString('en-CA');
}

export function formatShortDate(value: string | null | undefined) {
  if (!value) return 'Not yet';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

// BUGFIX: Guard against null / undefined / empty string to prevent crashes.
export function formatTimestamp(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}
