import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExpenseForm from './ExpenseForm'
import type { Expense } from './queries'

afterEach(() => vi.unstubAllGlobals())

function res(body: unknown, status = 200, ok = true) {
  return { ok, status, statusText: 'x', json: async () => body }
}

type Replies = { category?: ReturnType<typeof res>; expense?: ReturnType<typeof res> }

/** Fake backend. `category` answers POST /categories, `expense` answers POST/PATCH expenses. */
function stubApi({ category, expense }: Replies = {}) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/categories')) {
      return init?.method === 'POST' ? (category ?? res({ name: 'Travel' }, 201)) : res(['Food'])
    }
    return expense ?? res({ id: '1' }, 201)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderForm(expense?: Expense) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ExpenseForm expense={expense} />
    </QueryClientProvider>,
  )
}

/** Requests sent so far, as "METHOD /path" with their JSON bodies, in order. */
function sent(fetchMock: ReturnType<typeof stubApi>) {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method)
    .map(([url, init]) => ({
      call: `${init?.method} ${url.replace('/api/v1', '')}`,
      body: JSON.parse(init?.body as string),
    }))
}

async function chooseNewCategory(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('option', { name: 'Food' })
  await user.selectOptions(screen.getByLabelText('Category'), '+ New category…')
}

test('the name field only appears after choosing "+ New category…"', async () => {
  stubApi()
  const user = userEvent.setup()
  renderForm()
  await screen.findByRole('option', { name: 'Food' })

  expect(screen.queryByLabelText('New category name')).not.toBeInTheDocument()
  await user.selectOptions(screen.getByLabelText('Category'), 'Food')
  expect(screen.queryByLabelText('New category name')).not.toBeInTheDocument()

  await chooseNewCategory(user)
  expect(screen.getByLabelText('New category name')).toBeInTheDocument()
})

test('creates the category first, then the expense using the name the API returned', async () => {
  const fetchMock = stubApi({ category: res({ name: 'Travel' }, 201) })
  const user = userEvent.setup()
  renderForm()
  await chooseNewCategory(user)

  await user.type(screen.getByLabelText('New category name'), '  Travel ')
  await user.type(screen.getByLabelText('Amount'), '40')
  await user.click(screen.getByRole('button', { name: 'Add expense' }))

  await waitFor(() => expect(sent(fetchMock)).toHaveLength(2))
  const [first, second] = sent(fetchMock)
  expect(first).toEqual({ call: 'POST /categories', body: { name: '  Travel ' } })
  expect(second.call).toBe('POST /expenses')
  // The trimmed name from the API, not what was typed.
  expect(second.body.category).toBe('Travel')
})

test('a category that already exists shows the error and sends no expense', async () => {
  const fetchMock = stubApi({
    category: res({ detail: 'Category already exists: food.' }, 409, false),
  })
  const user = userEvent.setup()
  renderForm()
  await chooseNewCategory(user)

  await user.type(screen.getByLabelText('New category name'), 'food')
  await user.type(screen.getByLabelText('Amount'), '40')
  await user.click(screen.getByRole('button', { name: 'Add expense' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Category already exists: food.')
  expect(sent(fetchMock).map((request) => request.call)).toEqual(['POST /categories'])
})

test('if saving the expense fails, a retry does not create the category again', async () => {
  const fetchMock = stubApi({ expense: res({ detail: 'Try later.' }, 500, false) })
  const user = userEvent.setup()
  renderForm()
  await chooseNewCategory(user)
  await user.type(screen.getByLabelText('New category name'), 'Travel')
  await user.type(screen.getByLabelText('Amount'), '40')

  await user.click(screen.getByRole('button', { name: 'Add expense' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Try later.')
  await user.click(screen.getByRole('button', { name: 'Add expense' }))

  await waitFor(() =>
    expect(sent(fetchMock).map((request) => request.call)).toEqual([
      'POST /categories',
      'POST /expenses',
      'POST /expenses',
    ]),
  )
})

test('editing an expense can also create a category and move the expense to it', async () => {
  const fetchMock = stubApi({ expense: res({ id: 'abc' }) })
  const user = userEvent.setup()
  const expense: Expense = {
    id: 'abc',
    category: 'Food',
    amount: '10.00',
    currency: 'INR',
    spent_on: '2026-11-02',
    merchant: 'Cafe',
    note: null,
  }
  renderForm(expense)
  await chooseNewCategory(user)

  await user.type(screen.getByLabelText('New category name'), 'Travel')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(sent(fetchMock)).toHaveLength(2))
  expect(sent(fetchMock).map((request) => request.call)).toEqual([
    'POST /categories',
    'PATCH /expenses/abc',
  ])
  expect(sent(fetchMock)[1].body.category).toBe('Travel')
})
