import { api } from './api'

afterEach(() => vi.unstubAllGlobals())

test('returns undefined for 204 No Content instead of parsing a body', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }))

  expect(await api('/expenses/1', { method: 'DELETE' })).toBeUndefined()
})

test('throws an ApiError carrying the backend detail message', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: async () => ({ detail: 'Unknown categories: Nope.' }),
    }),
  )

  await expect(api('/expenses')).rejects.toMatchObject({
    name: 'ApiError',
    status: 422,
    message: 'Unknown categories: Nope.',
  })
})

test('falls back to the status text when the error body is not JSON', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => {
        throw new Error('not json')
      },
    }),
  )

  await expect(api('/expenses')).rejects.toMatchObject({ status: 502, message: 'Bad Gateway' })
})
