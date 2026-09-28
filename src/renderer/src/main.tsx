import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ChakraProvider } from '@chakra-ui/react'
import { MotionConfig } from 'motion/react'
import App from './App'
import { system } from './theme/system'
import './theme/theme.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root element missing from index.html')

createRoot(container).render(
  <StrictMode>
    <ChakraProvider value={system}>
      {/* One switch for the whole app: with reduced motion on, Motion skips
          transform and layout animation and keeps the opacity fades. */}
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </ChakraProvider>
  </StrictMode>
)
