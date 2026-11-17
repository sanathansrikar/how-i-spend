import { monthRange } from './format'

test.each([
  ['2026-11', '2026-11-01', '2026-11-30'],
  ['2026-12', '2026-12-01', '2026-12-31'],
  ['2026-02', '2026-02-01', '2026-02-28'],
  ['2028-02', '2028-02-01', '2028-02-29'], // leap year
])('monthRange(%s) spans %s to %s', (month, from, to) => {
  expect(monthRange(month)).toEqual({ from, to })
})
