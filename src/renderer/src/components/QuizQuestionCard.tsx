import { Box, Button, Flex, Heading, Stack, Text } from '@chakra-ui/react'
import { motion, type TargetAndTransition } from 'motion/react'
import { LuArrowRight, LuCheck, LuX } from 'react-icons/lu'
import type { QuizQuestion } from '@shared/types'
import { fadeUp, pop, rest, shake } from '../theme/motion'
import { primaryButton } from '../theme/styles'

interface Props {
  question: QuizQuestion
  /** Undefined until the user picks. */
  chosen: number | undefined
  onChoose: (index: number) => void
  onNext: () => void
  isLast: boolean
}

const LETTERS = ['A', 'B', 'C', 'D']

/**
 * One question: its topic, the text, the four answers, and — once answered —
 * the explanation and the Naprej button. The counter and progress live in the
 * tab, so they hold still while each question slides across.
 */
export default function QuizQuestionCard({ question, chosen, onChoose, onNext, isLast }: Props): React.JSX.Element {
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
      return { bg: 'app.surface', borderColor: 'app.border', _hover: { borderColor: 'app.accent' } }
    }
    if (index === question.pravilen) return { bg: 'app.successSubtle', borderColor: 'app.success', _hover: {} }
    if (index === chosen) return { bg: 'app.dangerSubtle', borderColor: 'app.danger', _hover: {} }
    return { bg: 'app.surface', borderColor: 'app.border', opacity: 0.5, _hover: {} }
  }

  return (
    <Box>
      <Box
        as="span"
        display="inline-flex"
        alignItems="center"
        h="24px"
        px="2.5"
        mt="7"
        borderRadius="full"
        bg="app.accentSubtle"
        color="app.accent"
        fontSize="12px"
        fontWeight="600"
      >
        {question.tema}
      </Box>

      <Heading
        as="h2"
        mt="3"
        mb="5"
        fontSize="22px"
        fontWeight="600"
        lineHeight="1.35"
        letterSpacing="-0.005em"
        color="app.text"
        textWrap="pretty"
      >
        {question.vprasanje}
      </Heading>

      <Stack gap="2">
        {question.odgovori.map((answer, index) => {
          const marked = answered && (index === question.pravilen || index === chosen)
          return (
            // Motion sits on a wrapper rather than the Chakra element: both want a
            // `transition` prop, and the button keeps its CSS border transition.
            <motion.div key={index} initial={false} animate={feedbackFor(index)}>
              <Flex
                as="button"
                data-answer={index}
                // @ts-expect-error Chakra passes unknown props through to the element.
                disabled={answered}
                onClick={() => !answered && onChoose(index)}
                // A <button> shrinks to its text unless told otherwise.
                w="full"
                minH="54px"
                align="center"
                gap="3.5"
                py="2"
                pl="3"
                pr="4"
                textAlign="left"
                color="app.text"
                borderWidth="1.5px"
                borderRadius="12px"
                cursor={answered ? 'default' : 'pointer'}
                transition="border-color 120ms ease"
                {...styleFor(index)}
              >
                <Flex
                  align="center"
                  justify="center"
                  flexShrink="0"
                  w="30px"
                  h="30px"
                  borderRadius="8px"
                  fontSize="13px"
                  fontWeight="800"
                  bg={
                    answered && index === question.pravilen
                      ? 'app.success'
                      : answered && index === chosen
                        ? 'app.danger'
                        : 'app.surfaceHover'
                  }
                  color={marked ? 'app.accentFg' : 'app.textMuted'}
                >
                  {answered && index === question.pravilen ? <LuCheck /> : answered && index === chosen ? <LuX /> : LETTERS[index]}
                </Flex>
                <Text fontSize="15px" fontWeight="600">
                  {answer}
                </Text>
              </Flex>
            </motion.div>
          )
        })}
      </Stack>

      {/* The shortcuts themselves live in QuestionGeneratorTab. */}
      {!answered && (
        <Text mt="3" fontSize="12px" color="app.textFaint">
          Tipke 1–4 ali A–D za odgovor
        </Text>
      )}

      {/* Enter-only: these leave together with the whole question body. */}
      {answered && (
        <motion.div variants={fadeUp} initial="hidden" animate="shown">
          <Box mt="4" px="5" py="4.5" borderRadius="12px" bg={correct ? 'app.successSubtle' : 'app.dangerSubtle'}>
            <Text fontSize="14px" fontWeight="600" color={correct ? 'app.success' : 'app.danger'} mb="1.5">
              {correct ? 'Pravilno' : 'Napačno'}
            </Text>
            <Text fontSize="14.5px" lineHeight="1.65" color="app.text">
              {question.razlaga}
            </Text>
          </Box>
          <Flex align="center" justify="space-between" gap="3" mt="5">
            <Text fontSize="12px" color="app.textFaint">
              Enter ali → za naprej
            </Text>
            <Button
              onClick={onNext}
              h="44px"
              minW="160px"
              px="4"
              justifyContent="space-between"
              fontSize="15px"
              {...primaryButton}
              borderRadius="10px"
            >
              {isLast ? 'Zaključi' : 'Naprej'} <LuArrowRight />
            </Button>
          </Flex>
        </motion.div>
      )}
    </Box>
  )
}
