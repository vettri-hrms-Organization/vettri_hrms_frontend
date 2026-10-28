export const ANNOUNCEMENT_CATEGORIES = [
  { value: 'GENERAL', label: 'General', variant: 'neutral' },
  { value: 'POLICY', label: 'Policy', variant: 'info' },
  { value: 'EVENT', label: 'Event', variant: 'success' },
  { value: 'HOLIDAY', label: 'Holiday', variant: 'success' },
  { value: 'URGENT', label: 'Urgent', variant: 'danger' },
];

export function categoryMeta(value) {
  return ANNOUNCEMENT_CATEGORIES.find((category) => category.value === value) || ANNOUNCEMENT_CATEGORIES[0];
}

/** "2026-10-28T10:00:00+05:30" -> "2026-10-28T10:00" for <input type="datetime-local"> (IST wall time). */
export function toDateTimeLocal(value) {
  return typeof value === 'string' && value.length >= 16 ? value.slice(0, 16) : '';
}
