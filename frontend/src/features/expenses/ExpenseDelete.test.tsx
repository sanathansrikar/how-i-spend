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
  note: null,
}

function res(body: unknown, status = 200, ok = true) {
  return { ok, status, statusText: 'x', json: async () => body }
}

/** Fake backend with state: DELETE removes the expense, so the refetched list is empty. */
function stubApi(deleteResponse = { ok: true, status: 204, statusText: 'No Content' }) {
  let expenses = [expense]
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/categories')) return res(['Food'])
    if (init?.method === 'DELETE') {
      if (deleteResponse.ok) expenses = []
      return { ...deleteResponse, json: async () => ({ detail: 'Expense not found.' }) }
    }
    return res(expenses)
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

function deleteCalls(fetchMock: ReturnType<typeof stubApi>) {
  return fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')
}

async function openDeleteDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Delete Starbucks' }))
  return within(await screen.findByRole('alertdialog'))
}

test('Delete opens a dialog naming the expense and sends nothing yet', async () => {
  const fetchMock = stubApi()
  const user = userEvent.setup()
  renderPage()

  const dialog = await openDeleteDialog(user)

  expect(dialog.getByText('Delete this expense?')).toBeInTheDocument()
  expect(
    dialog.getByText(/Starbucks, ₹250\.00 on 2 Nov 2026\. This cannot be undone\./),
  ).toBeInTheDocument()
  expect(deleteCalls(fetchMock)).toHaveLength(0)
})

test('confirming deletes the expense, closes the dialog and it leaves the list', async () => {
  const fetchMock = stubApi()
  const user = userEvent.setup()
  renderPage()
  const dialog = await openDeleteDialog(user)

  await user.click(dialog.getByRole('button', { name: 'Delete' }))

  expect(await screen.findByText('No expenses yet.')).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(deleteCalls(fetchMock)).toHaveLength(1)
  expect(deleteCalls(fetchMock)[0][0]).toBe('/api/v1/expenses/abc')
})

test('Keep it closes the dialog and keeps the expense', async () => {
  const fetchMock = stubApi()
  const user = userEvent.setup()
  renderPage()
  const dialog = await openDeleteDialog(user)

  await user.click(dialog.getByRole('button', { name: 'Keep it' }))

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(screen.getByText('Starbucks')).toBeInTheDocument()
  expect(deleteCalls(fetchMock)).toHaveLength(0)
})

test('Escape closes the dialog without deleting', async () => {
  const fetchMock = stubApi()
  const user = userEvent.setup()
  renderPage()
  await openDeleteDialog(user)

  await user.keyboard('{Escape}')

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(deleteCalls(fetchMock)).toHaveLength(0)
})

test('a failed delete shows the reason in the dialog and keeps the expense', async () => {
  stubApi({ ok: false, status: 404, statusText: 'Not Found' })
  const user = userEvent.setup()
  renderPage()
  const dialog = await openDeleteDialog(user)

  await user.click(dialog.getByRole('button', { name: 'Delete' }))

  expect(await dialog.findByRole('alert')).toHaveTextContent('Could not delete: Expense not found.')
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  expect(screen.getByText('Starbucks')).toBeInTheDocument()
})
