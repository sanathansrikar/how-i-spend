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
import { useDeleteExpense, useExpenses, type Expense } from './queries'

export default function ExpensesPage() {
  const expenses = useExpenses()
  const deleteExpense = useDeleteExpense()
  const [editing, setEditing] = useState<Expense | null>(null)
  // Two-step delete: the first click only asks "Delete?", so one slip never loses data.
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  function handleDelete(expense: Expense) {
    deleteExpense.mutate(expense.id, {
      onSuccess: () => {
        setConfirmingId(null)
        // Deleting the expense being edited must not leave the form pointing at nothing.
        if (editing?.id === expense.id) setEditing(null)
      },
    })
  }

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
          {deleteExpense.isError && (
            <p role="alert" className="mb-2 text-destructive">
              Could not delete: {deleteExpense.error.message}
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
                        {confirmingId === expense.id ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="text-sm">Delete?</span>
                            <Button
                              variant="destructive"
                              size="sm"
                              aria-label={`Confirm delete ${description}`}
                              disabled={deleteExpense.isPending}
                              onClick={() => handleDelete(expense)}
                            >
                              Yes
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setConfirmingId(null)}
                            >
                              No
                            </Button>
                          </span>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Edit ${description}`}
                              onClick={() => setEditing(expense)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Delete ${description}`}
                              onClick={() => {
                                deleteExpense.reset()
                                setConfirmingId(expense.id)
                              }}
                            >
                              Delete
                            </Button>
                          </>
                        )}
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
