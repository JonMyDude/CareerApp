import { Box, chakra } from '@chakra-ui/react'

/**
 * The switch's track and knob, drawn from app tokens only: Chakra's own Switch
 * takes its colours from a palette that ignores our data-theme. On its own it
 * is only a picture — for a whole row that toggles, as on the Daily tab.
 */
export function SwitchTrack({ checked, disabled = false }: { checked: boolean; disabled?: boolean }): React.JSX.Element {
  return (
    <Box
      as="span"
      display="block"
      flexShrink="0"
      w="32px"
      h="18px"
      p="2px"
      borderRadius="full"
      bg={checked ? 'app.accent' : 'app.borderStrong'}
      opacity={disabled ? 0.5 : 1}
      transition="background-color 150ms ease"
    >
      <Box
        as="span"
        display="block"
        w="14px"
        h="14px"
        borderRadius="full"
        bg="app.switchKnob"
        transform={checked ? 'translateX(14px)' : undefined}
        transition="transform 150ms ease"
      />
    </Box>
  )
}

/** An on/off switch that is its own button. */
export default function ToggleSwitch({
  checked,
  onChange,
  label,
  disabled = false
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}): React.JSX.Element {
  return (
    <chakra.button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      flexShrink="0"
      borderRadius="full"
      cursor={disabled ? 'not-allowed' : 'pointer'}
    >
      <SwitchTrack checked={checked} disabled={disabled} />
    </chakra.button>
  )
}
