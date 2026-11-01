import { useQuery } from '@tanstack/react-query'
import { Route, Routes } from 'react-router-dom'
import { api } from './lib/api'

function Home() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => api<{ status: string }>('/health'),
    retry: false,
  })

  const label = health.isPending ? 'checking…' : health.isError ? 'offline' : health.data.status

  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold">Welcome</h2>
      <p className="text-slate-600">Expense tracking is coming soon.</p>
      <p className="text-sm text-slate-500">
        API status: <span data-testid="api-status">{label}</span>
      </p>
    </section>
  )
}

export default function App() {
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <h1 className="text-lg font-bold">how-i-spend</h1>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </main>
    </div>
  )
}
