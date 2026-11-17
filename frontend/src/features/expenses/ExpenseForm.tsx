import { useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useCategories, useCreateExpense, useUpdateExpense, type Expense } from './queries'

/** Today as YYYY-MM-DD in the user's own time zone (en-CA formats dates that way). */
function today(): string {
  return new Date().toLocaleDateString('en-CA')
}

type Props = {
  /** Present: edit this expense. Absent: add a new one. */
  expense?: Expense
  /** Called after a successful edit, and when Cancel is clicked. */
  onDone?: () => void
}

export default function ExpenseForm({ expense, onDone }: Props) {
  const categories = useCategories()
  const createExpense = useCreateExpense()
  const updateExpense = useUpdateExpense()
  const mutation = expense ? updateExpense : createExpense
  // Unique ids: the add form and the edit dialog can be on screen together, and each label must
  // point at its own input.
  const id = useId()
  // Initial state comes from the expense being edited; the parent gives the form a `key` per
  // expense, so switching to another one remounts it with fresh values.
  const [amount, setAmount] = useState(expense?.amount ?? '')
  const [spentOn, setSpentOn] = useState(expense?.spent_on ?? today())
  const [category, setCategory] = useState(expense?.category ?? '')
  const [merchant, setMerchant] = useState(expense?.merchant ?? '')
  const [note, setNote] = useState(expense?.note ?? '')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (expense) {
      updateExpense.mutate(
        {
          id: expense.id,
          // PATCH semantics: null clears a field, so emptied text boxes are sent as null.
          changes: {
            amount,
            spent_on: spentOn,
            category: category || null,
            merchant: merchant || null,
            note: note || null,
          },
        },
        { onSuccess: () => onDone?.() },
      )
      return
    }
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

  const label = expense ? 'Save changes' : 'Add expense'

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-amount`}>Amount</Label>
        <Input
          id={`${id}-amount`}
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
        <Label htmlFor={`${id}-spent_on`}>Date</Label>
        <Input
          id={`${id}-spent_on`}
          type="date"
          required
          value={spentOn}
          onChange={(event) => setSpentOn(event.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-category`}>Category</Label>
        <NativeSelect
          id={`${id}-category`}
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
        <Label htmlFor={`${id}-merchant`}>Merchant</Label>
        <Input
          id={`${id}-merchant`}
          maxLength={100}
          value={merchant}
          onChange={(event) => setMerchant(event.target.value)}
        />
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor={`${id}-note`}>Note</Label>
        <Input id={`${id}-note`} value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
      {mutation.isError && (
        <p role="alert" className="text-sm text-destructive sm:col-span-2">
          {mutation.error.message}
        </p>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : label}
        </Button>
        {expense && (
          <Button type="button" variant="outline" onClick={() => onDone?.()}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
