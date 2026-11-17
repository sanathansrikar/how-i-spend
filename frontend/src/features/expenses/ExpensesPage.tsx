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
import { useExpenses } from './queries'

export default function ExpensesPage() {
  const expenses = useExpenses()

  return (
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.data.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>{formatDate(expense.spent_on)}</TableCell>
                  <TableCell>{expense.merchant ?? expense.note ?? '—'}</TableCell>
                  <TableCell>{expense.category ?? 'Uncategorised'}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(expense.amount, expense.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
