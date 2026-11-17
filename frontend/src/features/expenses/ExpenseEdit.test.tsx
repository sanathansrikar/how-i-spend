import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExpensesPage from './ExpensesPage'

afterEach(() => vi.unstubAllGlobals())

const expense = {
  id: 'abc',
  category: 'Food',
  amount: '250.00',
  currency: 'INR',
  spent_on: '2026-11-02',
  merchant: 'Starbucks',
  note: 'latte',
}

function res(body: unknown, status = 200, ok = true) {
  return { ok, status, statusText: 'x', json: async () => body }
}

/** Fake backend: lists one expense and categories; PATCH answers with `patchResponse`. */
function stubApi(patchResponse = res({ ...expense })) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/categories')) return res(['Bills', 'Food'])
    if (init?.method === 'PATCH') return patchResponse
    return res([expense])
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

function patchCall(fetchMock: ReturnType<typeof stubApi>) {
  const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')
  return call && { url: call[0], body: JSON.parse(call[1]?.body as string) }
}

test('Edit fills the form with the expense', async () => {
  stubApi()
  const user = userEvent.setup()
  renderPage()

  await user.click(await screen.findByRole('button', { name: 'Edit Starbucks' }))

  expect(screen.getByText('Edit expense')).toBeInTheDocument()
  expect(screen.getByLabelText('Amount')).toHaveValue(250)
  expect(screen.getByLabelText('Date')).toHaveValue('2026-11-02')
  expect(screen.getByLabelText('Merchant')).toHaveValue('Starbucks')
  expect(screen.getByLabelText('Note')).toHaveValue('latte')
})

test('saving sends a PATCH with the changes, then returns to the add form', async () => {
  const fetchMock = stubApi()
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Edit Starbucks' }))
  await within(screen.getByLabelText('Category').closest('form')!).findByRole('option', {
    name: 'Bills',
  })

  await user.clear(screen.getByLabelText('Amount'))
  await user.type(screen.getByLabelText('Amount'), '300')
  await user.selectOptions(screen.getByLabelText('Category'), 'Bills')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(screen.getByText('Add expense', { selector: 'div' })).toBeVisible())
  expect(patchCall(fetchMock)).toEqual({
    url: '/api/v1/expenses/abc',
    body: {
      amount: '300',
      spent_on: '2026-11-02',
      category: 'Bills',
      merchant: 'Starbucks',
      note: 'latte',
    },
  })
})

test('emptied optional fields are sent as null so they are cleared', async () => {
  const fetchMock = stubApi()
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Edit Starbucks' }))

  await user.clear(screen.getByLabelText('Merchant'))
  await user.clear(screen.getByLabelText('Note'))
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(patchCall(fetchMock)).toBeTruthy())
  expect(patchCall(fetchMock)?.body).toMatchObject({ merchant: null, note: null })
})

test('Cancel goes back to the add form without saving', async () => {
  const fetchMock = stubApi()
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Edit Starbucks' }))

  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(screen.queryByText('Edit expense')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Amount')).toHaveValue(null)
  expect(patchCall(fetchMock)).toBeUndefined()
})

test('a backend error is shown and the form stays in edit mode', async () => {
  stubApi(res({ detail: 'Unknown categories: Bills.' }, 422, false))
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Edit Starbucks' }))

  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Unknown categories: Bills.')
  expect(screen.getByText('Edit expense')).toBeInTheDocument()
})
