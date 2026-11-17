import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useCategories, useCreateExpense } from './queries'

/** Today as YYYY-MM-DD in the user's own time zone (en-CA formats dates that way). */
function today(): string {
  return new Date().toLocaleDateString('en-CA')
}

export default function AddExpenseForm() {
  const categories = useCategories()
  const createExpense = useCreateExpense()
  const [amount, setAmount] = useState('')
  const [spentOn, setSpentOn] = useState(today)
  const [category, setCategory] = useState('')
  const [merchant, setMerchant] = useState('')
  const [note, setNote] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    createExpense.mutate(
      {
        amount,
        spent_on: spentOn,
        // Empty select means uncategorised; empty text fields are simply left out.
        category: category || null,
        ...(merchant && { merchant }),
        ...(note && { note }),
      },
      {
        onSuccess: () => {
          setAmount('')
          setCategory('')
          setMerchant('')
          setNote('')
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add expense</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="spent_on">Date</Label>
            <Input
              id="spent_on"
              type="date"
              required
              value={spentOn}
              onChange={(event) => setSpentOn(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="category">Category</Label>
            <NativeSelect
              id="category"
              className="w-full"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <NativeSelectOption value="">Uncategorised</NativeSelectOption>
              {categories.data?.map((name) => (
                <NativeSelectOption key={name} value={name}>
                  {name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="merchant">Merchant</Label>
            <Input
              id="merchant"
              maxLength={100}
              value={merchant}
              onChange={(event) => setMerchant(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="note">Note</Label>
            <Input id="note" value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
          {createExpense.isError && (
            <p role="alert" className="text-sm text-destructive sm:col-span-2">
              {createExpense.error.message}
            </p>
          )}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={createExpense.isPending}>
              {createExpense.isPending ? 'Adding…' : 'Add expense'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
