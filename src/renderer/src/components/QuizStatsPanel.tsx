import { useState } from 'react'
import { Box, Button, Flex, Stack, Text } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'motion/react'
import { LuChartColumn, LuChevronDown } from 'react-icons/lu'
import type { QuizStats } from '@shared/types'
import { odgovorov, percent } from '../lib/quizStats'
import { fade } from '../theme/motion'

/**
 * "Statistika" under the quiz setup: accuracy per subject from the answer log,
 * and per subject its classes and weakest topics. Read from disk, no AI.
 */
export default function QuizStatsPanel({ stats }: { stats: QuizStats }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const answered = stats.subjects.reduce((total, subject) => total + subject.answered, 0)
  const correct = stats.subjects.reduce((total, subject) => total + subject.correct, 0)

  return (
    <Box borderTopWidth="1px" borderColor="app.border" pt="4" data-quiz-stats>
      <Button
        variant="plain"
        size="sm"
        px="0"
        gap="2"
        color="app.text"
        _expanded={{ bg: 'transparent' }}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <LuChartColumn />
        Statistika
        <Text as="span" fontWeight="normal" color="app.textFaint">
          · {answered} {odgovorov(answered)} · {percent(correct, answered)} pravilnih
        </Text>
        <Box
          as="span"
          display="flex"
          color="app.textMuted"
          transition="transform 160ms ease"
          transform={open ? 'rotate(180deg)' : undefined}
        >
          <LuChevronDown />
        </Box>
      </Button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="stats"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={fade}
            style={{ overflow: 'hidden' }}
          >
            <Stack gap="0.5" mt="2">
              {stats.subjects.map((subject) => {
                const isOpen = expanded === subject.predmet
                return (
                  <Box key={subject.predmet} data-subject={subject.predmet}>
                    <Flex
                      as="button"
                      w="full"
                      align="center"
                      gap="3"
                      py="1.5"
                      px="2"
                      mx="-2"
                      borderRadius="sm"
                      textAlign="left"
                      cursor="pointer"
                      _hover={{ bg: 'app.surfaceHover' }}
                      aria-expanded={isOpen}
                      onClick={() => setExpanded(isOpen ? null : subject.predmet)}
                    >
                      <Text w="170px" flexShrink="0" truncate fontSize="sm" color="app.text">
                        {subject.predmet}
                      </Text>
                      <Box flex="1" h="6px" borderRadius="full" bg="app.surfaceHover" overflow="hidden">
                        <Box
                          h="full"
                          borderRadius="full"
                          bg="app.success"
                          w={`${(subject.correct / subject.answered) * 100}%`}
                        />
                      </Box>
                      <Text w="110px" flexShrink="0" textAlign="right" fontSize="xs" color="app.textMuted">
                        {subject.correct}/{subject.answered} · {percent(subject.correct, subject.answered)}
                      </Text>
                    </Flex>

                    {isOpen && (
                      <Stack gap="1" pl="2" pb="2" pt="0.5" fontSize="xs" color="app.textMuted" data-subject-details>
                        <Text>
                          Po razredih:{' '}
                          {subject.classes
                            .map((line) => `${line.razred} ${percent(line.correct, line.answered)}`)
                            .join(' · ')}
                        </Text>
                        {subject.weakTopics.length > 0 && (
                          <Text>
                            Najšibkejše teme:{' '}
                            {subject.weakTopics
                              .map((topic) => `${topic.tema} (${topic.correct}/${topic.answered})`)
                              .join(', ')}
                          </Text>
                        )}
                        {subject.mistakes > 0 && <Text>Odprte napake: {subject.mistakes}</Text>}
                      </Stack>
                    )}
                  </Box>
                )
              })}
            </Stack>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  )
}
