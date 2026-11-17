import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExpensesPage from './ExpensesPage'

afterEach(() => vi.unstubAllGlobals())

function makeExpenses(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    category: null,
    amount: '10.00',
    currency: 'INR',
    spent_on: '2026-11-02',
    merchant: `Shop ${i + 1}`,
    note: null,
  }))
}

/** Fake backend holding `count` expenses; it honours the limit and offset in the URL. */
function stubApi(count: number) {
  const all = makeExpenses(count)
  const fetchMock = vi.fn(async (url: string) => {
    const query = new URL(url, 'http://test').searchParams
    const body = url.includes('/categories')
      ? []
      : all.slice(
          Number(query.get('offset')),
          Number(query.get('offset')) + Number(query.get('limit')),
        )
    return { ok: true, status: 200, statusText: 'OK', json: async () => body }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderPage() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ExpensesPage />
    </QueryClientProvider>,
  )
}

function expenseRequests(fetchMock: ReturnType<typeof stubApi>) {
  return fetchMock.mock.calls.map(([url]) => url).filter((url) => url.includes('/expenses?'))
}

test('starts on page 1 with 20 rows and asks the API for one extra to detect a next page', async () => {
  const fetchMock = stubApi(45)
  renderPage()

  expect(await screen.findByText('Shop 1')).toBeInTheDocument()

  expect(screen.getByText('Shop 20')).toBeInTheDocument()
  expect(screen.queryByText('Shop 21')).not.toBeInTheDocument()
  expect(screen.getByText('1–20')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  expect(expenseRequests(fetchMock)).toContain('/api/v1/expenses?limit=21&offset=0')
})

test('Next and Previous move between pages', async () => {
  const fetchMock = stubApi(45)
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('Shop 1')

  await user.click(screen.getByRole('button', { name: 'Next' }))

  expect(await screen.findByText('Shop 21')).toBeInTheDocument()
  expect(screen.getByText('21–40')).toBeInTheDocument()
  expect(screen.queryByText('Shop 20')).not.toBeInTheDocument()
  expect(expenseRequests(fetchMock)).toContain('/api/v1/expenses?limit=21&offset=20')

  await user.click(screen.getByRole('button', { name: 'Previous' }))

  expect(await screen.findByText('Shop 1')).toBeInTheDocument()
  expect(screen.getByText('1–20')).toBeInTheDocument()
})

test('the last page shows what is left and has no Next', async () => {
  stubApi(45)
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('Shop 1')
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await screen.findByText('Shop 21')

  await user.click(screen.getByRole('button', { name: 'Next' }))

  expect(await screen.findByText('Shop 45')).toBeInTheDocument()
  expect(screen.getByText('41–45')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
})

test('exactly one full page has no Next', async () => {
  stubApi(20)
  renderPage()

  expect(await screen.findByText('Shop 20')).toBeInTheDocument()

  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
})

test('changing rows per page asks for that size and goes back to page 1', async () => {
  const fetchMock = stubApi(120)
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('Shop 1')
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await screen.findByText('Shop 21')

  await user.selectOptions(screen.getByLabelText('Rows per page'), '50')

  expect(await screen.findByText('Shop 50')).toBeInTheDocument()
  expect(screen.getByText('1–50')).toBeInTheDocument()
  expect(expenseRequests(fetchMock)).toContain('/api/v1/expenses?limit=51&offset=0')
})

test('only 20 and 50 are offered', async () => {
  stubApi(5)
  renderPage()
  await screen.findByText('Shop 1')

  const options = screen
    .getAllByRole('option')
    .filter((o) => ['20', '50', '100'].includes(o.textContent ?? ''))

  expect(options.map((o) => o.textContent)).toEqual(['20', '50'])
})
