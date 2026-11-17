import { useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  useCategories,
  useCreateCategory,
  useCreateExpense,
  useMe,
  useUpdateExpense,
  type Expense,
} from './queries'

/** Select value for "+ New category…". Real categories are never offered under this value. */
const NEW_CATEGORY = '__new_category__'

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
  const me = useMe()
  const createExpense = useCreateExpense()
  const updateExpense = useUpdateExpense()
  const createCategory = useCreateCategory()
  const mutation = expense ? updateExpense : createExpense
  // Show whichever step failed: creating the category, or saving the expense.
  const error = createCategory.error ?? mutation.error
  const pending = createCategory.isPending || mutation.isPending
  // Unique ids: the add form and the edit dialog can be on screen together, and each label must
  // point at its own input.
  const id = useId()
  // Initial state comes from the expense being edited; the parent gives the form a `key` per
  // expense, so switching to another one remounts it with fresh values.
  const [amount, setAmount] = useState(expense?.amount ?? '')
  // Blank means "my default currency" when adding; editing starts from the expense's own.
  const [currency, setCurrency] = useState(expense?.currency ?? '')
  const [spentOn, setSpentOn] = useState(expense?.spent_on ?? today())
  const [category, setCategory] = useState(expense?.category ?? '')
  const [merchant, setMerchant] = useState(expense?.merchant ?? '')
  const [note, setNote] = useState(expense?.note ?? '')
  const [newCategory, setNewCategory] = useState('')
  const addingCategory = category === NEW_CATEGORY

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    let categoryName = category
    if (addingCategory) {
      try {
        // Two steps: the category must exist before an expense can point at it (by name).
        categoryName = (await createCategory.mutateAsync(newCategory)).name
      } catch {
        return // the error is shown below; nothing else was sent
      }
      // Switch the select to the new category now: if saving the expense fails, a retry must
      // not try to create the same category again.
      setCategory(categoryName)
      setNewCategory('')
    }
    if (expense) {
      updateExpense.mutate(
        {
          id: expense.id,
          // PATCH semantics: null clears a field, so emptied text boxes are sent as null.
          changes: {
            amount,
            // Blank on edit leaves the currency as it was.
            ...(currency && { currency: currency.toUpperCase() }),
            spent_on: spentOn,
            category: categoryName || null,
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
        // Blank leaves it out, and the API uses the user's own currency.
        ...(currency && { currency: currency.toUpperCase() }),
        spent_on: spentOn,
        // Empty select means uncategorised; empty text fields are simply left out.
        category: categoryName || null,
        ...(merchant && { merchant }),
        ...(note && { note }),
      },
      {
        onSuccess: () => {
          setAmount('')
          setCurrency('')
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
        <Label htmlFor={`${id}-currency`}>Currency</Label>
        <Input
          id={`${id}-currency`}
          maxLength={3}
          // Three letters, like INR or USD; the API upper-cases them and checks the shape.
          pattern="[A-Za-z]{3}"
          title="Three letters, like INR or USD"
          placeholder={me.data?.currency ?? ''}
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
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
          onChange={(event) => {
            setCategory(event.target.value)
            createCategory.reset() // forget an old "already exists" error
          }}
        >
          <NativeSelectOption value="">Uncategorised</NativeSelectOption>
          {categories.data?.map((name) => (
            <NativeSelectOption key={name} value={name}>
              {name}
            </NativeSelectOption>
          ))}
          <NativeSelectOption value={NEW_CATEGORY}>+ New category…</NativeSelectOption>
        </NativeSelect>
      </div>
      {addingCategory && (
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-new-category`}>New category name</Label>
          <Input
            id={`${id}-new-category`}
            required
            maxLength={50}
            autoFocus
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
          />
        </div>
      )}
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
      {error && (
        <p role="alert" className="text-sm text-destructive sm:col-span-2">
          {error.message}
        </p>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : label}
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
