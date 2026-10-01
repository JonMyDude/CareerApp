import { Capacitor } from '@capacitor/core'
import { androidApi } from './androidApi'
import { webApi } from './webApi'

/**
 * Puts `window.api` in place before any store uses it (imported first in
 * main.tsx). The desktop's preload has already set it; otherwise this is
 * either the Android app or a browser.
 */
if (!('api' in window)) {
  Object.assign(window, { api: Capacitor.isNativePlatform() ? androidApi : webApi })
}
