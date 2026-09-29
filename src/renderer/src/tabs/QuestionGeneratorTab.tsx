import { useEffect, useState } from 'react'
import { Box, Button, chakra, Flex, Grid, Spinner, Stack, Text } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'motion/react'
import { LuChevronRight, LuHistory, LuRefreshCw, LuRotateCcw, LuX } from 'react-icons/lu'
import type { QuizStats, ReviewQuestion } from '@shared/types'
import ErrorBanner from '../components/ErrorBanner'
import Page from '../components/Page'
import QuizProgress from '../components/QuizProgress'
import QuizQuestionCard from '../components/QuizQuestionCard'
import QuizSetup from '../components/QuizSetup'
import { isActivatableButton, isTypingTarget } from '../lib/hotkeys'
import { countMistakes, napak, odprtih, percent } from '../lib/quizStats'
import { useNavStore } from '../store/useNavStore'
import { useQuizStore } from '../store/useQuizStore'
import { crossfade, popIn, slideAcross } from '../theme/motion'
import { card, kicker, primaryButton, quietButton, secondaryButton } from '../theme/styles'

/** 1–4 (number row or numpad) and A–D pick an answer; null for any other key. */
function answerForKey(event: KeyboardEvent): number | null {
  const digit = /^(?:Digit|Numpad)([1-4])$/.exec(event.code)
  if (digit) return Number(digit[1]) - 1
  const letter = 'abcd'.indexOf(event.key.toLowerCase())
  return event.key.length === 1 && letter >= 0 ? letter : null
}

function Kbd({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Box
      as="kbd"
      px="1.5"
      py="1px"
      borderRadius="5px"
      borderWidth="1px"
      borderColor="app.borderStrong"
      color="app.textMuted"
      fontFamily="inherit"
      fontWeight="600"
    >
      {children}
    </Box>
  )
}

/** The shortcuts, under the round's panels. */
function KeyLegend(): React.JSX.Element {
  return (
    <Stack gap="2" px="1" fontSize="12px" color="app.textFaint">
      <Flex align="center" gap="2">
        <Kbd>1–4</Kbd>
        <Kbd>A–D</Kbd>
        odgovor
      </Flex>
      <Flex align="center" gap="2">
        <Kbd>Enter</Kbd>
        <Kbd>→</Kbd>
        naprej
      </Flex>
    </Stack>
  )
}

/** Right and wrong so far, and the subject's accuracy over every round. */
function RoundPanel({
  right,
  wrong,
  predmet,
  stats
}: {
  right: number
  wrong: number
  predmet: string | undefined
  stats: QuizStats | null
}): React.JSX.Element {
  const subject = stats?.subjects.find((line) => line.predmet === predmet)
  return (
    <Box {...card} p="5" data-round>
      <Text {...kicker} mb="3">
        Ta krog
      </Text>
      <Grid templateColumns="repeat(2, minmax(0, 1fr))" gap="2">
        {[
          { value: right, label: 'pravilno', color: 'app.success' },
          { value: wrong, label: 'napačno', color: 'app.danger' }
        ].map((stat) => (
          <Box key={stat.label}>
            <Text fontSize="24px" fontWeight="800" lineHeight="1.1" color={stat.color} fontVariantNumeric="tabular-nums">
              {stat.value}
            </Text>
            <Text fontSize="12px" color="app.textMuted">
              {stat.label}
            </Text>
          </Box>
        ))}
      </Grid>
      {subject && (
        <Text mt="3.5" pt="3" borderTopWidth="1px" borderColor="app.border" fontSize="12px" color="app.textFaint">
          {subject.predmet} skupaj:{' '}
          <Text as="span" color="app.textMuted">
            {percent(subject.correct, subject.answered)} natančnost
          </Text>
        </Text>
      )}
    </Box>
  )
}

/**
 * Standalone quiz over the Slovenian school curriculum. Shares nothing with
 * the other tabs — see GEMINI_PROMPT_SPEC.md for the prompt and the validation
 * rules, both of which live in the main process.
 *
 * Two levels of motion: the whole screen crossfades when the status changes,
 * and within play the question body slides across while the header and the
 * progress above it stay put.
 */
