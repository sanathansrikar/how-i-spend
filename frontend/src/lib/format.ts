/** "12.50" + "USD" -> "$12.50". Display only: amounts stay strings everywhere else. */
export function formatMoney(amount: string, currency: string): string {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(Number(amount))
}

/** "2026-11-02" -> "2 Nov 2026". Built from parts so the date never shifts with the time zone. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** "2026-02" -> first and last day of that month, as YYYY-MM-DD (the API takes inclusive dates). */
export function monthRange(month: string): { from: string; to: string } {
  const [year, monthNumber] = month.split('-').map(Number)
  // Day 0 of the next month is the last day of this one, leap years included.
  const lastDay = new Date(year, monthNumber, 0).getDate()
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` }
}
