import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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

function describe(expense: Expense): string {
  return expense.merchant ?? expense.note ?? '—'
}

export default function ExpensesPage() {
  const expenses = useExpenses()
  const deleteExpense = useDeleteExpense()
  // Which expense a dialog is about; null means that dialog is closed.
  const [editing, setEditing] = useState<Expense | null>(null)
  const [deleting, setDeleting] = useState<Expense | null>(null)

  function closeDelete() {
    setDeleting(null)
    // Forget an old error so the next delete dialog starts clean.
    deleteExpense.reset()
  }

  function confirmDelete(expense: Expense) {
    deleteExpense.mutate(expense.id, { onSuccess: closeDelete })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add expense</CardTitle>
        </CardHeader>
        <CardContent>
          <ExpenseForm />
        </CardContent>
      </Card>

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
                {expenses.data.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{formatDate(expense.spent_on)}</TableCell>
                    <TableCell>{describe(expense)}</TableCell>
                    <TableCell>{expense.category ?? 'Uncategorised'}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(expense.amount, expense.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Edit ${describe(expense)}`}
                        onClick={() => setEditing(expense)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Delete ${describe(expense)}`}
                        onClick={() => setDeleting(expense)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog: the form opens centred over the page instead of replacing the add form. */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit expense</DialogTitle>
          </DialogHeader>
          {editing && (
            <ExpenseForm key={editing.id} expense={editing} onDone={() => setEditing(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete dialog: an alert dialog, which keeps focus inside until you choose. */}
      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && closeDelete()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting &&
                `${describe(deleting)}, ${formatMoney(deleting.amount, deleting.currency)} on ${formatDate(deleting.spent_on)}. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteExpense.isError && (
            <p role="alert" className="text-sm text-destructive">
              Could not delete: {deleteExpense.error.message}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteExpense.isPending}
              onClick={() => deleting && confirmDelete(deleting)}
            >
              {deleteExpense.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
