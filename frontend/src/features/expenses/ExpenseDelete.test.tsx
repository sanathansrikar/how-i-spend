import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
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

test('the first click only asks for confirmation', async () => {
  const fetchMock = stubApi()
  const user = userEvent.setup()
  renderPage()

  await user.click(await screen.findByRole('button', { name: 'Delete Starbucks' }))

  expect(screen.getByText('Delete?')).toBeInTheDocument()
  expect(deleteCalls(fetchMock)).toHaveLength(0)
})

test('confirming deletes the expense and it leaves the list', async () => {
  const fetchMock = stubApi()
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Delete Starbucks' }))

  await user.click(screen.getByRole('button', { name: 'Confirm delete Starbucks' }))

  expect(await screen.findByText('No expenses yet.')).toBeInTheDocument()
  expect(deleteCalls(fetchMock)).toHaveLength(1)
  expect(deleteCalls(fetchMock)[0][0]).toBe('/api/v1/expenses/abc')
})

test('No keeps the expense and sends nothing', async () => {
  const fetchMock = stubApi()
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Delete Starbucks' }))

  await user.click(screen.getByRole('button', { name: 'No' }))

  expect(screen.getByText('Starbucks')).toBeInTheDocument()
  expect(screen.queryByText('Delete?')).not.toBeInTheDocument()
  expect(deleteCalls(fetchMock)).toHaveLength(0)
})

test('a failed delete shows the reason and keeps the expense', async () => {
  stubApi({ ok: false, status: 404, statusText: 'Not Found' })
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Delete Starbucks' }))

  await user.click(screen.getByRole('button', { name: 'Confirm delete Starbucks' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete: Expense not found.')
  expect(screen.getByText('Starbucks')).toBeInTheDocument()
})

test('deleting the expense being edited returns the form to add mode', async () => {
  stubApi()
  const user = userEvent.setup()
  renderPage()
  await user.click(await screen.findByRole('button', { name: 'Edit Starbucks' }))
  expect(screen.getByText('Edit expense')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Delete Starbucks' }))
  await user.click(screen.getByRole('button', { name: 'Confirm delete Starbucks' }))

  await waitFor(() => expect(screen.queryByText('Edit expense')).not.toBeInTheDocument())
})
