import { Box, Flex, IconButton, Text } from '@chakra-ui/react'
import { LuX } from 'react-icons/lu'

interface Props {
  message: string
  onDismiss?: () => void
}

export default function ErrorBanner({ message, onDismiss }: Props): React.JSX.Element {
  return (
    <Flex
      role="alert"
      align="center"
      justify="space-between"
      gap="3"
      bg="app.dangerSubtle"
      borderWidth="1px"
      borderColor="app.danger"
      borderRadius="md"
      px="4"
      py="3"
    >
      <Box>
        <Text fontSize="sm" color="app.danger" fontWeight="medium">
          {message}
        </Text>
      </Box>
      {onDismiss && (
        <IconButton
          aria-label="Dismiss"
          size="xs"
          variant="ghost"
          color="app.danger"
          _hover={{ bg: 'app.surfaceHover' }}
          onClick={onDismiss}
        >
          <LuX />
        </IconButton>
      )}
    </Flex>
  )
}
