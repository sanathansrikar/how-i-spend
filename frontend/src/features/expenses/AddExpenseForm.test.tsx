import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddExpenseForm from './AddExpenseForm'

afterEach(() => vi.unstubAllGlobals())

function jsonResponse(body: unknown, status = 200, ok = true) {
  return { ok, status, statusText: 'x', json: async () => body }
}

/** Fake backend: GET /categories lists names; POST /expenses answers with `postResponse`. */
function stubApi(postResponse: ReturnType<typeof jsonResponse>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/categories')) return jsonResponse(['Bills', 'Food'])
    if (url.endsWith('/expenses') && init?.method === 'POST') return postResponse
    return jsonResponse([])
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderForm() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <AddExpenseForm />
    </QueryClientProvider>,
  )
}

function postedBody(fetchMock: ReturnType<typeof stubApi>) {
  const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
  return JSON.parse(call?.[1]?.body as string)
}

test('sends the expense, with the category by name, then clears the form', async () => {
  const fetchMock = stubApi(jsonResponse({ id: '1' }, 201))
  const user = userEvent.setup()
  renderForm()
  await screen.findByRole('option', { name: 'Food' })

  await user.type(screen.getByLabelText('Amount'), '250.5')
  await user.selectOptions(screen.getByLabelText('Category'), 'Food')
  await user.type(screen.getByLabelText('Merchant'), 'Starbucks')
  await user.click(screen.getByRole('button', { name: 'Add expense' }))

  await waitFor(() => expect(screen.getByLabelText('Amount')).toHaveValue(null))
  expect(postedBody(fetchMock)).toMatchObject({
    amount: '250.5',
    category: 'Food',
    merchant: 'Starbucks',
  })
  expect(postedBody(fetchMock)).not.toHaveProperty('note')
  expect(screen.getByLabelText('Merchant')).toHaveValue('')
})

test('sends category null when left on Uncategorised', async () => {
  const fetchMock = stubApi(jsonResponse({ id: '1' }, 201))
  const user = userEvent.setup()
  renderForm()

  await user.type(screen.getByLabelText('Amount'), '10')
  await user.click(screen.getByRole('button', { name: 'Add expense' }))

  await waitFor(() => expect(postedBody(fetchMock).category).toBeNull())
})

test('shows the backend error and keeps what was typed', async () => {
  stubApi(jsonResponse({ detail: 'Unknown categories: Food.' }, 422, false))
  const user = userEvent.setup()
  renderForm()

  await user.type(screen.getByLabelText('Amount'), '10')
  await user.click(screen.getByRole('button', { name: 'Add expense' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Unknown categories: Food.')
  expect(screen.getByLabelText('Amount')).toHaveValue(10)
})

test('does not send anything without an amount', async () => {
  const fetchMock = stubApi(jsonResponse({ id: '1' }, 201))
  const user = userEvent.setup()
  renderForm()

  await user.click(screen.getByRole('button', { name: 'Add expense' }))

  expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
})
