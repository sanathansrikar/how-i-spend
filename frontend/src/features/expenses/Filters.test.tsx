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
      ? ['Bills', 'Food', 'Travel']
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

/** The filter's dropdown button; the add form also has a "Category" label, so go by id. */
const categoryFilter = () => document.getElementById('filter-category') as HTMLElement

/** Opens the category dropdown and ticks the given names. */
async function chooseCategories(user: ReturnType<typeof userEvent.setup>, ...names: string[]) {
  await user.click(categoryFilter())
  for (const name of names) await user.click(await screen.findByRole('checkbox', { name }))
}

/** The query string of every list request so far, e.g. "limit=21&offset=0&category=Food". */
function listRequests(fetchMock: ReturnType<typeof stubApi>) {
  return fetchMock.mock.calls
    .map(([url]) => url)
    .filter((url) => url.includes('/expenses?'))
    .map((url) => url.split('?')[1])
}

test('offers every category as a checkbox and starts on All categories', async () => {
  stubApi()
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('Shop 1')
  expect(categoryFilter()).toHaveTextContent('All categories')

  await user.click(categoryFilter())

  expect(
    (await screen.findAllByRole('checkbox')).map((box) => box.parentElement?.textContent),
  ).toEqual(['Bills', 'Food', 'Travel'])
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

test('choosing one category sends it by name and shows it on the trigger', async () => {
  const fetchMock = stubApi()
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('Shop 1')

  await chooseCategories(user, 'Food')

  await waitFor(() => expect(listRequests(fetchMock)).toContain('limit=21&offset=0&category=Food'))
  expect(categoryFilter()).toHaveTextContent('Food')
})

test('choosing several categories sends one parameter per name', async () => {
  const fetchMock = stubApi()
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('Shop 1')

  await chooseCategories(user, 'Bills', 'Food')

  await waitFor(() =>
    expect(listRequests(fetchMock)).toContain('limit=21&offset=0&category=Bills&category=Food'),
  )
  expect(categoryFilter()).toHaveTextContent('Bills, Food')
})

test('three or more categories are summarised as a count', async () => {
  stubApi()
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('Shop 1')

  await chooseCategories(user, 'Bills', 'Food', 'Travel')

  expect(categoryFilter()).toHaveTextContent('3 selected')
})

test('unticking a category removes it from the request', async () => {
  const fetchMock = stubApi()
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('Shop 1')
  await chooseCategories(user, 'Bills', 'Food')

  await user.click(screen.getByRole('checkbox', { name: 'Bills' }))

  await waitFor(() =>
    expect(listRequests(fetchMock).at(-1)).toBe('limit=21&offset=0&category=Food'),
  )
})

test('month and category combine', async () => {
  const fetchMock = stubApi()
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('Shop 1')

  fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-11' } })
  await chooseCategories(user, 'Bills')

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

  await chooseCategories(user, 'Food')

  await waitFor(() => expect(listRequests(fetchMock)).toContain('limit=21&offset=0&category=Food'))
  expect(listRequests(fetchMock)).not.toContain('limit=21&offset=20&category=Food')
})

test('Clear filters appears only when a filter is set and removes both', async () => {
  const fetchMock = stubApi()
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('Shop 1')
  expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()

  await chooseCategories(user, 'Food')
  await user.click(await screen.findByRole('button', { name: 'Clear filters' }))

  expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
  expect(categoryFilter()).toHaveTextContent('All categories')
  // The last list request is the unfiltered one again.
  await waitFor(() => expect(listRequests(fetchMock).at(-1)).toBe('limit=21&offset=0'))
})

test('no matches under a filter says so instead of "No expenses yet"', async () => {
  stubApi(0)
  const user = userEvent.setup()
  renderPage()
  expect(await screen.findByText('No expenses yet.')).toBeInTheDocument()

  await chooseCategories(user, 'Food')

  expect(await screen.findByText('No expenses match these filters.')).toBeInTheDocument()
})

test('From and To work on their own, without a month', async () => {
  const fetchMock = stubApi()
  renderPage()
  await screen.findByText('Shop 1')

  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-15' } })
  await waitFor(() =>
    expect(listRequests(fetchMock)).toContain('limit=21&offset=0&date_from=2026-10-15'),
  )

  fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-11-03' } })
  await waitFor(() =>
    expect(listRequests(fetchMock)).toContain(
      'limit=21&offset=0&date_from=2026-10-15&date_to=2026-11-03',
    ),
  )

  fireEvent.change(screen.getByLabelText('From'), { target: { value: '' } })
  await waitFor(() =>
    expect(listRequests(fetchMock).at(-1)).toBe('limit=21&offset=0&date_to=2026-11-03'),
  )
})

test('picking a month fills From and To with its first and last day', async () => {
  stubApi()
  renderPage()
  await screen.findByText('Shop 1')

  fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-02' } })

  expect(screen.getByLabelText('From')).toHaveValue('2026-02-01')
  expect(screen.getByLabelText('To')).toHaveValue('2026-02-28')
})

test('editing From after picking a month leaves the Month box blank', async () => {
  stubApi()
  renderPage()
  await screen.findByText('Shop 1')
  fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-02' } })
  expect(screen.getByLabelText('Month')).toHaveValue('2026-02')

  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-02-10' } })

  expect(screen.getByLabelText('Month')).toHaveValue('')
  expect(screen.getByLabelText('To')).toHaveValue('2026-02-28')
})

test('From cannot go past To, nor To before From', async () => {
  stubApi()
  renderPage()
  await screen.findByText('Shop 1')

  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-05' } })
  fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-20' } })

  expect(screen.getByLabelText('From')).toHaveAttribute('max', '2026-10-20')
  expect(screen.getByLabelText('To')).toHaveAttribute('min', '2026-10-05')
})

test('Clear filters empties the dates too', async () => {
  stubApi()
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('Shop 1')
  fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-10' } })

  await user.click(await screen.findByRole('button', { name: 'Clear filters' }))

  expect(screen.getByLabelText('From')).toHaveValue('')
  expect(screen.getByLabelText('To')).toHaveValue('')
  expect(screen.getByLabelText('Month')).toHaveValue('')
})
