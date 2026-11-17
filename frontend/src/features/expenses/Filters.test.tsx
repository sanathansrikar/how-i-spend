import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExpensesPage from './ExpensesPage'

afterEach(() => vi.unstubAllGlobals())

function makeExpenses(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    category: 'Food',
    amount: '10.00',
    currency: 'INR',
    spent_on: '2026-11-02',
    merchant: `Shop ${i + 1}`,
    note: null,
  }))
}

/** Fake backend: `count` expenses, categories Bills and Food; records every expenses request. */
function stubApi(count = 30) {
  const all = makeExpenses(count)
  const fetchMock = vi.fn(async (url: string) => {
    const query = new URL(url, 'http://test').searchParams
    const offset = Number(query.get('offset'))
    const body = url.includes('/categories')
      ? ['Bills', 'Food']
      : all.slice(offset, offset + Number(query.get('limit')))
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

/** The query string of every list request so far, e.g. "limit=21&offset=0&category=Food". */
function listRequests(fetchMock: ReturnType<typeof stubApi>) {
  return fetchMock.mock.calls
    .map(([url]) => url)
    .filter((url) => url.includes('/expenses?'))
    .map((url) => url.split('?')[1])
}

test('offers All categories plus the category names', async () => {
  stubApi()
  renderPage()
  await screen.findByText('Shop 1')

  const filter = screen.getByLabelText('Category', { selector: '#filter-category' })

  expect(Array.from(filter.querySelectorAll('option')).map((o) => o.textContent)).toEqual([
    'All categories',
    'Bills',
    'Food',
  ])
})

test('choosing a month sends that month as an inclusive date range', async () => {
  const fetchMock = stubApi()
  renderPage()
  await screen.findByText('Shop 1')

  fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-10' } })

  await waitFor(() =>
    expect(listRequests(fetchMock)).toContain(
      'limit=21&offset=0&date_from=2026-10-01&date_to=2026-10-31',
    ),
  )
})

test('choosing a category sends it by name', async () => {
  const fetchMock = stubApi()
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('Shop 1')

  await user.selectOptions(
    screen.getByLabelText('Category', { selector: '#filter-category' }),
    'Food',
  )

  await waitFor(() => expect(listRequests(fetchMock)).toContain('limit=21&offset=0&category=Food'))
})

test('month and category combine', async () => {
  const fetchMock = stubApi()
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('Shop 1')

  fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-11' } })
  await user.selectOptions(
    screen.getByLabelText('Category', { selector: '#filter-category' }),
    'Bills',
  )

  await waitFor(() =>
    expect(listRequests(fetchMock)).toContain(
      'limit=21&offset=0&date_from=2026-11-01&date_to=2026-11-30&category=Bills',
    ),
  )
})

test('changing a filter goes back to page 1', async () => {
  const fetchMock = stubApi(60)
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('Shop 1')
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await screen.findByText('Shop 21')

  await user.selectOptions(
    screen.getByLabelText('Category', { selector: '#filter-category' }),
    'Food',
  )

  await waitFor(() => expect(listRequests(fetchMock)).toContain('limit=21&offset=0&category=Food'))
  expect(listRequests(fetchMock)).not.toContain('limit=21&offset=20&category=Food')
})

test('Clear filters appears only when a filter is set and removes both', async () => {
  const fetchMock = stubApi()
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('Shop 1')
  expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()

  await user.selectOptions(
    screen.getByLabelText('Category', { selector: '#filter-category' }),
    'Food',
  )
  await user.click(await screen.findByRole('button', { name: 'Clear filters' }))

  expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Category', { selector: '#filter-category' })).toHaveValue('')
  // The last list request is the unfiltered one again.
  await waitFor(() => expect(listRequests(fetchMock).at(-1)).toBe('limit=21&offset=0'))
})

test('no matches under a filter says so instead of "No expenses yet"', async () => {
  stubApi(0)
  const user = userEvent.setup()
  renderPage()
  expect(await screen.findByText('No expenses yet.')).toBeInTheDocument()

  await user.selectOptions(
    screen.getByLabelText('Category', { selector: '#filter-category' }),
    'Food',
  )

  expect(await screen.findByText('No expenses match these filters.')).toBeInTheDocument()
})
