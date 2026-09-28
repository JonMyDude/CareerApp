import { useEffect, useState } from 'react'
import { Box, Button, Flex, Heading, Spinner, Stack, Text } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'motion/react'
import { LuHistory, LuRefreshCw, LuRotateCcw, LuX } from 'react-icons/lu'
import type { ReviewQuestion } from '@shared/types'
import ErrorBanner from '../components/ErrorBanner'
import QuizProgress from '../components/QuizProgress'
import QuizQuestionCard from '../components/QuizQuestionCard'
import QuizSetup from '../components/QuizSetup'
import { isActivatableButton, isTypingTarget } from '../lib/hotkeys'
import { countMistakes, odprtih } from '../lib/quizStats'
import { useNavStore } from '../store/useNavStore'
import { useQuizStore } from '../store/useQuizStore'
import { crossfade, popIn, slideAcross } from '../theme/motion'

/** 1–4 (number row or numpad) and A–D pick an answer; null for any other key. */
function answerForKey(event: KeyboardEvent): number | null {
  const digit = /^(?:Digit|Numpad)([1-4])$/.exec(event.code)
  if (digit) return Number(digit[1]) - 1
  const letter = 'abcd'.indexOf(event.key.toLowerCase())
  return event.key.length === 1 && letter >= 0 ? letter : null
}

