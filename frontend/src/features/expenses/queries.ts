import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** Mirrors the backend's ExpenseRead: category is a name, amount a decimal string. */
export type Expense = {
  id: string
  category: string | null
  amount: string
  currency: string
  spent_on: string
  merchant: string | null
  note: string | null
}

export function useExpenses() {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: () => api<Expense[]>('/expenses'),
  })
}
