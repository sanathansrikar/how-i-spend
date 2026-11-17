import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExpensesPage from './ExpensesPage'

afterEach(() => vi.unstubAllGlobals())

const expense = {
  id: 'abc',
  category: null,
  amount: '10.00',
  currency: 'INR',
  spent_on: '2026-11-02',
  merchant: 'Cafe',
  note: null,
}

function stubApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => ({
      ok: true,
      status: init?.method === 'DELETE' ? 204 : 200,
      statusText: 'x',
      json: async () =>
        url.endsWith('/categories') ? [] : init?.method === 'POST' ? expense : [expense],
    })),
  )
}

/** Renders the page and returns a spy on which cache keys got marked stale. */
function renderWithSpy() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const spy = vi.spyOn(queryClient, 'invalidateQueries')
  render(
    <QueryClientProvider client={queryClient}>
      <ExpensesPage />
    </QueryClientProvider>,
  )
  return () => spy.mock.calls.map(([filters]) => filters?.queryKey?.[0])
}

test('adding an expense also refreshes the monthly summary', async () => {
  stubApi()
  const user = userEvent.setup()
  const invalidated = renderWithSpy()

  await user.type(screen.getByLabelText('Amount'), '10')
  await user.click(screen.getByRole('button', { name: 'Add expense' }))

  await waitFor(() =>
    expect(invalidated()).toEqual(expect.arrayContaining(['expenses', 'summary'])),
  )
})

test('deleting an expense also refreshes the monthly summary', async () => {
  stubApi()
  const user = userEvent.setup()
  const invalidated = renderWithSpy()

  await user.click(await screen.findByRole('button', { name: 'Delete Cafe' }))
  await user.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
  )

  await waitFor(() =>
    expect(invalidated()).toEqual(expect.arrayContaining(['expenses', 'summary'])),
  )
})
