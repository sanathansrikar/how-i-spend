import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

/** Mirrors the backend's ExpenseCreate. Omitted optional fields use the backend defaults. */
export type NewExpense = {
  amount: string
  spent_on: string
  category?: string | null
  merchant?: string
  note?: string
}

export function useExpenses() {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: () => api<Expense[]>('/expenses'),
  })
}

/** Category names only: the API identifies categories by name, never by id. */
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => api<string[]>('/categories'),
  })
}

export function useCreateExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (expense: NewExpense) =>
      api<Expense>('/expenses', { method: 'POST', body: JSON.stringify(expense) }),
    // Invalidate: marks the list stale so it refetches and shows the new expense.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

/** Mirrors the backend's ExpenseUpdate: send null to clear category, merchant or note. */
export type ExpenseChanges = {
  amount?: string
  spent_on?: string
  category?: string | null
  merchant?: string | null
  note?: string | null
}

export function useUpdateExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: ExpenseChanges }) =>
      api<Expense>(`/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(changes) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

export function useDeleteExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/expenses/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  })
}
