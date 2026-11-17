import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatMoney } from '@/lib/format'
import { useMonthlySummary, type MonthlySummary } from './queries'

/** This month as YYYY-MM in the user's own time zone (en-CA formats dates that way). */
function currentMonth(): string {
  return new Date().toLocaleDateString('en-CA').slice(0, 7)
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'bad' }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={`text-2xl font-semibold tabular-nums ${tone === 'bad' ? 'text-destructive' : ''}`}
      >
        {value}
      </p>
    </div>
  )
}

/** A horizontal bar: `percent` of the track is filled. */
function Bar({ percent, bad, label }: { percent: number; bad?: boolean; label: string }) {
  const width = Math.min(100, Math.max(0, percent))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width)}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className={`h-full rounded-full ${bad ? 'bg-destructive' : 'bg-primary'}`}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}

function SummaryBody({ summary }: { summary: MonthlySummary }) {
  const money = (amount: string) => formatMoney(amount, summary.currency)
  const spent = Number(summary.total_spent)
  const budget = summary.monthly_budget === null ? null : Number(summary.monthly_budget)
  const overBudget = summary.budget_remaining !== null && Number(summary.budget_remaining) < 0

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Spent" value={money(summary.total_spent)} />
        {summary.budget_remaining !== null && summary.monthly_budget !== null ? (
          <>
            <Stat label="Budget" value={money(summary.monthly_budget)} />
            <Stat
              label={overBudget ? 'Over budget by' : 'Remaining'}
              value={money(String(Math.abs(Number(summary.budget_remaining))))}
              tone={overBudget ? 'bad' : undefined}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground sm:col-span-2">
            No monthly budget set, so there is nothing to compare against.
          </p>
        )}
      </div>

      {budget !== null && budget > 0 && (
        <Bar label="Budget used" percent={(spent / budget) * 100} bad={overBudget} />
      )}

      {summary.by_category.length === 0 ? (
        <p className="text-muted-foreground">No expenses this month.</p>
      ) : (
        <ul className="space-y-3">
          {summary.by_category.map((row) => {
            const name = row.category ?? 'Uncategorised'
            return (
              <li key={name} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>
                    {name} <span className="text-muted-foreground">({row.count})</span>
                  </span>
                  <span className="tabular-nums">{money(row.total)}</span>
                </div>
                <Bar
                  label={`${name} share of spending`}
                  percent={(Number(row.total) / spent) * 100}
                />
              </li>
            )
          })}
        </ul>
      )}

      {summary.other_currency_count > 0 && (
        <p className="text-sm text-muted-foreground">
          {summary.other_currency_count} expense{summary.other_currency_count === 1 ? '' : 's'} in
          other currencies {summary.other_currency_count === 1 ? 'is' : 'are'} not included above.
        </p>
      )}
    </div>
  )
}

export default function SummaryPage() {
  const [month, setMonth] = useState(currentMonth)
  const summary = useMonthlySummary(month)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid max-w-48 gap-1.5">
          <Label htmlFor="month">Month</Label>
          <Input
            id="month"
            type="month"
            value={month}
            // An emptied picker gives "", which the API would reject; keep the last good month.
            onChange={(event) => event.target.value && setMonth(event.target.value)}
          />
        </div>
        {summary.isPending && <p className="text-muted-foreground">Loading…</p>}
        {summary.isError && (
          <p role="alert" className="text-destructive">
            Could not load the summary: {summary.error.message}
          </p>
        )}
        {summary.isSuccess && <SummaryBody summary={summary.data} />}
      </CardContent>
    </Card>
  )
}
