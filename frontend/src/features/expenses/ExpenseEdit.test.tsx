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

/** Clicks Edit on the Starbucks row and returns queries scoped to the opened dialog. */
async function openEditDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Edit Starbucks' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Edit expense' }))
  // Wait for the category options, so selecting one works.
  await dialog.findByRole('option', { name: 'Bills' })
  return dialog
}

test('Edit opens a dialog filled with the expense and leaves the add form alone', async () => {
  stubApi()
  const user = userEvent.setup()
  renderPage()

  const dialog = await openEditDialog(user)

  expect(dialog.getByLabelText('Amount')).toHaveValue(250)
  expect(dialog.getByLabelText('Date')).toHaveValue('2026-11-02')
  expect(dialog.getByLabelText('Merchant')).toHaveValue('Starbucks')
  expect(dialog.getByLabelText('Note')).toHaveValue('latte')
  // The add form on the page keeps its own, empty values: the other "Amount" input.
  const dialogEl = screen.getByRole('dialog')
  const pageAmount = screen.getAllByLabelText('Amount').find((el) => !dialogEl.contains(el))
  expect(pageAmount).toHaveValue(null)
})

test('saving sends a PATCH with the changes and closes the dialog', async () => {
  const fetchMock = stubApi()
  const user = userEvent.setup()
  renderPage()
  const dialog = await openEditDialog(user)

  await user.clear(dialog.getByLabelText('Amount'))
  await user.type(dialog.getByLabelText('Amount'), '300')
  await user.selectOptions(dialog.getByLabelText('Category'), 'Bills')
  await user.click(dialog.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
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
  const dialog = await openEditDialog(user)

  await user.clear(dialog.getByLabelText('Merchant'))
  await user.clear(dialog.getByLabelText('Note'))
  await user.click(dialog.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(patchCall(fetchMock)).toBeTruthy())
  expect(patchCall(fetchMock)?.body).toMatchObject({ merchant: null, note: null })
})

test('Cancel closes the dialog without saving', async () => {
  const fetchMock = stubApi()
  const user = userEvent.setup()
  renderPage()
  const dialog = await openEditDialog(user)

  await user.click(dialog.getByRole('button', { name: 'Cancel' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(patchCall(fetchMock)).toBeUndefined()
})

test('Escape closes the dialog without saving', async () => {
  const fetchMock = stubApi()
  const user = userEvent.setup()
  renderPage()
  await openEditDialog(user)

  await user.keyboard('{Escape}')

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(patchCall(fetchMock)).toBeUndefined()
})

test('a backend error is shown and the dialog stays open', async () => {
  stubApi(res({ detail: 'Unknown categories: Bills.' }, 422, false))
  const user = userEvent.setup()
  renderPage()
  const dialog = await openEditDialog(user)

  await user.click(dialog.getByRole('button', { name: 'Save changes' }))

  expect(await dialog.findByRole('alert')).toHaveTextContent('Unknown categories: Bills.')
  expect(screen.getByRole('dialog', { name: 'Edit expense' })).toBeInTheDocument()
})
