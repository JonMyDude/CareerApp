import { useMemo } from 'react'
import { createListCollection, Portal, Select } from '@chakra-ui/react'

/** Chakra's select reads '' as "nothing picked", so a real '' option travels under this key. */
const EMPTY = '__empty__'
const toKey = (value: string): string => (value === '' ? EMPTY : value)
const fromKey = (key: string): string => (key === EMPTY ? '' : key)

interface Props {
  /** Accessible name. */
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  /** Shown while `value` matches no option. */
  placeholder?: string
  h?: string
  w?: string
  /** The field's own background, one step off whatever it sits on. */
  bg?: string
}

/**
 * A themed dropdown. A native <select> opens a list Windows draws itself, which
 * no CSS reaches; this one is ours, in app tokens, with the same keyboard use.
 * Chakra's recipe colours come from its own palette, so every part sets its own.
 */
export default function Dropdown({
  label,
  value,
  options,
  onChange,
  placeholder,
  h = '38px',
  w,
  bg = 'app.surface'
}: Props): React.JSX.Element {
  const collection = useMemo(
    () => createListCollection({ items: options.map((option) => ({ label: option.label, value: toKey(option.value) })) }),
    [options]
  )
  const selected = options.some((option) => option.value === value) ? [toKey(value)] : []

  return (
    <Select.Root
      collection={collection}
      value={selected}
      onValueChange={(details) => {
        const next = details.value[0]
        if (next !== undefined) onChange(fromKey(next))
      }}
      // At least as wide as the field, wider for long labels.
      positioning={{ sameWidth: false, gutter: 4 }}
      w={w}
    >
      <Select.HiddenSelect />
      <Select.Control>
        <Select.Trigger
          aria-label={label}
          h={h}
          minH={h}
          pl="3"
          pr="9"
          fontSize="14px"
          bg={bg}
          color="app.text"
          borderWidth="1px"
          borderColor="app.border"
          borderRadius="9px"
          cursor="pointer"
          _hover={{ borderColor: 'app.borderStrong' }}
          _expanded={{ borderColor: 'app.accent' }}
          _placeholderShown={{ color: 'app.textFaint' }}
        >
          <Select.ValueText placeholder={placeholder} truncate />
        </Select.Trigger>
        <Select.IndicatorGroup>
          <Select.Indicator color="app.textMuted" />
        </Select.IndicatorGroup>
      </Select.Control>
      <Portal>
        <Select.Positioner>
          <Select.Content
            p="1"
            minW="var(--reference-width)"
            maxW="340px"
            maxH="300px"
            bg="app.surface"
            borderWidth="1px"
            borderColor="app.border"
            borderRadius="10px"
            boxShadow="app"
          >
            {collection.items.map((item) => (
              <Select.Item
                key={item.value}
                item={item}
                px="2.5"
                py="2"
                fontSize="14px"
                color="app.text"
                borderRadius="7px"
                cursor="pointer"
                _highlighted={{ bg: 'app.surfaceHover' }}
              >
                {item.label}
                <Select.ItemIndicator color="app.accent" />
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Positioner>
      </Portal>
    </Select.Root>
  )
}
