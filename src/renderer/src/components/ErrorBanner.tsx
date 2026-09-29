import { Flex, IconButton, Text } from '@chakra-ui/react'
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
      borderRadius="12px"
      px="4"
      py="3"
    >
      <Text fontSize="14px" color="app.danger" fontWeight="600">
        {message}
      </Text>
      {onDismiss && (
        <IconButton
          aria-label="Dismiss"
          size="xs"
          variant="ghost"
          color="app.danger"
          borderRadius="8px"
          _hover={{ bg: 'app.surfaceHover' }}
          onClick={onDismiss}
        >
          <LuX />
        </IconButton>
      )}
    </Flex>
  )
}
