import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { MultiSelect } from './MultiSelect'

function Harness({ max }: { max?: number }) {
  const [value, setValue] = useState<string[]>([])
  return (
    <MultiSelect
      id="test"
      placeholder="Nothing chosen"
      options={['A', 'B', 'C']}
      value={value}
      onChange={setValue}
      max={max}
    />
  )
}

const trigger = () => document.getElementById('test') as HTMLElement

test('shows the placeholder, then the chosen names', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  expect(trigger()).toHaveTextContent('Nothing chosen')

  await user.click(trigger())
  await user.click(await screen.findByRole('checkbox', { name: 'B' }))

  expect(trigger()).toHaveTextContent('B')
})

test('once max are chosen the others are disabled, and unticking frees them', async () => {
  const user = userEvent.setup()
  render(<Harness max={2} />)
  await user.click(trigger())
  await user.click(await screen.findByRole('checkbox', { name: 'A' }))
  await user.click(screen.getByRole('checkbox', { name: 'B' }))

  expect(screen.getByRole('checkbox', { name: 'C' })).toBeDisabled()
  expect(screen.getByRole('checkbox', { name: 'A' })).toBeEnabled()

  await user.click(screen.getByRole('checkbox', { name: 'A' }))

  expect(screen.getByRole('checkbox', { name: 'C' })).toBeEnabled()
})

test('Clear unticks everything', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(trigger())
  await user.click(await screen.findByRole('checkbox', { name: 'A' }))

  await user.click(screen.getByRole('button', { name: 'Clear' }))

  expect(screen.getByRole('checkbox', { name: 'A' })).not.toBeChecked()
  expect(trigger()).toHaveTextContent('Nothing chosen')
})
