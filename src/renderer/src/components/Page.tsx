import { Box, Flex, Heading, Text } from '@chakra-ui/react'

interface Props {
  /** The line above the title: a date, a count, the quiz subject. */
  eyebrow?: React.ReactNode
  title: React.ReactNode
  /** The right-hand end of the header row. */
  actions?: React.ReactNode
  /** Above everything else in the header: the Explanation tab's way back. */
  back?: React.ReactNode
  /** The side column. It drops under the main one when the window is narrow. */
  aside?: React.ReactNode
  children: React.ReactNode
}

/**
 * The frame every tab shares: a header, then the main content with the extra
 * information in a side column next to it.
 */
export default function Page({ eyebrow, title, actions, back, aside, children }: Props): React.JSX.Element {
  return (
    <Flex direction="column" gap="6">
      <Flex as="header" align="flex-end" justify="space-between" gap="4" wrap="wrap">
        <Box minW="0">
          {back}
          {eyebrow && (
            // Slovenian dates come out lowercase ("ponedeljek, 28. september").
            <Text fontSize="13px" color="app.textMuted" mb="1" _firstLetter={{ textTransform: 'uppercase' }}>
              {eyebrow}
            </Text>
          )}
          <Heading
            as="h1"
            fontSize="28px"
            fontWeight="600"
            lineHeight="1.2"
            letterSpacing="-0.01em"
            color="app.text"
            textWrap="pretty"
          >
            {title}
          </Heading>
        </Box>
        {actions}
      </Flex>

      <Flex wrap="wrap" gap="6" align="flex-start">
        <Box flex="1 1 440px" minW="0">
          {children}
        </Box>
        {aside && (
          <Flex
            as="aside"
            direction="column"
            gap="4"
            flex="1 1 250px"
            // Long truncated titles inside must not widen it.
            minW="0"
            maxW="300px"
            // Only where it fits: a side column taller than the window would
            // pin its own bottom out of reach until the end of the page.
            css={{ '@media (min-height: 700px)': { position: 'sticky', top: 0 } }}
          >
            {aside}
          </Flex>
        )}
      </Flex>
    </Flex>
  )
}

/** A heading inside the main column, with a count or a note at the other end. */
export function SectionTitle({ title, meta }: { title: string; meta?: React.ReactNode }): React.JSX.Element {
  return (
    <Flex align="baseline" justify="space-between" gap="3">
      <Heading as="h2" fontSize="17px" fontWeight="600" color="app.text" whiteSpace="nowrap">
        {title}
      </Heading>
      {meta !== undefined && (
        <Text fontSize="13px" color="app.textFaint" truncate>
          {meta}
        </Text>
      )}
    </Flex>
  )
}
