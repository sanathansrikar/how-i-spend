import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

afterEach(() => vi.unstubAllGlobals())

function renderApp() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('shows the API status once the health check succeeds', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) }),
  )

  renderApp()

  expect(screen.getByRole('heading', { name: 'how-i-spend' })).toBeInTheDocument()
  expect(await screen.findByText('ok')).toBeInTheDocument()
})

test('shows offline when the API is unreachable', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))

  renderApp()

  expect(await screen.findByText('offline')).toBeInTheDocument()
})
