import type { CapacitorConfig } from '@capacitor/cli'

/**
 * The Android app: the same web build (dist-web/) in a native shell. It calls
 * the cloud by full address with the Access service token, like the desktop —
 * see src/renderer/src/androidApi.ts.
 */
const config: CapacitorConfig = {
  appId: 'com.jon.careerapp',
  appName: 'Career App',
  webDir: 'dist-web',
  plugins: {
    // fetch goes through Android's own HTTP stack: no CORS, and the Access
    // headers reach Cloudflare exactly as the desktop sends them.
    CapacitorHttp: { enabled: true }
  }
}

export default config
