import { Button, Flex } from '@chakra-ui/react'

interface Props<T extends string | number> {
  /** Accessible name of the group, e.g. "Show". */
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}

/** A row of pill buttons, one selected. Used by the history and interests filters. */
export default function SegmentedControl<T extends string | number>({
  label,
  value,
  options,
  onChange
}: Props<T>): React.JSX.Element {
  return (
    <Flex
      role="radiogroup"
      aria-label={label}
      gap="0.5"
      p="0.5"
      w="fit-content"
      bg="app.surfaceSubtle"
      borderWidth="1px"
      borderColor="app.border"
      borderRadius="md"
    >
      {options.map((option) => {
        const selected = value === option.value
        return (
          <Button
            key={option.value}
            role="radio"
            aria-checked={selected}
            size="xs"
            variant="ghost"
            px="2.5"
            bg={selected ? 'app.surface' : 'transparent'}
            color={selected ? 'app.text' : 'app.textMuted'}
            boxShadow={selected ? 'app' : 'none'}
            _hover={{ color: 'app.text', bg: selected ? 'app.surface' : 'app.surfaceHover' }}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        )
      })}
    </Flex>
  )
}