/**
 * Standalone quiz over the Slovenian school curriculum. Shares nothing with
 * the other two tabs — see GEMINI_PROMPT_SPEC.md for the prompt and the
 * validation rules, both of which live in the main process.
 *
 * Two levels of motion: the whole screen crossfades when the status changes,
 * and within play the question body slides across while the progress bar
 * above it stays put.
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

  // After a review round, how many mistakes are still open for that selection.
  useEffect(() => {
    if (status !== 'finished' || mode !== 'review' || !selection) return
    let current = true
    setMistakesLeft(null)
    window.api.questions
      .stats()
      .then((stats) => current && setMistakesLeft(countMistakes(stats, selection.razred, selection.predmet)))
      .catch(() => {})
    return () => {
      current = false
    }
  }, [status, mode, selection])
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

  function renderScreen(): React.JSX.Element {
    if (status === 'setup') {
      return (
        <QuizSetup
          onStart={(chosen) => void start(chosen)}
          onReview={(chosen) => void startReview(chosen)}
        />
      )
    }

    if (status === 'loading') {
      return (
        <Flex direction="column" align="center" gap="3" py="16" color="app.textMuted">
          <Spinner color="app.accent" />
          <Text fontSize="sm">Pripravljam vprašanja…</Text>
        </Flex>
      )
    }

    if (status === 'error') {
      return (
        <Stack gap="4" maxW="520px" mx="auto" py="8">
          <ErrorBanner message={error ?? 'Nekaj je šlo narobe.'} />
          <Flex gap="2">
            <Button
              onClick={() => void retry()}
              bg="app.accent"
              color="app.accentFg"
              _hover={{ bg: 'app.accentHover' }}
              size="sm"
            >
              <LuRefreshCw /> Poskusi znova
            </Button>
            <Button
              onClick={reset}
              variant="outline"
              size="sm"
              color="app.text"
              borderColor="app.border"
              _hover={{ bg: 'app.surfaceHover' }}
            >
              Nazaj
            </Button>
          </Flex>
        </Stack>
      )
    }

    if (status === 'finished') {
      const score = questions.reduce(
        (total, question, i) => total + (answers[i] === question.pravilen ? 1 : 0),
        0
      )

      if (mode === 'review') {
        return (
          <Stack gap="5" maxW="520px" mx="auto" py="10" textAlign="center" data-review-finished>
            <motion.div variants={popIn} initial="hidden" animate="shown">
              <Heading size="md" color="app.text">
                {score} od {questions.length}
              </Heading>
              <Text fontSize="sm" color="app.textMuted" mt="2">
                Ponavljanje napak
                {mistakesLeft !== null &&
                  (mistakesLeft === 0
                    ? ' · vse popravljene'
                    : ` · še ${mistakesLeft} ${odprtih(mistakesLeft)}`)}
              </Text>
            </motion.div>
            <Flex gap="2" justify="center">
              {mistakesLeft !== 0 && selection && (
                <Button
                  onClick={() => void startReview(selection)}
                  bg="app.accent"
                  color="app.accentFg"
                  _hover={{ bg: 'app.accentHover' }}
                  size="sm"
                  disabled={mistakesLeft === null}
                >
                  <LuHistory /> Ponovi napake
                </Button>
              )}
              <Button
                onClick={reset}
                variant="outline"
                size="sm"
                color="app.text"
                borderColor="app.border"
                _hover={{ bg: 'app.surfaceHover' }}
              >
                <LuRotateCcw /> Nazaj
              </Button>
            </Flex>
          </Stack>
        )
      }

      return (
        <Stack gap="5" maxW="520px" mx="auto" py="10" textAlign="center">
          <motion.div variants={popIn} initial="hidden" animate="shown">
            <Heading size="md" color="app.text">
              {score} od {questions.length}
            </Heading>
            <Text fontSize="sm" color="app.textMuted" mt="2">
              {config?.predmet}, {config?.razred}
            </Text>
          </motion.div>
          <Flex gap="2" justify="center">
            <Button
              onClick={() => void continueRound()}
              bg="app.accent"
              color="app.accentFg"
              _hover={{ bg: 'app.accentHover' }}
              size="sm"
            >
              Naslednji krog
            </Button>
            <Button
              onClick={() => void retry()}
              variant="outline"
              size="sm"
              color="app.text"
              borderColor="app.border"
              _hover={{ bg: 'app.surfaceHover' }}
            >
              <LuRefreshCw /> Nova vprašanja
            </Button>
            <Button
              onClick={reset}
              variant="ghost"
              size="sm"
              color="app.textMuted"
              _hover={{ bg: 'app.surfaceHover' }}
            >
              <LuRotateCcw /> Spremeni nastavitve
            </Button>
          </Flex>
        </Stack>
      )
    }

    const question = questions[index]
    if (!question) return <Box />

    const answered = questions.filter((_, position) => answers[position] !== undefined).length

    return (
      <Stack gap="4" maxW="720px" mx="auto">
        <Flex align="center" justify="space-between" gap="3">
          {/* With a random pick the user would otherwise not know what they drew.
              A review question carries its own subject and class. */}
          <Text fontSize="xs" color="app.textFaint" truncate data-quiz-context>
            {mode === 'review'
              ? `Ponavljanje napak · ${(question as ReviewQuestion).predmet} · ${(question as ReviewQuestion).razred}`
              : `${config?.predmet} · ${config?.razred}`}
          </Text>
          {/* Deliberately quiet, and away from the primary Naprej/Zaključi button. */}
          <Button
            onClick={endRound}
            variant="ghost"
            size="xs"
            flexShrink="0"
            color="app.textFaint"
            _hover={{ bg: 'app.surfaceHover', color: 'app.text' }}
          >
            <LuX /> Končaj kviz
          </Button>
        </Flex>

        {/* Outside the sliding body, so the bar holds still between questions. */}
        <QuizProgress answered={answered} total={questions.length} />

        {/* The counter and topic travel with their question: in a fixed row they
            would show the next question's labels while the old one is leaving. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={question.id}
            variants={slideAcross}
            initial="hidden"
            animate="shown"
            exit="exit"
          >
            <QuizQuestionCard
              question={question}
              position={index + 1}
              total={questions.length}
              chosen={answers[index]}
              onChoose={answer}
              onNext={next}
              isLast={index + 1 === questions.length}
            />
          </motion.div>
        </AnimatePresence>
      </Stack>
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
