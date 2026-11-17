import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate, formatMoney } from '@/lib/format'
import ExpenseForm from './ExpenseForm'
import { useExpenses, type Expense } from './queries'

export default function ExpensesPage() {
  const expenses = useExpenses()
  const [editing, setEditing] = useState<Expense | null>(null)

  return (
    <div className="space-y-6">
      {/* key: a different expense (or none) remounts the form, so its fields start fresh. */}
      <ExpenseForm
        key={editing?.id ?? 'new'}
        expense={editing ?? undefined}
        onDone={() => setEditing(null)}
      />
      <Card>
        <CardHeader>
          <CardTitle>Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {expenses.isPending && <p className="text-muted-foreground">Loading…</p>}
          {expenses.isError && (
            <p role="alert" className="text-destructive">
              Could not load expenses. Is the API running?
            </p>
          )}
          {expenses.isSuccess && expenses.data.length === 0 && (
            <p className="text-muted-foreground">No expenses yet.</p>
          )}
          {expenses.isSuccess && expenses.data.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.data.map((expense) => {
                  const description = expense.merchant ?? expense.note ?? '—'
                  return (
                    <TableRow key={expense.id}>
                      <TableCell>{formatDate(expense.spent_on)}</TableCell>
                      <TableCell>{description}</TableCell>
                      <TableCell>{expense.category ?? 'Uncategorised'}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(expense.amount, expense.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Edit ${description}`}
                          onClick={() => setEditing(expense)}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
