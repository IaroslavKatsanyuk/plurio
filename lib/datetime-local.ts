/**
 * Local YYYY-MM-DDTHH:mm for datetime-local style values (uses local TZ, not UTC slice).
 */
export function isoToLocalDatetimeInputValue(isoOrTimestamp: string): string {
  const d = new Date(isoOrTimestamp);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}
