import { Flex, Input, InputGroup, NativeSelect, Text } from '@chakra-ui/react'
import { LuSearch } from 'react-icons/lu'
import type { HistoryFilterState } from '../lib/historyFilter'
import SegmentedControl from './SegmentedControl'

interface Props {
  value: HistoryFilterState
  onChange: (next: HistoryFilterState) => void
  options: { value: string; label: string }[]
  /** How many history rows match, and how many there are. */
  shown: number
  total: number
  filtering: boolean
}

const STATUSES: { value: HistoryFilterState['status']; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'done', label: 'Done' },
  { value: 'open', label: 'Open' }
]

/** Search, interest and done/open, above the history. Controlled by the Daily tab. */
export default function HistoryFilter({
  value,
  onChange,
  options,
  shown,
  total,
  filtering
}: Props): React.JSX.Element {
  return (
    <Flex direction="column" gap="2" data-history-filter>
      <Flex gap="2" align="center" wrap="wrap">
        <InputGroup flex="1" minW="200px" startElement={<LuSearch />} startElementProps={{ color: 'app.textFaint' }}>
          <Input
            size="sm"
            value={value.query}
            placeholder="Search suggestions and notes"
            aria-label="Search history"
            onChange={(event) => onChange({ ...value, query: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && value.query) onChange({ ...value, query: '' })
            }}
            bg="app.surface"
            color="app.text"
            borderColor="app.border"
            _placeholder={{ color: 'app.textFaint' }}
          />
        </InputGroup>

        <NativeSelect.Root size="sm" w="auto" minW="160px">
          <NativeSelect.Field
            aria-label="Interest"
            value={value.interest}
            onChange={(event) => onChange({ ...value, interest: event.currentTarget.value })}
            bg="app.surface"
            color="app.text"
            borderColor="app.border"
            _hover={{ borderColor: 'app.borderStrong' }}
          >
            <option value="">All interests</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator color="app.textMuted" />
        </NativeSelect.Root>

        <SegmentedControl
          label="Show"
          value={value.status}
          options={STATUSES}
          onChange={(status) => onChange({ ...value, status })}
        />
      </Flex>

      {filtering && (
        <Text fontSize="xs" color="app.textFaint" data-filter-count>
          Showing {shown} of {total}
        </Text>
      )}
    </Flex>
  )
}
