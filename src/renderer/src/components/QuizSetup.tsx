import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Flex, Stack, Text } from '@chakra-ui/react'
import { LuHistory, LuPlay } from 'react-icons/lu'
import { card, primaryButton, secondaryButton } from '../theme/styles'
import Dropdown from './Dropdown'
import Page from './Page'
import {
  DIFFICULTY_LABELS,
  MAX_QUESTIONS,
  MIN_QUESTIONS,
  RANDOM,
  RAZREDI,
  allSubjects,
  subjectsFor
} from '@shared/curriculum'
import type { QuizStats } from '@shared/types'
import { countMistakes } from '../lib/quizStats'
import { loadQuizSelection, saveQuizSelection, type QuizSelection } from '../store/quizPrefs'
import QuizStatsPanel from './QuizStatsPanel'

interface Props {
  onStart: (selection: QuizSelection) => void
  /** Re-ask past mistakes for this selection — no AI call. */
  onReview: (selection: QuizSelection) => void
}

const RANDOM_OPTION = { value: RANDOM, label: 'Naključno' }

/** A labelled dropdown — the option lists are fixed, so there is nothing to search. */
function Select({
  label,
  value,
  options,
  onChange,
  placeholder
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  placeholder?: string
}): React.JSX.Element {
  return (
    <Box>
      <Text fontSize="13px" fontWeight="600" color="app.textMuted" mb="1.5">
        {label}
      </Text>
      <Dropdown
        label={label}
        h="40px"
        bg="app.surfaceSubtle"
        value={value}
        options={options}
        onChange={onChange}
        placeholder={placeholder}
      />
    </Box>
  )
}

export default function QuizSetup({ onStart, onReview }: Props): React.JSX.Element {
  // Restored from the last session, so the app opens where you left it.
  const saved = useMemo(() => loadQuizSelection(), [])
  const [razred, setRazred] = useState(saved.razred)
  const [predmet, setPredmet] = useState(saved.predmet)
  const [tezavnost, setTezavnost] = useState(saved.tezavnost)
  const [stevilo, setStevilo] = useState(saved.stevilo)
  const [stats, setStats] = useState<QuizStats | null>(null)

  // Fresh on every visit to the setup screen, so a finished round shows up.
  useEffect(() => {
    let current = true
    window.api.questions
      .stats()
      .then((next) => current && setStats(next))
      .catch(() => {})
    return () => {
      current = false
    }
  }, [])

  // Persist on every change, not only on start — the settings should survive
  // even if the app is closed from the setup screen.
  useEffect(() => {
    saveQuizSelection({ razred, predmet, tezavnost, stevilo })
  }, [razred, predmet, tezavnost, stevilo])

  // With a random class, any subject is fair game; resolveSelection() then
  // picks a class that actually teaches whichever subject is chosen.
  const subjects = useMemo(() => {
    if (!razred) return []
    return razred === RANDOM ? allSubjects() : subjectsFor(razred)
  }, [razred])

  // Primary school and gimnazija have different subject lists, so a subject
  // picked for one level may not exist in the other.
  function changeRazred(next: string): void {
    setRazred(next)
    if (next === RANDOM || predmet === RANDOM) return
    if (predmet && !subjectsFor(next).includes(predmet)) setPredmet('')
  }

  const ready = Boolean(razred && predmet)
  // Mistakes for exactly this class and subject; "Naključno" counts them all.
  const mistakeCount = countMistakes(stats, razred, predmet)

  return (
    <Page
      eyebrow="Kviz"
      title="Ponovi šolsko snov"
      aside={stats && stats.subjects.length > 0 ? <QuizStatsPanel stats={stats} /> : undefined}
    >
      <Stack {...card} gap="5" p="6">
        <Text fontSize="14px" color="app.textMuted">
          Izberi razred in predmet. Vprašanja so iz slovenskega učnega načrta.
        </Text>

        <Select
          label="Razred"
          value={razred}
          onChange={changeRazred}
          placeholder="Izberi razred…"
          options={[RANDOM_OPTION, ...RAZREDI.map((value) => ({ value, label: value }))]}
        />

        <Select
          label="Predmet"
          value={predmet}
          onChange={setPredmet}
          placeholder={razred ? 'Izberi predmet…' : 'Najprej izberi razred'}
          options={[RANDOM_OPTION, ...subjects.map((value) => ({ value, label: value }))]}
        />

        <Flex gap="4">
          <Box flex="1">
            <Select
              label="Težavnost"
              value={String(tezavnost)}
              onChange={(value) => setTezavnost(Number(value))}
              options={[1, 2, 3].map((level) => ({
                value: String(level),
                label: `${level} — ${DIFFICULTY_LABELS[level].split(' — ')[0]}`
              }))}
            />
          </Box>
          <Box flex="1">
            <Select
              label="Število vprašanj"
              value={String(stevilo)}
              onChange={(value) => setStevilo(Number(value))}
              options={Array.from({ length: MAX_QUESTIONS - MIN_QUESTIONS + 1 }, (_, i) => {
                const n = MIN_QUESTIONS + i
                return { value: String(n), label: String(n) }
              })}
            />
          </Box>
        </Flex>

        <Text fontSize="12px" color="app.textFaint" mt="-2">
          {DIFFICULTY_LABELS[tezavnost]}
        </Text>

        <Flex gap="2" wrap="wrap">
          <Button
            onClick={() => onStart({ razred, predmet, tezavnost, stevilo })}
            disabled={!ready}
            h="42px"
            px="5"
            gap="2"
            fontSize="14px"
            {...primaryButton}
          >
            <LuPlay /> Začni
          </Button>
          {mistakeCount > 0 && (
            <Button
              onClick={() => onReview({ razred, predmet, tezavnost, stevilo })}
              h="42px"
              px="4"
              gap="2"
              fontSize="14px"
              {...secondaryButton}
              title="Vprašanja z napačnim odgovorom, še enkrat. Brez klica AI."
              data-review
            >
              <LuHistory /> Ponovi napake ({mistakeCount})
            </Button>
          )}
        </Flex>
      </Stack>
    </Page>
  )
}
