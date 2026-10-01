# Career App — Project Brief

Read this before writing any code. It's the current, agreed scope, drop it in the
project root as `CLAUDE.md` so it's loaded automatically.

## What this is

A Windows desktop app, the same app on the web, and an Android app
(Capacitor, `android/`), built in React, for
tracking learning interests and generating daily prompts to explore them. Both
read and write one copy of the data in the user's own Cloudflare account. Four tabs plus a Settings page
(the gear at the bottom of the rail).

## The tabs

1. **Interests** — flat list. Add, edit, delete an interest, and rate its
   importance (Low / Medium / High, filterable). Importance also weights the
   Daily picks. That's it. No click-to-expand, no generated roadmap, no AI call
   on this tab. Its only job is to hold data the Daily tab reads from.

2. **Daily Suggestion** — on launch, picks one interest for the day (non-repeating
   random selection, "shuffle bag" style so nothing repeats until the full list
   has cycled) and calls the AI API to generate one small thing to read, watch,
   or try today about that interest. Result is cached per day so reopening the
   app doesn't re-roll it. Also: reroll, tick off (with an optional one-line
   reflection note the model sees next time), delete, progress & streaks,
   filter & search, export to Markdown, and an optional daily reminder.

3. **Explanation** — a step-by-step walkthrough plus key concepts for one daily
   suggestion, generated only when the user presses Explain on it, and cached.

4. **Question Generator** — an AI-generated Slovenian-curriculum quiz, per
   GEMINI_PROMPT_SPEC.md (see the build order note below). Also: review past
   mistakes (no AI call) and accuracy stats per subject.

## Explicitly out of scope (don't build this)

We scrapped the original idea of clicking an interest to auto-generate a
breakdown/subtree of steps to complete it. The Interests tab is dumb storage,
nothing more. If you find yourself building a tree UI or a "generate subtasks"
prompt for the Interests tab, stop, that's not part of this app anymore.

## Hard constraints

- Network calls go to two places only: the app's own cloud (the Cloudflare
  Worker in `src/worker`, decided 2026-09-29 so desktop and web stay in sync)
  and, from the cloud, the AI API. Nothing else: no update checks, analytics or
  third-party fetching.
- The AI API key must never reach a client — not the renderer, not the desktop.
  All AI calls happen in the cloud (`src/core/ai.ts`) and are exposed as named
  operations (`src/core/ops.ts`), e.g. `daily:generate`.
- The cloud is behind Cloudflare Access, and the Worker verifies the Access
  token itself (`src/worker/access.ts`). Never add an API route that skips it.
- The provider has since been decided — see "AI provider — decided" below.

## Stack — decided, don't re-open

Picked 2026-09-02. These are settled, build against them. README.md has the
file-by-file layout.

- **Desktop shell**: Electron, with electron-vite for the build and
  electron-builder for packaging.
- **UI**: React + TypeScript. Chakra UI v3 for components.
- **State manager**: Zustand, one small store per feature in
  `src/renderer/src/store/`. `useInterestsStore.ts` is still the only caller of
  `window.api.interests`.
- **Storage**: one JSON document per former file (interests, daily, questions,
  quiz-history, usage, settings) in a single Cloudflare Durable Object, owned
  by `src/core` through the `Docs` seam in `core/docs.ts`. Deliberately not a
  relational schema — they're flat lists, don't over-engineer it. The desktop
  keeps only its own `config.json` and `window-theme.json` in
  `%APPDATA%/career-app/`.
- **Cloud**: Cloudflare Workers free plan — Worker + Durable Object + Access.
  README.md → Web version has the setup.
- **Styling**: every colour is a CSS variable in
  `src/renderer/src/theme/theme.css`, in two blocks — `:root` for light and
  `:root[data-theme='dark']` for dark. Chakra's tokens in `theme/system.ts` are
  thin wrappers over those variables, so `app.surface` *is* `var(--app-surface)`.
  To restyle, edit theme.css; don't hardcode colours in components. The window's
  caption buttons read their colours from these variables too. Watch for Chakra
  styles that use its own palette (e.g. a Button's `_expanded`, the stock
  Switch): they ignore `data-theme` and stay light in dark mode. The look is
  Claude Design's "Career App – Modernist v2" (Archivo, bundled locally): every
  tab renders inside `components/Page.tsx`, and the card and button presets are
  in `theme/styles.ts`.

## AI provider — decided

Google Gemini, picked 2026-09-02.

- Endpoint: `generativelanguage.googleapis.com/v1beta`, `generateContent`.
- Model: `gemini-3.5-flash-lite` (~1s, no thinking overhead). Override it by
  setting the model in Settings. Note `gemini-2.5-flash` is closed to new keys.
- The key lives in the cloud's `settings` document (or a `GEMINI_API_KEY` Worker
  secret) — outside the repo and every bundle. Never hardcode it in source.
- The key is read by `src/core/settings.ts` and used only in `src/core/ai.ts`.
  It must never leave the cloud: `settings:get` returns
  `hasApiKey: boolean`, never the key itself. It can be set from the Settings
  page, which is write-only.

## Suggested build order

Don't build all three tabs in parallel. Get one fully working end to end before
starting the next:

1. Desktop shell + IPC bridge + storage layer (CRUD on interests) + the
   Interests tab UI. Ship this as a working .exe to yourself first.
2. Daily Suggestion tab: shuffle-bag picker + the one AI call + caching
   today's pick + error/offline state.
3. Question Generator tab: BUILT, but not as originally sketched. It is an
   AI-generated Slovenian-curriculum quiz per GEMINI_PROMPT_SPEC.md, not a
   static JSON bank, and it is standalone — it shares nothing with the other
   tabs, so it does not use the shuffle bag. See README.md.
4. Since then, all BUILT: the Explanation tab; a themed title bar; the Settings
   page; keyboard shortcuts; reflection notes, progress & streaks, history
   filter/search and Markdown export on Daily; quiz mistake review and stats;
   the daily reminder with tray and Start with Windows; the web version with
   cloud sync. README.md has a section for each.

## Full learning roadmap

The detailed technology-by-technology roadmap (packaging, IPC, data modeling,
prompt design, styling, secrets handling, etc.) lives in TickTick under
**📈 Career App**, organized as parent tasks per category with the specifics
as subtasks. Check there for the "why" behind each tech choice above.
