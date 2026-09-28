import { Box, Button, Flex, Stack, Text } from '@chakra-ui/react'
import { motion, type TargetAndTransition } from 'motion/react'
import { LuArrowRight, LuCheck, LuX } from 'react-icons/lu'
import type { QuizQuestion } from '@shared/types'
import { fadeUp, pop, rest, shake } from '../theme/motion'

interface Props {
  question: QuizQuestion
  position: number
  total: number
  /** Undefined until the user picks. */
  chosen: number | undefined
  onChoose: (index: number) => void
  onNext: () => void
  isLast: boolean
}

const LETTERS = ['A', 'B', 'C', 'D']

/**
 * One question: counter, text, the four answers, and — once answered — the
 * explanation and the Naprej button. The progress bar lives in the tab, not
 * here, so it doesn't slide away with each question.
 */
export default function QuizQuestionCard({
  question,
  position,
  total,
  chosen,
  onChoose,
  onNext,
  isLast
}: Props): React.JSX.Element {
  const answered = chosen !== undefined
  const correct = chosen === question.pravilen

  /**
   * The right answer pops, a wrong pick shakes, everything else rests. With
   * `initial={false}` on the wrapper this plays once, when `answered` flips —
   * never on mount.
   */
  function feedbackFor(index: number): TargetAndTransition {
    if (!answered) return rest
    if (index === question.pravilen) return pop
    if (index === chosen) return shake
    return rest
  }

  /** Only reveal colours after an answer — before that everything is neutral. */
  function styleFor(index: number): Record<string, unknown> {
    if (!answered) {
      return {
        borderColor: 'app.border',
        bg: 'app.surface',
        _hover: { borderColor: 'app.accent', bg: 'app.surfaceHover' }
      }
    }
    if (index === question.pravilen) {
      return { borderColor: 'app.success', bg: 'app.surface', _hover: {} }
    }
    if (index === chosen) {
      return { borderColor: 'app.danger', bg: 'app.surface', _hover: {} }
    }
    return { borderColor: 'app.border', bg: 'app.surface', opacity: 0.55, _hover: {} }
  }

  return (
    <Stack gap="5">
      <Flex align="baseline" justify="space-between">
        <Text fontSize="sm" color="app.textMuted">
          Vprašanje {position} od {total}
        </Text>
        <Text fontSize="xs" color="app.textFaint">
          {question.tema}
        </Text>
      </Flex>

      <Text fontSize="lg" fontWeight="medium" color="app.text" lineHeight="1.5">
        {question.vprasanje}
      </Text>

      <Stack gap="2">
        {question.odgovori.map((answer, index) => (
          // Motion sits on a wrapper rather than the Chakra element: both want a
          // `transition` prop, and the button keeps its CSS border transition.
          <motion.div key={index} initial={false} animate={feedbackFor(index)}>
            <Flex
              as="button"
              data-answer={index}
              // @ts-expect-error Chakra passes unknown props through to the element.
              disabled={answered}
              onClick={() => !answered && onChoose(index)}
              // A <button> shrinks to its text unless told otherwise. It used to
              // be stretched by the Stack; inside the motion wrapper it isn't.
              w="full"
              align="center"
              gap="3"
              textAlign="left"
              px="4"
              py="3"
              borderWidth="1px"
              borderRadius="md"
              cursor={answered ? 'default' : 'pointer'}
              transition="border-color 120ms ease"
              {...styleFor(index)}
            >
              <Flex
                align="center"
                justify="center"
                flexShrink="0"
                w="6"
                h="6"
                borderRadius="sm"
                fontSize="xs"
                fontWeight="bold"
                bg={
                  answered && index === question.pravilen
                    ? 'app.success'
                    : answered && index === chosen
                      ? 'app.danger'
                      : 'app.surfaceHover'
                }
                color={
                  answered && (index === question.pravilen || index === chosen)
                    ? 'app.accentFg'
                    : 'app.textMuted'
                }
              >
                {answered && index === question.pravilen ? (
                  <LuCheck />
                ) : answered && index === chosen ? (
                  <LuX />
                ) : (
                  LETTERS[index]
                )}
              </Flex>
              <Text color="app.text" fontSize="sm">
                {answer}
              </Text>
            </Flex>
          </motion.div>
        ))}
        {/* The shortcuts themselves live in QuestionGeneratorTab. */}
        <Text fontSize="xs" color="app.textFaint" textAlign="right">
          {answered ? 'Enter ali → za naprej' : 'Tipke 1–4 ali A–D za odgovor'}
        </Text>
      </Stack>

      {/* Enter-only: these leave together with the whole question body. */}
      {answered && (
        <motion.div variants={fadeUp} initial="hidden" animate="shown">
          <Box
            bg="app.surfaceSubtle"
            borderWidth="1px"
            borderColor={correct ? 'app.success' : 'app.border'}
            borderRadius="md"
            p="4"
          >
            <Text
              fontSize="sm"
              fontWeight="medium"
              color={correct ? 'app.success' : 'app.danger'}
              mb="1"
            >
              {correct ? 'Pravilno' : 'Napačno'}
            </Text>
            <Text fontSize="sm" color="app.text" lineHeight="1.7">
              {question.razlaga}
            </Text>
          </Box>
        </motion.div>
      )}

      {answered && (
        <motion.div variants={fadeUp} initial="hidden" animate="shown">
          <Flex justify="flex-end">
            <Button
              onClick={onNext}
              bg="app.accent"
              color="app.accentFg"
              _hover={{ bg: 'app.accentHover' }}
              px="5"
            >
              {isLast ? 'Zaključi' : 'Naprej'} <LuArrowRight />
            </Button>
          </Flex>
        </motion.div>
      )}
    </Stack>
  )
}
