import { Flex, Input, InputGroup } from '@chakra-ui/react'
import { LuSearch } from 'react-icons/lu'
import type { HistoryFilterState } from '../lib/historyFilter'
import { field } from '../theme/styles'
import Dropdown from './Dropdown'
import SegmentedControl from './SegmentedControl'

interface Props {
  value: HistoryFilterState
  onChange: (next: HistoryFilterState) => void
  options: { value: string; label: string }[]
}

const STATUSES: { value: HistoryFilterState['status']; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'done', label: 'Done' },
  { value: 'open', label: 'Open' }
]

/** Search, interest and done/open, above the history. Controlled by the Daily tab. */
export default function HistoryFilter({ value, onChange, options }: Props): React.JSX.Element {
  return (
    <Flex gap="2" wrap="wrap" data-history-filter>
      <InputGroup
        flex="1 1 200px"
        minW="0"
        startElement={<LuSearch />}
        startElementProps={{ color: 'app.textFaint' }}
      >
        <Input
          h="38px"
          value={value.query}
          placeholder="Search suggestions and notes"
          aria-label="Search history"
          onChange={(event) => onChange({ ...value, query: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && value.query) onChange({ ...value, query: '' })
          }}
          {...field}
        />
      </InputGroup>

      {/* One piece, so a narrow window moves both under the search rather than splitting them. */}
      <Flex gap="2" flexShrink="0">
        <Dropdown
          label="Interest"
          w="180px"
          value={value.interest}
          options={[{ value: '', label: 'All interests' }, ...options]}
          onChange={(interest) => onChange({ ...value, interest })}
        />

        <SegmentedControl
          label="Show"
          value={value.status}
          options={STATUSES}
          onChange={(status) => onChange({ ...value, status })}
        />
      </Flex>
    </Flex>
  )
}
