import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { api } from '@/lib/api'
import { monthRange } from '@/lib/format'

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

/** Any change to an expense changes the list and the monthly totals, so refresh both. */
function refreshExpenseData(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['expenses'] }),
    queryClient.invalidateQueries({ queryKey: ['summary'] }),
  ])
}

/** Rows-per-page choices offered in the list. */
export const PAGE_SIZES = [20, 50] as const

export type ExpenseListParams = {
  /** Rows per page. */
  pageSize: number
  /** Zero-based page number. */
  page: number
  /** YYYY-MM; empty or absent means all time. */
  month?: string
  /** A category name; empty or absent means all categories. */
  category?: string
}

function listQuery({ pageSize, page, month, category }: ExpenseListParams): string {
  const query = new URLSearchParams({
    // One row more than the page holds: if it comes back, a next page exists.
    limit: String(pageSize + 1),
    offset: String(page * pageSize),
  })
  if (month) {
    const { from, to } = monthRange(month)
    query.set('date_from', from)
    query.set('date_to', to)
  }
  if (category) query.set('category', category)
  return query.toString()
}

/** One page of expenses, plus whether another page follows it. */
export function useExpenses(params: ExpenseListParams) {
  const { pageSize } = params
  return useQuery({
    queryKey: ['expenses', params],
    // The API gives no total count, so listQuery's extra row tells us whether "Next" is enabled.
    queryFn: () => api<Expense[]>(`/expenses?${listQuery(params)}`),
    // Keep showing the old page while the next one loads, instead of flashing "Loading…".
    placeholderData: keepPreviousData,
    select: (rows) => ({ rows: rows.slice(0, pageSize), hasNext: rows.length > pageSize }),
  })
}

/** Category names only: the API identifies categories by name, never by id. */
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => api<string[]>('/categories'),
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    // The API answers {name}: the trimmed name as stored, which is what the expense must use.
    mutationFn: (name: string) =>
      api<{ name: string }>('/categories', { method: 'POST', body: JSON.stringify({ name }) }),
    // Invalidate: the dropdown refetches and shows the new category straight away.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useCreateExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (expense: NewExpense) =>
      api<Expense>('/expenses', { method: 'POST', body: JSON.stringify(expense) }),
    // Invalidate: marks cached data stale so it refetches and shows the change.
    onSuccess: () => refreshExpenseData(queryClient),
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
    onSuccess: () => refreshExpenseData(queryClient),
  })
}

export function useDeleteExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/expenses/${id}`, { method: 'DELETE' }),
    onSuccess: () => refreshExpenseData(queryClient),
  })
}
