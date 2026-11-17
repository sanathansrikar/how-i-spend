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
import { MultiSelect } from '@/components/MultiSelect'
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
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PAGE_SIZES, useCategories, useDeleteExpense, useExpenses, type Expense } from './queries'

function describe(expense: Expense): string {
  return expense.merchant ?? expense.note ?? '—'
}

export default function ExpensesPage() {
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0])
  // Zero-based; the screen shows page + 1.
  const [page, setPage] = useState(0)
  // Filters: empty string means "no filter". Changing one starts again from page 1.
  const [month, setMonth] = useState('')
  const [category, setCategory] = useState<string[]>([])
  const filtersActive = month !== '' || category.length > 0
  const categories = useCategories()
  const expenses = useExpenses({ pageSize, page, month, category })
  const rows = expenses.data?.rows ?? []
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
          <div className="mb-4 flex flex-wrap items-end gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="filter-month">Month</Label>
              <Input
                id="filter-month"
                type="month"
                className="w-44"
                value={month}
                onChange={(event) => {
                  setMonth(event.target.value)
                  setPage(0)
                }}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="filter-category">Category</Label>
              <MultiSelect
                id="filter-category"
                placeholder="All categories"
                // The API accepts at most 20 names in one request.
                max={20}
                options={categories.data ?? []}
                value={category}
                onChange={(names) => {
                  setCategory(names)
                  setPage(0)
                }}
              />
            </div>
            {filtersActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMonth('')
                  setCategory([])
                  setPage(0)
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
          {expenses.isPending && <p className="text-muted-foreground">Loading…</p>}
          {expenses.isError && (
            <p role="alert" className="text-destructive">
              Could not load expenses. Is the API running?
            </p>
          )}
          {expenses.isSuccess && rows.length === 0 && (
            <p className="text-muted-foreground">
              {page > 0
                ? 'No expenses on this page.'
                : filtersActive
                  ? 'No expenses match these filters.'
                  : 'No expenses yet.'}
            </p>
          )}
          {expenses.isSuccess && rows.length > 0 && (
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
                {rows.map((expense) => (
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
          {expenses.isSuccess && (page > 0 || rows.length > 0) && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
              <label className="flex items-center gap-2">
                Rows per page
                <NativeSelect
                  size="sm"
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value))
                    setPage(0) // a new page size changes what "page 3" means, so start over
                  }}
                >
                  {PAGE_SIZES.map((size) => (
                    <NativeSelectOption key={size} value={size}>
                      {size}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  {rows.length > 0
                    ? `${page * pageSize + 1}–${page * pageSize + rows.length}`
                    : `Page ${page + 1}`}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!expenses.data?.hasNext}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
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