export default function QuestionGeneratorTab(): React.JSX.Element {
  const {
    mode,
    selection,
    config,
    questions,
    index,
    answers,
    status,
    error,
    start,
    startReview,
    answer,
    next,
    reset,
    retry,
    continueRound,
    endRound
  } = useQuizStore()
  const [mistakesLeft, setMistakesLeft] = useState<number | null>(null)
  const [stats, setStats] = useState<QuizStats | null>(null)
  const answeredCount = Object.keys(answers).length

  // After a review round, how many mistakes are still open for that selection.
  useEffect(() => {
    if (status !== 'finished' || mode !== 'review' || !selection) return
    let current = true
    setMistakesLeft(null)
    window.api.questions
      .stats()
      .then((latest) => current && setMistakesLeft(countMistakes(latest, selection.razred, selection.predmet)))
      .catch(() => {})
    return () => {
      current = false
    }
  }, [status, mode, selection])

  // The side panel's accuracy and open mistakes, refreshed after every answer.
  // A local file read, never an AI call.
  useEffect(() => {
    if (status !== 'playing' && status !== 'finished') return
    let current = true
    window.api.questions
      .stats()
      .then((next) => current && setStats(next))
      .catch(() => {})
    return () => {
      current = false
    }
  }, [status, answeredCount])

  const activeTab = useNavStore((state) => state.tab)

  // Answer and move on from the keyboard. Every tab stays mounted, so this only
  // listens while the quiz is actually the tab on screen and a question is up.
  useEffect(() => {
    if (activeTab !== 'questions' || status !== 'playing') return

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.ctrlKey || event.altKey || event.metaKey || event.repeat) return
      if (isTypingTarget(event.target)) return
      const question = questions[index]
      if (!question) return
      const answered = answers[index] !== undefined

      const choice = answerForKey(event)
      if (choice !== null) {
        if (!answered && choice < question.odgovori.length) {
          event.preventDefault()
          answer(choice)
        }
        return
      }

      const advance = event.key === 'Enter' || event.key === 'ArrowRight'
      // A focused, enabled button takes Enter itself — handling it here too
      // would advance twice.
      if (!advance || !answered) return
      if (event.key === 'Enter' && isActivatableButton(event.target)) return
      event.preventDefault()
      next()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [activeTab, status, questions, index, answers, answer, next])

  const results = questions.map((question, position) =>
    answers[position] === undefined ? undefined : answers[position] === question.pravilen
  )
  const right = results.filter((result) => result === true).length
  const wrong = results.filter((result) => result === false).length
  const roundLabel = config ? `${config.predmet} · ${config.razred}` : undefined

  function renderScreen(): React.JSX.Element {
    if (status === 'setup') {
      return (
        <QuizSetup onStart={(chosen) => void start(chosen)} onReview={(chosen) => void startReview(chosen)} />
      )
    }

    if (status === 'loading') {
      return (
        <Page eyebrow={mode === 'review' ? 'Ponavljanje napak' : roundLabel} title="Pripravljam vprašanja…">
          <Flex {...card} align="center" gap="3" p="6" color="app.textMuted">
            <Spinner color="app.accent" size="sm" />
            <Text fontSize="14px">{mode === 'review' ? 'Iščem tvoje napake…' : 'AI piše vprašanja.'}</Text>
          </Flex>
        </Page>
      )
    }

    if (status === 'error') {
      return (
        <Page eyebrow="Kviz" title="Nekaj je šlo narobe">
          <Stack gap="3" align="flex-start">
            <Box alignSelf="stretch">
              <ErrorBanner message={error ?? 'Nekaj je šlo narobe.'} />
            </Box>
            <Flex gap="2">
              <Button h="38px" px="4" gap="2" {...primaryButton} onClick={() => void retry()}>
                <LuRefreshCw /> Poskusi znova
              </Button>
              <Button h="38px" px="4" {...secondaryButton} onClick={reset}>
                Nazaj
              </Button>
            </Flex>
          </Stack>
        </Page>
      )
    }

    if (status === 'finished') {
      const review = mode === 'review'
      return (
        <Page
          eyebrow={
            review
              ? `Ponavljanje napak${
                  mistakesLeft === null
                    ? ''
                    : mistakesLeft === 0
                      ? ' · vse popravljene'
                      : ` · še ${mistakesLeft} ${odprtih(mistakesLeft)}`
                }`
              : roundLabel
          }
          title={
            <motion.span variants={popIn} initial="hidden" animate="shown" style={{ display: 'inline-block' }}>
              {right}{' '}
              <Text as="span" color="app.textFaint">
                od {questions.length} pravilnih
              </Text>
            </motion.span>
          }
          aside={<RoundPanel right={right} wrong={wrong} predmet={config?.predmet} stats={stats} />}
        >
          <Stack gap="6" data-review-finished={review || undefined}>
            <QuizProgress results={results} current={-1} />
            <Flex gap="2" wrap="wrap">
              {review ? (
                <>
                  {mistakesLeft !== 0 && selection && (
                    <Button
                      h="42px"
                      px="4"
                      gap="2"
                      {...primaryButton}
                      disabled={mistakesLeft === null}
                      onClick={() => void startReview(selection)}
                    >
                      <LuHistory /> Ponovi napake
                    </Button>
                  )}
                  <Button h="42px" px="4" gap="2" {...secondaryButton} onClick={reset}>
                    <LuRotateCcw /> Nazaj
                  </Button>
                </>
              ) : (
                <>
                  <Button h="42px" px="5" {...primaryButton} onClick={() => void continueRound()}>
                    Naslednji krog
                  </Button>
                  <Button h="42px" px="4" gap="2" {...secondaryButton} onClick={() => void retry()}>
                    <LuRefreshCw /> Nova vprašanja
                  </Button>
                  <Button h="42px" px="4" gap="2" {...quietButton} onClick={reset}>
                    <LuRotateCcw /> Spremeni nastavitve
                  </Button>
                </>
              )}
            </Flex>
          </Stack>
        </Page>
      )
    }

    const question = questions[index]
    if (!question) return <Box />

    // A review question carries its own subject and class.
    const review = mode === 'review' ? (question as ReviewQuestion) : null
    const openMistakes = mode === 'new' && selection ? countMistakes(stats, selection.razred, selection.predmet) : 0

    return (
      <Page
        // With a random pick the user would otherwise not know what they drew.
        eyebrow={
          <span data-quiz-context>
            {review ? `Ponavljanje napak · ${review.predmet} · ${review.razred}` : roundLabel}
          </span>
        }
        title={
          <Box as="span" fontVariantNumeric="tabular-nums">
            Vprašanje {index + 1}{' '}
            <Text as="span" color="app.textFaint">
              od {questions.length}
            </Text>
          </Box>
        }
        actions={
          // Deliberately quiet, and away from the primary Naprej/Zaključi button.
          <Button
            h="32px"
            px="3"
            gap="1.5"
            fontSize="13px"
            {...secondaryButton}
            borderColor="app.border"
            borderRadius="8px"
            color="app.textMuted"
            _hover={{ bg: 'app.surfaceHover', color: 'app.text' }}
            onClick={endRound}
          >
            <LuX /> Končaj kviz
          </Button>
        }
        aside={
          <>
            <RoundPanel right={right} wrong={wrong} predmet={review?.predmet ?? config?.predmet} stats={stats} />
            {openMistakes > 0 && selection && (
              <chakra.button
                type="button"
                display="flex"
                alignItems="center"
                gap="3"
                px="4"
                py="3.5"
                {...card}
                color="app.text"
                textAlign="left"
                cursor="pointer"
                _hover={{ bg: 'app.surfaceHover' }}
                title="Vprašanja z napačnim odgovorom, še enkrat. Brez klica AI. Ta krog se konča."
                onClick={() => void startReview(selection)}
              >
                <Flex as="span" color="app.textMuted">
                  <LuHistory />
                </Flex>
                <Box as="span" flex="1" minW="0">
                  <Text as="span" display="block" fontSize="13px" fontWeight="600">
                    Ponovi napake
                  </Text>
                  <Text as="span" display="block" fontSize="12px" color="app.textFaint">
                    {openMistakes} {odprtih(openMistakes)} {napak(openMistakes)}
                  </Text>
                </Box>
                <Flex as="span" color="app.textFaint">
                  <LuChevronRight />
                </Flex>
              </chakra.button>
            )}
            <KeyLegend />
          </>
        }
      >
        {/* Outside the sliding body, so the bar holds still between questions. */}
        <QuizProgress results={results} current={index} />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={question.id} variants={slideAcross} initial="hidden" animate="shown" exit="exit">
            <QuizQuestionCard
              question={question}
              chosen={answers[index]}
              onChoose={answer}
              onNext={next}
              isLast={index + 1 === questions.length}
            />
          </motion.div>
        </AnimatePresence>
      </Page>
    )
  }

  return (
    // initial={false}: the tab opens on whatever screen it is on, no entrance.
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={status} variants={crossfade} initial="hidden" animate="shown" exit="exit">
        {renderScreen()}
      </motion.div>
    </AnimatePresence>
  )
}
