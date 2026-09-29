import { Button, Flex, type FlexProps } from '@chakra-ui/react'

interface Props<T extends string | number> extends Omit<FlexProps, 'onChange'> {
  /** Accessible name of the group, e.g. "Show". */
  label: string
  value: T
  options: { value: T; label: string; icon?: React.ReactNode }[]
  onChange: (value: T) => void
}

/**
 * A row of options, one selected: the history and interest filters, the new
 * interest's importance, the theme. Extra props style the frame, e.g. a
 * taller one inside the add-interest bar.
 */
export default function SegmentedControl<T extends string | number>({
  label,
  value,
  options,
  onChange,
  ...frame
}: Props<T>): React.JSX.Element {
  return (
    <Flex
      role="radiogroup"
      aria-label={label}
      gap="0.5"
      p="3px"
      h="38px"
      w="fit-content"
      flexShrink="0"
      bg="app.surface"
      borderWidth="1px"
      borderColor="app.border"
      borderRadius="9px"
      {...frame}
    >
      {options.map((option) => {
        const selected = value === option.value
        return (
          <Button
            key={option.value}
            role="radio"
            aria-checked={selected}
            h="full"
            px="3"
            gap="1.5"
            fontSize="13px"
            fontWeight="600"
            borderRadius="6px"
            bg={selected ? 'app.surfaceHover' : 'transparent'}
            color={selected ? 'app.text' : 'app.textMuted'}
            _hover={{ color: 'app.text', bg: selected ? 'app.surfaceHover' : 'transparent' }}
            onClick={() => onChange(option.value)}
          >
            {option.icon}
            {option.label}
          </Button>
        )
      })}
    </Flex>
  )
}
