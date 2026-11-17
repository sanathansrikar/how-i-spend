import { useQuery } from '@tanstack/react-query'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import ExpensesPage from './features/expenses/ExpensesPage'
import SummaryPage from './features/summary/SummaryPage'
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
      <p className="text-slate-600">
        <Link to="/expenses" className="underline">
          View your expenses
        </Link>
        {' · '}
        <Link to="/summary" className="underline">
          Monthly summary
        </Link>
      </p>
      <p className="text-sm text-slate-500">
        API status: <span data-testid="api-status">{label}</span>
      </p>
    </section>
  )
}

/** NavLink marks the link of the current page (aria-current), which we also style. */
function NavItem({ to, children }: { to: string; children: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `text-sm ${isActive ? 'font-semibold text-slate-900' : 'text-slate-500 hover:text-slate-900'}`
      }
    >
      {children}
    </NavLink>
  )
}

export default function App() {
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-6 px-4 py-3">
          <h1 className="text-lg font-bold">how-i-spend</h1>
          <nav aria-label="Main" className="flex gap-4">
            <NavItem to="/expenses">Expenses</NavItem>
            <NavItem to="/summary">Summary</NavItem>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/summary" element={<SummaryPage />} />
        </Routes>
      </main>
    </div>
  )
}
