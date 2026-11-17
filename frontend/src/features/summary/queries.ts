import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** Mirrors the backend's MonthlySummary. Money values are decimal strings. */
export type MonthlySummary = {
  month: string
  currency: string
  total_spent: string
  expense_count: number
  monthly_income: string | null
  monthly_budget: string | null
  /** Budget minus spent; negative means over budget; null when no budget is set. */
  budget_remaining: string | null
  by_category: { category: string | null; total: string; count: number }[]
  /** Expenses in other currencies: not converted, not included in the totals above. */
  other_currency_count: number
}

export function useMonthlySummary(month: string) {
  return useQuery({
    // The month is part of the key, so each month is cached and fetched separately.
    queryKey: ['summary', month],
    queryFn: () => api<MonthlySummary>(`/summary/monthly?month=${month}`),
  })
}
