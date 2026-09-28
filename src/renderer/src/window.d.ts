import type { AppApi } from '../../preload'

/** The bridge the preload script installs. This is all the renderer can reach. */
declare global {
  interface Window {
    api: AppApi
  }
}

export {}
