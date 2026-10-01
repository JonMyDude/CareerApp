import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// First: in the browser or on Android this installs window.api before any store uses it.
import './installApi'
import { ChakraProvider } from '@chakra-ui/react'
import { MotionConfig } from 'motion/react'
import App from './App'
import { system } from './theme/system'
// Bundled into the app: the CSP allows no remote fonts, and the page fetches
// nothing but its own cloud API.
import '@fontsource-variable/archivo'
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
