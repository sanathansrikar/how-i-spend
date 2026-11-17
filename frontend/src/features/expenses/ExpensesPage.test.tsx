import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import ExpensesPage from './ExpensesPage'

afterEach(() => vi.unstubAllGlobals())

function renderPage() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ExpensesPage />
    </QueryClientProvider>,
  )
}

const expense = {
  id: '1',
  category: 'Food',
  amount: '250.00',
  currency: 'INR',
  spent_on: '2026-11-02',
  merchant: 'Starbucks',
  note: null,
}

test('lists expenses with formatted date and amount', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [expense] }),
  )

  renderPage()

  expect(await screen.findByText('Starbucks')).toBeInTheDocument()
  expect(screen.getByText('2 Nov 2026')).toBeInTheDocument()
  expect(screen.getByText('Food')).toBeInTheDocument()
  expect(screen.getByText('₹250.00')).toBeInTheDocument()
})

test('shows Uncategorised and falls back to the note when there is no merchant', async () => {
  const bare = { ...expense, category: null, merchant: null, note: 'cab home' }
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [bare] }),
  )

  renderPage()

  expect(await screen.findByText('cab home')).toBeInTheDocument()
  expect(screen.getByText('Uncategorised')).toBeInTheDocument()
})

test('says so when there are no expenses', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] }))

  renderPage()

  expect(await screen.findByText('No expenses yet.')).toBeInTheDocument()
})

test('shows an error when the API cannot be reached', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))

  renderPage()

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load expenses')
})
