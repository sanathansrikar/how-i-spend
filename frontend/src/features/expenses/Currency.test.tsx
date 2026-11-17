import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExpenseForm from './ExpenseForm'
import type { Expense } from './queries'

afterEach(() => vi.unstubAllGlobals())

function res(body: unknown, status = 200) {
  return { ok: true, status, statusText: 'OK', json: async () => body }
}

/** Fake backend: the user's default currency is INR; saves answer with an empty expense. */
function stubApi() {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url.endsWith('/me')) return res({ currency: 'INR' })
    if (url.endsWith('/categories')) return res(['Food'])
    return res({ id: '1' }, 201)
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

function savedBody(fetchMock: ReturnType<typeof stubApi>) {
  const call = fetchMock.mock.calls.find(
    ([, init]) => init?.method === 'POST' || init?.method === 'PATCH',
  )
  return JSON.parse(call?.[1]?.body as string)
}

test('the currency box hints at the user default and is left out when blank', async () => {
  const fetchMock = stubApi()
  const user = userEvent.setup()
  renderForm()

  await waitFor(() =>
    expect(screen.getByLabelText('Currency')).toHaveAttribute('placeholder', 'INR'),
  )
  await user.type(screen.getByLabelText('Amount'), '5')
  await user.click(screen.getByRole('button', { name: 'Add expense' }))

  await waitFor(() => expect(savedBody(fetchMock)).toMatchObject({ amount: '5' }))
  expect(savedBody(fetchMock)).not.toHaveProperty('currency')
})

test('a typed currency is sent upper-cased', async () => {
  const fetchMock = stubApi()
  const user = userEvent.setup()
  renderForm()

  await user.type(screen.getByLabelText('Amount'), '5')
  await user.type(screen.getByLabelText('Currency'), 'eur')
  await user.click(screen.getByRole('button', { name: 'Add expense' }))

  await waitFor(() => expect(savedBody(fetchMock).currency).toBe('EUR'))
})

test('the currency box is cleared after a successful add', async () => {
  stubApi()
  const user = userEvent.setup()
  renderForm()
  await user.type(screen.getByLabelText('Amount'), '5')
  await user.type(screen.getByLabelText('Currency'), 'eur')

  await user.click(screen.getByRole('button', { name: 'Add expense' }))

  await waitFor(() => expect(screen.getByLabelText('Currency')).toHaveValue(''))
})

test('editing starts from the expense currency and can change it', async () => {
  const fetchMock = stubApi()
  const user = userEvent.setup()
  renderForm({
    id: 'abc',
    category: null,
    amount: '10.00',
    currency: 'USD',
    spent_on: '2026-11-02',
    merchant: null,
    note: null,
  })
  expect(screen.getByLabelText('Currency')).toHaveValue('USD')

  await user.clear(screen.getByLabelText('Currency'))
  await user.type(screen.getByLabelText('Currency'), 'gbp')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(savedBody(fetchMock).currency).toBe('GBP'))
})

test('only three letters are accepted', async () => {
  stubApi()
  const user = userEvent.setup()
  renderForm()

  await user.type(screen.getByLabelText('Currency'), 'EURO')

  expect(screen.getByLabelText('Currency')).toHaveValue('EUR')
  expect(screen.getByLabelText('Currency')).toHaveAttribute('pattern', '[A-Za-z]{3}')
})
