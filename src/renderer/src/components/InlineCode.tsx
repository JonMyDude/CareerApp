import { Box } from '@chakra-ui/react'

/**
 * Renders `backtick` spans as inline code. The explanation prompt asks for code,
 * commands and symbols in backticks, so "&str" stays "&str" and reads as code.
 * Only matched pairs count; a stray backtick is left as an ordinary character.
 */
const CODE_SPAN = /`([^`\n]+)`/

export default function InlineCode({ text }: { text: string }): React.JSX.Element {
  // split() with a capture group alternates: text, code, text, code, …
  const parts = text.split(CODE_SPAN)
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <Box
            as="code"
            key={index}
            fontFamily="ui-monospace, 'Cascadia Mono', Consolas, monospace"
            fontSize="0.88em"
            px="1"
            py="0.5"
            borderRadius="sm"
            borderWidth="1px"
            borderColor="app.border"
            bg="app.surfaceHover"
            color="app.text"
            wordBreak="break-word"
            // A span that wraps gets its padding and border on every line.
            css={{ boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }}
          >
            {part}
          </Box>
        ) : (
          part
        )
      )}
    </>
  )
}
