// Lets `node --test` run the app's own TypeScript: maps the `@shared/*` alias
// and the extensionless relative imports the bundlers resolve, to .ts files.
import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = pathToFileURL(`${process.cwd()}/`)

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@shared/')) {
      return next(new URL(`src/shared/${specifier.slice('@shared/'.length)}.ts`, root).href, context)
    }
    if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      const url = new URL(`${specifier}.ts`, context.parentURL)
      if (existsSync(fileURLToPath(url))) return next(url.href, context)
    }
    return next(specifier, context)
  }
})
