const API_BASE = '/api/v1'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Thin typed wrapper over fetch; all backend calls go through here. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!response.ok) {
    throw new ApiError(response.status, await errorMessage(response))
  }
  // 204 No Content (e.g. DELETE) has no body to parse.
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/** FastAPI explains errors as {"detail": "..."}; fall back to the HTTP status text. */
async function errorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (body && typeof body === 'object' && 'detail' in body && typeof body.detail === 'string') {
      return body.detail
    }
  } catch {
    // Not JSON: use the status text below.
  }
  return response.statusText
}
