import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import SummaryPage from './SummaryPage'
import type { MonthlySummary } from './queries'

afterEach(() => vi.unstubAllGlobals())

const summary: MonthlySummary = {
  month: '2026-11',
  currency: 'INR',
  total_spent: '800.00',
  expense_count: 4,
  monthly_income: null,
  monthly_budget: '1000.00',
  budget_remaining: '200.00',
  by_category: [
    { category: 'Bills', total: '600.00', count: 1 },
    { category: null, total: '200.00', count: 3 },
  ],
  other_currency_count: 0,
}

function stubApi(body: Partial<MonthlySummary> = {}, status = 200) {
  const fetchMock = vi.fn(async (_url: string) => ({
    ok: status === 200,
    status,
    statusText: 'x',
    json: async () => (status === 200 ? { ...summary, ...body } : { detail: 'Bad month.' }),
  }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderPage() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <SummaryPage />
    </QueryClientProvider>,
  )
}

test('shows spent, budget, remaining and each category', async () => {
  stubApi()

  renderPage()

  expect(await screen.findByText('Remaining')).toBeInTheDocument()
  expect(screen.getByText('₹800.00')).toBeInTheDocument()
  expect(screen.getByText('₹1,000.00')).toBeInTheDocument()
  expect(screen.getByText('₹200.00', { selector: 'p' })).toBeInTheDocument()
  expect(screen.getByText('Bills')).toBeInTheDocument()
  expect(screen.getByText('₹600.00')).toBeInTheDocument()
  expect(screen.getByText('Uncategorised')).toBeInTheDocument()
  expect(screen.getByRole('progressbar', { name: 'Budget used' })).toHaveAttribute(
    'aria-valuenow',
    '80',
  )
  expect(screen.getByRole('progressbar', { name: 'Bills share of spending' })).toHaveAttribute(
    'aria-valuenow',
    '75',
  )
})

test('says "Over budget by" with the overspend when the budget is exceeded', async () => {
  stubApi({ total_spent: '1300.00', budget_remaining: '-300.00' })

  renderPage()

  expect(await screen.findByText('Over budget by')).toBeInTheDocument()
  expect(screen.getByText('₹300.00', { selector: 'p' })).toBeInTheDocument()
  // The bar caps at 100% however far over budget.
  expect(screen.getByRole('progressbar', { name: 'Budget used' })).toHaveAttribute(
    'aria-valuenow',
    '100',
  )
})

test('without a budget it says so and shows no budget bar', async () => {
  stubApi({ monthly_budget: null, budget_remaining: null })

  renderPage()

  expect(await screen.findByText(/No monthly budget set/)).toBeInTheDocument()
  expect(screen.queryByRole('progressbar', { name: 'Budget used' })).not.toBeInTheDocument()
})

test('an empty month says there is nothing to show', async () => {
  stubApi({ total_spent: '0.00', expense_count: 0, budget_remaining: '1000.00', by_category: [] })

  renderPage()

  expect(await screen.findByText('No expenses this month.')).toBeInTheDocument()
})

test('mentions expenses in other currencies that were left out', async () => {
  stubApi({ other_currency_count: 2 })

  renderPage()

  expect(
    await screen.findByText(/2 expenses in other currencies are not included/),
  ).toBeInTheDocument()
})

test('changing the month asks the API for that month', async () => {
  const fetchMock = stubApi()
  renderPage()
  await screen.findByText('Remaining')

  fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-10' } })

  await waitFor(() =>
    expect(fetchMock.mock.calls.map(([url]) => url)).toContain(
      '/api/v1/summary/monthly?month=2026-10',
    ),
  )
})

test('shows the backend error', async () => {
  stubApi({}, 422)

  renderPage()

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not load the summary: Bad month.',
  )
})
