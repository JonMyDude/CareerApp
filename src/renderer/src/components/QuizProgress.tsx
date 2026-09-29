import { Box, Grid } from '@chakra-ui/react'

interface Props {
  /** Per question: undefined until answered, then whether it was right. */
  results: (boolean | undefined)[]
  /** Index of the question on screen. */
  current: number
}

/**
 * One segment per question: green or red once answered, accent for the one on
 * screen. It changes the moment an answer is given rather than on "Naprej", so
 * the click itself has visible feedback.
 */
export default function QuizProgress({ results, current }: Props): React.JSX.Element {
  const answered = results.filter((result) => result !== undefined).length
  return (
    <Grid
      templateColumns={`repeat(${results.length}, minmax(0, 1fr))`}
      gap="1"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={results.length}
      aria-valuenow={answered}
      aria-label={`Napredek: ${answered} od ${results.length}`}
    >
      {results.map((result, index) => (
        <Box
          key={index}
          h="6px"
          borderRadius="full"
          transition="background-color 200ms ease"
          bg={
            result === true
              ? 'app.success'
              : result === false
                ? 'app.danger'
                : index === current
                  ? 'app.accent'
                  : 'app.border'
          }
        />
      ))}
    </Grid>
  )
}
