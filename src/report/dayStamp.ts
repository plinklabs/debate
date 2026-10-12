/** A day as `2026-10-12`, in local time, for the name of a downloaded file. */
export function dayStamp(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
