/**
 * Generates an array of YYYY-MM-DD date strings for the last `days` days.
 * The first element is `days - 1` days ago, the last element is today.
 */
export function generateDateRange(days: number): string[] {
  const dates: string[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  return dates;
}
