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
