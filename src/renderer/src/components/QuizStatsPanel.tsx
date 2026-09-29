import { useState } from 'react'
import { Box, chakra, Flex, Stack, Text } from '@chakra-ui/react'
import type { QuizStats } from '@shared/types'
import { odgovorov, percent } from '../lib/quizStats'
import { card, kicker } from '../theme/styles'

/**
 * "Statistika" beside the quiz setup: accuracy per subject from the answer log.
 * Click a subject for its classes and weakest topics. Read from disk, no AI.
 */
export default function QuizStatsPanel({ stats }: { stats: QuizStats }): React.JSX.Element {
  const [expanded, setExpanded] = useState<string | null>(null)
  const answered = stats.subjects.reduce((total, subject) => total + subject.answered, 0)
  const correct = stats.subjects.reduce((total, subject) => total + subject.correct, 0)

  return (
    <Box {...card} p="5" data-quiz-stats>
      <Text {...kicker} mb="1.5">
        Statistika
      </Text>
      <Text fontSize="13px" color="app.textMuted" mb="3.5">
        {answered} {odgovorov(answered)} · {percent(correct, answered)} pravilnih
      </Text>

      <Stack gap="1">
        {stats.subjects.map((subject) => {
          const isOpen = expanded === subject.predmet
          return (
            <Box key={subject.predmet} data-subject={subject.predmet}>
              <chakra.button
                type="button"
                display="block"
                // Bleeds into the card's padding, so the hover tint has room around the text.
                w="calc(100% + 16px)"
                px="2"
                mx="-2"
                py="1.5"
                borderRadius="8px"
                textAlign="left"
                fontSize="12px"
                cursor="pointer"
                _hover={{ bg: 'app.surfaceHover' }}
                aria-expanded={isOpen}
                onClick={() => setExpanded(isOpen ? null : subject.predmet)}
              >
                <Flex justify="space-between" gap="2" mb="1">
                  <Text truncate color="app.text">
                    {subject.predmet}
                  </Text>
                  <Text flexShrink="0" color="app.textFaint" fontVariantNumeric="tabular-nums">
                    {subject.correct}/{subject.answered} · {percent(subject.correct, subject.answered)}
                  </Text>
                </Flex>
                <Box h="5px" borderRadius="full" bg="app.border" overflow="hidden">
                  <Box
                    h="full"
                    borderRadius="full"
                    bg="app.success"
                    w={`${(subject.correct / subject.answered) * 100}%`}
                  />
                </Box>
              </chakra.button>

              {isOpen && (
                <Stack gap="1" pb="2" pt="1" fontSize="12px" lineHeight="1.5" color="app.textMuted" data-subject-details>
                  <Text>
                    Po razredih:{' '}
                    {subject.classes.map((line) => `${line.razred} ${percent(line.correct, line.answered)}`).join(' · ')}
                  </Text>
                  {subject.weakTopics.length > 0 && (
                    <Text>
                      Najšibkejše teme:{' '}
                      {subject.weakTopics.map((topic) => `${topic.tema} (${topic.correct}/${topic.answered})`).join(', ')}
                    </Text>
                  )}
                  {subject.mistakes > 0 && <Text>Odprte napake: {subject.mistakes}</Text>}
                </Stack>
              )}
            </Box>
          )
        })}
      </Stack>
    </Box>
  )
}
