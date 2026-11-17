import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
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

/** Fake backend: the page also asks for categories (for the form), so answer each URL itself. */
function stubApi(expenses: unknown[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => (url.endsWith('/categories') ? ['Food'] : expenses),
    })),
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
  stubApi([expense])

  renderPage()

  expect(await screen.findByText('Starbucks')).toBeInTheDocument()
  // Scoped to the table: the add form also has a "Food" option.
  const table = within(screen.getByRole('table'))
  expect(table.getByText('2 Nov 2026')).toBeInTheDocument()
  expect(table.getByText('Food')).toBeInTheDocument()
  expect(table.getByText('₹250.00')).toBeInTheDocument()
})

test('shows Uncategorised and falls back to the note when there is no merchant', async () => {
  const bare = { ...expense, category: null, merchant: null, note: 'cab home' }
  stubApi([bare])

  renderPage()

  expect(await screen.findByText('cab home')).toBeInTheDocument()
  expect(within(screen.getByRole('table')).getByText('Uncategorised')).toBeInTheDocument()
})

test('says so when there are no expenses', async () => {
  stubApi([])

  renderPage()

  expect(await screen.findByText('No expenses yet.')).toBeInTheDocument()
})

test('shows an error when the API cannot be reached', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))

  renderPage()

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load expenses')
})
