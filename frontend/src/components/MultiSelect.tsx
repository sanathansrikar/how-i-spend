import { ChevronDownIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type Props = {
  /** Id for the trigger, so a <Label htmlFor> can name it. */
  id: string
  options: string[]
  value: string[]
  onChange: (value: string[]) => void
  /** Shown on the trigger when nothing is selected, e.g. "All categories". */
  placeholder: string
  /** Most options that may be selected; the rest are disabled once it is reached. */
  max?: number
}

/** "Food", "Food, Bills", then "3 selected": short enough to fit the trigger. */
function summary(value: string[], placeholder: string): string {
  if (value.length === 0) return placeholder
  if (value.length <= 2) return value.join(', ')
  return `${value.length} selected`
}

/** A dropdown of checkboxes, for choosing several of a short list of names. */
export function MultiSelect({ id, options, value, onChange, placeholder, max }: Props) {
  const atMax = max !== undefined && value.length >= max

  function toggle(option: string, checked: boolean) {
    onChange(checked ? [...value, option] : value.filter((name) => name !== option))
  }

  return (
    <Popover>
      <PopoverTrigger
        id={id}
        render={<Button variant="outline" className="w-52 justify-between font-normal" />}
      >
        <span className="truncate">{summary(value, placeholder)}</span>
        <ChevronDownIcon aria-hidden="true" className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 gap-1">
        {options.length === 0 && (
          <p className="px-1 text-muted-foreground">Nothing to choose yet.</p>
        )}
        {options.map((option) => (
          <label
            key={option}
            className="flex items-center gap-2 rounded px-1 py-1 hover:bg-muted has-[:disabled]:opacity-50"
          >
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={value.includes(option)}
              // Once max are chosen, only the chosen ones stay clickable (to uncheck them).
              disabled={atMax && !value.includes(option)}
              onChange={(event) => toggle(option, event.target.checked)}
            />
            {option}
          </label>
        ))}
        {value.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onChange([])}>
            Clear
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
