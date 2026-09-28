import { Box, Heading, Text, VStack } from '@chakra-ui/react'

interface Props {
  step: string
  title: string
  description: string
  icon: React.ReactNode
}

/**
 * Placeholder for the tabs that are deliberately not built yet — the build
 * order in CLAUDE.md says finish one tab end to end before starting the next.
 */
export default function ComingSoon({ step, title, description, icon }: Props): React.JSX.Element {
  return (
    <VStack
      gap="3"
      textAlign="center"
      maxW="480px"
      mx="auto"
      py="16"
      color="app.textMuted"
    >
      <Box fontSize="3xl" color="app.textFaint">
        {icon}
      </Box>
      <Heading size="md" color="app.text">
        {title}
      </Heading>
      <Text fontSize="sm">{description}</Text>
      <Box
        fontSize="xs"
        color="app.textFaint"
        borderWidth="1px"
        borderColor="app.border"
        borderRadius="full"
        px="3"
        py="1"
      >
        {step}
      </Box>
    </VStack>
  )
}
