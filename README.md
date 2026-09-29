# Career App

Local Windows desktop app for tracking learning interests and generating daily
prompts to explore them. Scope and rules live in [CLAUDE.md](./CLAUDE.md) — read
that first.

## Stack

| Concern       | Choice                        | Why |
|---------------|-------------------------------|-----|
| Shell         | Electron 44                   | Chosen for step 1 |
| Build         | electron-vite + Vite 7        | One config for main / preload / renderer, HMR in dev |
| UI            | React 19 + TypeScript         | |
| Components    | Chakra UI v3                  | |
| Colours       | CSS variables                 | Light/dark is a pure CSS swap — see below |
| State         | Zustand                       | One small store per feature |
| Storage       | JSON files in `userData`      | Flat lists, no database needed |
| Animation     | Motion for React              | See the Animations section |

## Running it

```bash
npm run dev
```

Other scripts:

- `npm run build` — bundle main, preload and renderer into `out/`
- `npm start` — run the built bundle without packaging
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — the checks in `src/**/*.test.ts`, on Node's built-in test runner
- `npm run build:win` — produce the NSIS installer and a portable `.exe` in `dist/`

## How the pieces fit

```
src/
  shared/            imported by BOTH processes
    types.ts, ipc.ts   types and IPC channel names
    progress.ts        streaks and done rates (pure)
    reminder.ts        when the daily reminder fires (pure)
  main/              Node side. Owns the filesystem and the AI API key.
    index.ts         window creation, security flags, single-instance lock
    store.ts         interests.json: read, validate, atomic write
    daily.ts         daily.json: suggestions, done flags, notes, explanations
    questions.ts     questions.json + quiz batches: seen topics, validation
    quizHistory.ts   quiz-history.json: every answer, and mistakes to review
    usage.ts         usage.json: tokens per day and feature
    config.ts        config.json: key, model, budget, reminder, tray
    ai.ts            every Gemini call — the only file that sends the key
    exportHistory.ts the history as a Markdown file
    windowTheme.ts   caption-button colours, cached in window-theme.json
    background.ts    tray, hide-on-close, Start with Windows
    reminder.ts      the daily notification
    jsonFile.ts      atomic write + queue, for the newer files
    ipc.ts           one named handler per operation
  preload/           contextBridge. The only surface the UI can reach.
  renderer/src/      React. Has no filesystem or network access at all.
    theme/           theme.css (all colours), system.ts (Chakra -> CSS vars),
                     styles.ts (card and button presets), motion.ts
    store/           Zustand stores, the only callers of window.api
    components/      the Page frame, cards, rail, meter, forms
    lib/             hotkeys, history filter, quiz stats helpers
    tabs/            one file per tab, listed once in tabs/config.tsx
```

### The security boundary

`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. The renderer
gets exactly the functions listed in `src/preload/index.ts` and nothing else — no
`require`, no `ipcRenderer`, no arbitrary channel. The API key is loaded by
`src/main/config.ts`, used only by `src/main/ai.ts`, and never crosses the
bridge; only the generated text does.

Main → renderer messages go the same way: the preload subscribes to two fixed
event channels (`on.dailyChanged`, `on.navigate`) and never hands the raw IPC
event over. The exposed `window.api` object is frozen, so page code can't swap
a function out either.

Anything the renderer sends is validated in main before it touches disk or the
OS: model names (they go into the request URL), budgets, reminder times,
window colours, quiz answers.

### Dropdowns

There are no native `<select>`s: their open list is a Windows-drawn popup that
CSS barely reaches (square, system-blue highlight). `components/Dropdown.tsx`
wraps Chakra's Select instead — same keyboard use, drawn in app tokens. Every
part sets its own colours, since Chakra's recipe ones ignore `data-theme`, and a
real `''` option (e.g. "All interests") travels under a sentinel key, because
the select reads `''` as nothing picked.

### Colours and dark mode

Every colour is a CSS variable in `src/renderer/src/theme/theme.css`, in two
blocks: `:root` (light) and `:root[data-theme='dark']`. Chakra's tokens in
`system.ts` are thin wrappers — `app.surface` is literally `var(--app-surface)` —
so components say `bg="app.surface"` and the value is resolved by CSS.

To restyle the app, edit `theme.css` only. To add a colour, add the variable to
both blocks and register it once in `system.ts`.

`useColorMode` (a small zustand store in `theme/useColorMode.ts`, changed from
Settings) resolves the `system` preference to a concrete value and stamps
`data-theme` on `<html>`, so the stylesheet only ever needs those two blocks. The
choice persists in `localStorage`.

**Chakra's own palette ignores `data-theme`.** Built-in styles that pull from
Chakra's colour palette rather than our tokens — a ghost Button's `_expanded`
state, the stock `Switch` — stay light in dark mode. So the collapsible toggles
are plain `chakra.button`s, the switches are the token-only `ToggleSwitch` /
`SwitchTrack`, and every Chakra focus ring reads `gray.focusRing`, which
`system.ts` points at `--app-accent`. Set colours from `app.*` tokens wherever
Chakra would otherwise choose.

### The look

The design is "Career App – Modernist v2" from Claude Design: Archivo, a
labelled rail, no header bar, and every tab as a page with its main content
first and the extra information in a side column (`components/Page.tsx`). In a
narrow window the side column drops under the main one, and below 1024px the
rail folds to its icons.

- **Archivo is bundled** through `@fontsource-variable/archivo`, imported in
  `main.tsx`. The CSP allows no remote fonts, and the app makes no network calls
  but Gemini's.
- `theme/styles.ts` holds the recurring pieces as style-prop objects — `card`,
  `kicker`, the four button looks and `field` — spread onto Chakra elements.
  They only name `app.*` tokens, so colour still lives in `theme.css` alone.
- The design is dark-only; light mode applies the same layout to the light
  palette. The streak's flame has its own warm `--app-streak`, so it reads as
  fire next to the blue accent.

### Data

Everything lives in `%APPDATA%/career-app/`, written atomically (temp file +
rename) and serialised through a queue so two fast edits can't lose one:

| File | Holds |
|---|---|
| `interests.json` | the interests list, each with an importance (1 Low, 2 Medium, 3 High; missing = Medium) |
| `daily.json` | every suggestion, with done, note and explanation |
| `questions.json` | quiz topics and question hashes already shown |
| `quiz-history.json` | every quiz answer, and the mistakes to review |
| `usage.json` | Gemini tokens per day and feature |
| `config.json` | API key, model, budget, reminder, tray — hand-editable |
| `window-theme.json` | the last caption-button colours |

A corrupt `interests.json` is renamed to `.corrupt-<timestamp>` rather than
deleted, and the app starts clean. Each file carries a `version` so a shape
change can migrate instead of guessing.

## Build order status

1. **Done** — shell, IPC bridge, storage, Interests tab (add / edit / delete).
2. **Done** — Daily Suggestion. Shuffle-bag picker, one Gemini call from the main
   process, cached per calendar day, plus no-key / no-interests / error states.
3. **Done** — Question Generator. Slovenian-curriculum quiz built to
   GEMINI_PROMPT_SPEC.md. Standalone: it shares nothing with the other two tabs
   beyond the API key, so it does not use the shuffle bag.
4. **Done** — Explanation tab. A step-by-step walkthrough of any daily
   suggestion, generated only when you press Explain on it.
5. **Done** — themed title bar, Settings page, keyboard shortcuts.
6. **Done** — Daily: reflection notes, progress & streaks, filter & search,
   export to Markdown.
7. **Done** — Quiz: review mistakes and per-subject stats.
8. **Done** — daily reminder, tray, Start with Windows.
9. **Done** — importance meter and filter on Interests, weighting the Daily picks;
   automatic retry of Gemini 5xx errors.
10. **Done** — the Modernist v2 restyle (see [The look](#the-look)): Interests
    grouped by importance with the shuffle-bag cycle beside them, a streak card,
    tickable explanation steps, a segmented quiz progress bar.

## Daily Suggestion, how it works

`src/main/daily.ts` keeps two things in `%APPDATA%/career-app/daily.json`:

- `bag` — which interests have been drawn in the current cycle
- `entries` — every day's pick and suggestion, newest first, kept forever

The UI reads this as a feed: today's suggestion sits in a card at the top, and
every earlier one is a row in the "Earlier suggestions" list beneath it, its text
clamped to two lines until clicked. Progress, the streak, the reminder switch and
the export sit in the side column. While today is generating, the spinner
occupies only the top slot — the history below stays on screen.

The Interests tab groups interests by importance and shows, beside them, how far
the current cycle has got ("6 of 11 picks"). `DailyView.drawn` carries the bag's
ids for that; `cycleProgress()` in `shuffleBag.ts` counts them, with
`shuffleBag.test.ts` checking it against `drawFromBag`. Each row's "Last picked
26. sep. · 3 of 5 done" comes from the history the Daily tab already holds.

### File format v1 -> v6

v1 stored a single `today` object. v2 stored an `entries` array, one row per
date. v3 added `id` and `createdAt` per entry so a date can hold several. v4
added `done`. v5 added `explanation` (null until you press Explain). v6 added
`note` and `doneAt`; entries ticked before v6 get `doneAt` from the day they were
generated, the best guess there is.

`read()` normalises whatever it finds and the next write persists the current
version, so no past suggestion is lost. Legacy entries get a **derived** id (`legacy-<date>-<generatedAt>`)
rather than a random one — normalise() runs on every read, and a fresh uuid each
time would give the same entry a different identity on every call.

The pick is persisted *before* the AI call. That way a failed or offline call is
retried against the same topic tomorrow-proof, instead of burning a draw and
silently re-rolling the day. Once generated, the suggestion is cached for the
rest of the calendar day, so reopening the app never re-rolls it.

`src/shared/shuffleBag.ts` is the picker: pure, injectable `random`, prunes ids
for deleted interests, and never hands out the same item twice in a row while
anything else is left.

### Importance weights the picks

Each interest has an importance, set with the 3-bar meter on the Interests tab:
Low, Medium (the default) or High. It is also the interest's weight in the bag,
so per cycle a Low interest comes up once, Medium twice and High three times.
With everything at Medium the spread is the same as an unweighted bag.

Draws are like pulling tokens from a real bag. An interest owed three draws is
three times as likely to come out next, so a High one's turns spread through the
cycle instead of bunching at the end. The bag file format is unchanged: `drawn`
already listed ids in order, and the weight is just how many times an id may
appear before the cycle refills.

Checked with a seeded random over 10 cycles: exactly 3/2/1 per cycle, one of each
per cycle with no weights, deleted ids pruned.

### When Gemini fails

`callGemini` in `src/main/ai.ts` (shared by daily, explain and quiz) retries HTTP
500/502/503/504 twice, after 1 s and then 3 s. Those are nearly always "model
overloaded" and clear within seconds. It does not retry a bad key (400/403), a
missing model (404), the rate limit (429), being offline, or the 45 s timeout,
because those would fail the same way again.

If it still fails, the banner shows the status and Google's own words, e.g.
"(503: The model is overloaded. Please try again later)". Try again and Open
Settings sit directly under it; at the bottom of a long feed they went unseen.
Re-entering the API key only ever "fixed" a 5xx because saving a key retries today.

### Reroll

The shuffle icon on today's card draws a different interest and generates an
additional suggestion. The one you skipped is **kept** — it drops into the feed
below rather than being overwritten, so a day can hold several entries. The
previous pick stays marked as drawn in the bag, so rerolling moves forward
through the cycle instead of re-offering what you just skipped.

Because a date no longer identifies an entry, each one carries its own `id` and
a `createdAt` that drives the newest-first ordering. Entries from today show a
time instead of a date so they can be told apart.

If a reroll's API call fails it leaves a null entry; the feed keeps featuring
the last entry that actually has a suggestion, and the next reroll clears the
dead one out.

### Ticking suggestions off, and deleting them

Today's card has **Mark as done** and every history row a checkbox, both
persisted as `done` on the entry. History rows also get a delete button (with an
inline confirm); today's has the reroll instead, since rerolling is the way to
replace it.

`done` is the point of the whole feature: it is what tells the model which
suggestions you actually followed through on.

### Writes during an AI call

`daily.ts` never holds a read-modify-write open across a Gemini call, because a
call takes seconds and you can tick or delete cards meanwhile. Every AI-backed
operation (`generateDaily`, `rerollDaily`, `explainEntry`) is split into
*read → AI call → `mutate()`*. `mutate` is a write queue: it re-reads the file,
finds the entry by id and applies only its own change. Before this, saving the
AI result wrote back a stale copy of the file, which silently undid a tick made
while a reroll was generating. If the entry was deleted in the meantime, the
result is thrown away.

### One generation at a time

`generateDaily()` shares a call that is already in flight. The daily reminder can
fire while the Daily tab is loading; without this both would draw the same pick,
both would call the model, and the second answer would overwrite the first.
Checked with the real `daily.ts` and a counting fake `fetch`: two concurrent
calls, one model call.

### Why the model gets a history

`generateDailySuggestion(topic, prior)` is stateless: the API has no memory
between calls. Given only a topic it returns near-identical answers day after
day ("open pgAdmin and create a table", three days running), and every reroll
would be a reworded duplicate.

So `daily.ts` passes the last 5 suggestions **for that same interest**, each
tagged with its `done` flag, split into two labelled lists:

- **COMPLETED** — build on these and go a step further
- **NOT done** — try a different angle, these evidently didn't land

A reflection note goes in under its item, in either list, as `Their note: "…"`,
followed by "Take the user's notes into account." With no notes the prompt is
byte-for-byte what it was before.

Cost is negligible: a few hundred tokens on a once-a-day call, plus 20–80 for
any notes.

### Reflection notes

Ticking a suggestion off opens a one-line field under it: "How did it go?".
Enter saves, Esc or Skip closes. Skipping writes nothing. A saved note shows
under the suggestion after a NOTE label. The pencil (top right of today's card,
and among each history row's actions) adds or edits one, since a note on a
skipped suggestion ("too hard") is just as useful to the model. Unticking keeps
the note.

Main collapses whitespace and caps notes at 280 characters
(`MAX_REFLECTION_LENGTH`) — they go into the prompt. The editor sits outside the
card's faded "done" layer, so it doesn't look disabled right when it asks for
input.

### Progress & streaks

A Progress card in the Daily side column: "12/20 done", the share finished, the
best streak, and a square per day for the last 30 days (brighter the more was
finished, today ringed). **By interest** opens per-interest bars and the
most-skipped interest; whether it's open is remembered.

Under it, the streak card: a flame that burns once today counts, glows dimmer
while the streak still needs today, and is out with no streak.

`src/shared/progress.ts` computes it from the entries already on screen — no IPC,
no tokens. Two choices:

- **Streaks count days something was ticked off (`doneAt`),** not the days
  suggestions were made: finishing Tuesday's suggestion on Wednesday is
  Wednesday's work. The streak stays alive through today if yesterday counted.
- **Interests are grouped by id**, so renaming one doesn't split its history.

Checked against hand-computed values, across a month boundary.

### Filter & search

Above the history: a search box, an interest select, and All / Done / Open.
Search covers the suggestion, the topic and the note, ignoring case and
accents (`fold()` in `lib/historyFilter.ts`), so "sumniki" finds "Šumniki". Today's
card is never filtered. The filter waits for a 150 ms pause in typing, then the
list crossfades as a whole rather than playing a burst of row exits, and the
section heading counts what's shown ("3 of 7"). Hidden while the history has
fewer than two entries.

### Export to Markdown

**Export to Markdown** in the Daily side column, or Settings → Data, opens a
native save dialog and writes
the whole history: newest first, grouped by day, each with done state,
suggestion, note (as a quote) and explanation. `src/main/exportHistory.ts`.

- Plain text that happens to start a line with `#`, `>`, `- ` or `1.` is escaped
  so it doesn't turn into a heading or list. A digit can't be backslash-escaped
  in Markdown, so `1.` becomes `1\.`.
- "Show in folder" takes no path from the renderer: main remembers where it
  last wrote.

### The API key

Stored in `%APPDATA%/career-app/config.json` — never in the repo, never in the
packaged bundle. `src/main/config.ts` loads it and only `src/main/ai.ts` uses it.
The renderer can set a key (Settings, or the Daily tab's first-run panel) and ask
whether one exists (`settings:get` returns `hasApiKey`), but there is no IPC
route that returns the key itself.

## Explanation tab

Every daily suggestion, today's and each older one, has an Explain button
("Explain step by step" on today's card, a book icon on history rows). Pressing
it switches to the Explanation tab, which shows a numbered step-by-step
walkthrough of the task, with the suggestion and the key concepts you will meet
doing it in the side column. Nothing is generated until you press the button.

- **One call per suggestion**, about 600–800 tokens (607–801 measured). The call
  uses JSON output with a `responseSchema`: `steps` is an array of strings, and
  `concepts` is an array of `{ term, definition }`.
- **Cached on the entry** as `explanation`, so opening it again is instant and
  free. When a card's explanation is already cached, its button is drawn in
  the accent colour; when pressing it would spend tokens, the tooltip ends in
  "(uses AI)". **Regenerate**, under Key concepts, writes a new one.
- **Steps tick off.** Click a step to mark it done; a count and a bar sit above
  the list. Ticks live in localStorage, keyed by the suggestion and the
  explanation's `generatedAt`, so a regenerated explanation starts clean. They
  are a reading aid, so they stay out of `daily.json` and the export.
- **Finish** under the steps ticks the suggestion itself off, as on the Daily
  tab, so progress and the streak follow. It stays disabled until every
  step is ticked, and shows "Done" once the suggestion is.
- **One at a time.** The tab holds only which entry is open
  (`store/useExplainStore.ts`). The explanation itself lives on the entry in the
  Daily store, so there is one copy. Deleting the suggestion on the Daily tab
  takes its explanation with it, and the tab says so.
- Code: `generateExplanation()` in `src/main/ai.ts`, `explainEntry(id, force)`
  in `src/main/daily.ts`, and the IPC channel `daily:explain`. Switching tabs from Daily
  goes through `store/useNavStore.ts`.

### Code in explanations

The prompt asks for code, commands, paths, shortcuts and symbols in single
backticks, exactly as typed. `components/InlineCode.tsx` renders each matched
pair as monospace, and a stray backtick is left alone. The rule is that specific
because each looser version failed:

- "Plain text" alone made the model write "ampersand str" instead of `&str`.
- After that it doubled braces, writing a function body as `{{ … }}`, which is
  invalid Rust. Telling it "never escape quotes" made it drop the quotes
  instead, since JSON output has to escape them.
- The current rule gives one concrete example, `println!("{}", x);`, to be kept
  character for character. It produced 3 of 3 clean regenerations of a Rust
  entry.

Doubled braces are not collapsed after the fact: Vue and Jinja templates use
`{{ }}` legitimately.

The main process strips a leading "1.", "Step 2:" or "- " if the model adds one
anyway. A space after the marker is required, so "3-4 times" and "-O2" keep
their start.

Cards carry `data-entry-id`, which the CDP tests use to target one card.

## Question Generator

Built to `GEMINI_PROMPT_SPEC.md`. The spec is written client/server; here the
"server" half is the main process.

- `src/shared/curriculum.ts` — the fixed class and subject lists. The subject
  list differs between primary school and gimnazija, so changing the class
  clears a subject that doesn't exist at the new level.
  Computer science is **not** in the spec's list; it was added on request under
  its real curriculum name for each level — `Računalništvo` in primary school,
  `Informatika` in gimnazija. Keeping the level-correct name matters because the
  system prompt tells the model to follow the Slovenian syllabus for that
  subject and class.
- `src/main/ai.ts` — `generateQuizQuestions` sends the spec's system prompt
  verbatim, with `responseMimeType: application/json`, `temperature: 1.0` and
  the spec's `responseSchema`.
- `src/main/questions.ts` — validation, memory, retry.

### What is remembered

`%APPDATA%/career-app/questions.json` holds, per subject:

- `topics` — the newest 30 become `izogni_se`, so the model spreads across the
  syllabus instead of drilling one chapter
- `hashes` — of questions already shown, normalised per the spec (lowercase, no
  punctuation, no carons), so a reworded repeat is still caught

The spec's `seen_topics` table has a `user_id`; dropped, because this app is
single-user and local, so every row would hold the same value.

### Validation

Every rule from the spec's Validacija section is enforced in `validate()`. A
failing element is discarded silently and the call is repeated for the shortfall
(bounded to 3 attempts). An error only reaches the user if *nothing* usable came
back — a short batch is still shown.

### Answers are shuffled locally

The model puts the correct answer first almost every time — measured at **29 of
30** across three subjects, which makes the quiz gameable by always picking A.
The spec doesn't cover this (its own example has `"pravilen":0`), so
`shuffleAnswers()` reorders the four options and follows the correct one to its
new index. Verified over 8000 shuffles: even distribution, correct answer still
correct.

### Random, and remembered settings

Both dropdowns carry a **Naključno** entry. `resolveSelection()` in
`curriculum.ts` turns a selection containing RANDOM into a concrete pair, and
the subject wins over the class: Sociologija is gimnazija-only and DKE is
primary-only, so with a fixed subject and a random class it draws only from
classes that actually teach it.

The store keeps the raw selection separately from the resolved `config`, so a
random pick draws a fresh subject each round rather than locking to whatever
came up first. The quiz screen shows the drawn subject and class, which is the
only way to know what you got.

The setup screen's selection is saved to localStorage on every change (see
`store/quizPrefs.ts`) and restored on launch — Electron persists localStorage
under userData, so it survives a restart, not just a reload.

### Prefetch, and why it is not eager

The spec asks for a prefetch. Doing it on every round costs more than it saves:
a batch is ~1540 tokens and the input half (670, of which 635 is the system
prompt) is fixed overhead, so a speculative fetch the user never reaches doubles
the price of a round.

So the first "Naslednji krog" is fetched **on demand** — a short wait — and only
once the user has actually continued does the app fetch ahead during play. A
batch that has been paid for is never discarded either: if it is still unused
when the user restarts with the same settings, it is consumed instead of buying
another.

A failed prefetch is swallowed; the next round is simply fetched on demand.

### Progress bar

`components/QuizProgress.tsx` — one segment per question: green or red once
answered, the accent for the question on screen, grey for those ahead. It
changes the moment an answer is given, not on "Naprej", so the click has
immediate feedback. The score screen shows the same row, with nothing current.

Beside the question, **Ta krog** counts right and wrong so far and gives the
subject's accuracy over every round, read again from `quiz-history.json` after
each answer (a local read, no AI). In a new round a **Ponovi napake** card
appears there too when the selection has open mistakes; it ends the round and
starts the review.

### Ending a round early

A quiet "Končaj kviz" sits in the quiz header, away from the primary
Naprej/Zaključi button. It scores only what was answered — the summary reads
"2 od 2", not "2 od 6" — because answers are given in order, so the answered
questions are always a prefix and trimming to that length keeps the answer
indices aligned. Ending before answering anything just returns to setup, since
there is no score worth showing. Any prefetched batch survives: it is already
paid for.

### seen_topics is committed only when a batch is shown

`generateQuestions` does not write to disk. The renderer calls
`questions.markSeen()` when a batch actually becomes the round on screen.

Without this, a prefetched batch the user never reached would permanently burn
its questions — marked as seen, never generated again — and its topics would
inflate `izogni_se` (~10 tokens per topic on every later call). An in-memory set
of issued hashes still stops a prefetch from duplicating the batch on screen;
it is dropped on restart, so genuinely unseen questions can come back.

### Token economics

Measured against `gemini-3.5-flash-lite`:

| | tokens |
|---|---|
| Quiz system prompt | 635 — 95% of a request's input |
| `izogni_se` at 30 topics | +291 |
| Daily system prompt | 109 |
| Daily avoid-list at 5 priors | +295 |

Input is fixed per call, so batch size dominates the per-question cost: 875 at
`stevilo=1`, 405 at 3, 308 at 5, 240 at 10. Hence the default of 10.

Implicit caching does not apply — two identical calls both billed the full 670
input tokens and `cachedContentTokenCount` never appears, because these requests
sit below Gemini's minimum for it. Do not assume the repeated system prompt is
free.

### Review mistakes (Ponovi napake)

Every answer is logged to `quiz-history.json` (`src/main/quizHistory.ts`). A wrong
one also stores the **whole question**, keyed by the same hash `questions.ts`
uses, so it can be asked again with no AI call at all.

- "Ponovi napake (N)" sits next to "Začni", counting mistakes for the chosen
  class and subject ("Naključno" counts all). Hidden when there are none.
- A review round takes the oldest mistakes first, up to the round size, with the
  answers reshuffled so a remembered position gives nothing away. Each carries
  its own subject and class, shown in the header.
- A mistake is cleared the first time it's answered correctly; a wrong answer
  again just counts another miss. The score screen says how many are left.
- Reviews skip prefetch and `markSeen`, and "Poskusi znova" after a failed
  review retries the review — it never quietly turns into an AI round.

Caps: 5,000 answers and 300 mistakes, oldest dropped first. Stats and reviews
read through the same queue as the writes, so a round's last answer is always
counted.

### Statistika

A card beside the setup: answers and share correct overall and a bar per
subject; click a subject for its classes, its three weakest topics (at least 3
answers each) and its open mistakes. Slovenian plurals are handled —
"3 odgovori", "5 odgovorov", "1 odprta", "2 odprti" — by the last two digits.

### Keyboard

`1–4` (number row or numpad) or `A–D` answer; `Enter` or `→` goes on once
answered. Only while the quiz is the tab on screen and a question is up — every
tab stays mounted, so the listener checks. Keys from a text field are ignored,
and so is Enter on a focused button, which the browser already clicks: handling
it too would skip a question.

## Window frame

The native title bar is hidden (`titleBarStyle: 'hidden'`), which drops its icon
and "Career App" text. Electron draws the three caption buttons over the right
end of an empty 34px strip above the page (`TITLE_BAR_HEIGHT` in
`windowTheme.ts`). That strip and the rail's empty space are the drag handles
(`-webkit-app-region: drag`): drag, double-click to maximise, snap.

The buttons follow the theme without main owning any colour: `useColorMode`
reads `--app-bg` and `--app-text-muted` from the page and sends them
(`frame:set-theme`). Main validates `#rrggbb`, recolours the overlay, and caches
the set in `window-theme.json`, so the next launch opens dark with no light
flash. The only hex in main is the first-run fallback.

Anything clickable added to the strip or the rail needs `WebkitAppRegion: 'no-drag'`.

## Settings

The gear at the bottom of the rail (`Ctrl+,`). It isn't in the tab list, but it
shows the same selected background. Each field saves on its own and is validated in
main; the page then shows the settings read back from disk.

- **Appearance**: Light / Dark / System.
- **Gemini**: API key (write-only), model (checked against
  `/^[a-z0-9][a-z0-9.-]{0,63}$/i` because it is interpolated into the request
  URL; a hand-edited bad one falls back to the default), daily token budget.
- **Daily reminder**: see below.
- **Data**: export to Markdown.

`config.json` stays hand-editable: writes change only their own keys and keep
anything else in the file.

## Keyboard shortcuts

| Keys | Does |
|---|---|
| `Ctrl+1` … `Ctrl+4` | Interests, Daily, Explanation, Quiz (the rail shows each) |
| `Ctrl+,` | Settings |
| `1–4` / `A–D`, `Enter` / `→` | answer and continue, in the quiz |

The Ctrl chords work from inside text fields, since they type nothing. They are
matched on `event.code`, so the digits work on any keyboard layout.

## Daily reminder, tray and Start with Windows

**The reminder** (`src/main/reminder.ts`) is a Windows notification at the time
set in Settings, with today's topic and suggestion; clicking it opens the Daily
tab. If today isn't generated yet it is generated then — the same single call
opening the app would make. Nothing is shown once today is ticked off.

When to fire is `shouldFire()` in `src/shared/reminder.ts`: fire when today's
moment falls between the previous 30-second check and this one, at most once a
day. So a launch after the time doesn't fire, waking from sleep past it fires
once, and moving the time earlier than now waits for tomorrow. 13 cases tested,
including a month boundary.

**The tray** (`src/main/background.ts`): with "Keep running in the tray" on,
closing the window hides it instead of quitting, and the tray menu has Open and
Quit. A second launch brings a hidden window back. Turning the tray off while
hidden shows the window, since there would be no way back to it.

**Start with Windows** registers the app with `--hidden`; with the tray on, a
sign-in launch waits there instead of opening a window. It's for the installed
build only — in dev it would register a bare `electron.exe`, so the switch is
disabled and main refuses the call. The portable build registers its real .exe
(`PORTABLE_EXECUTABLE_FILE`), not the temporary copy it runs from.

**A new day while open**: the Daily tab reloads when the window regains focus on
a new calendar day, or when the reminder has generated today's suggestion.

"Send a test notification" shows today's reminder immediately. It never
generates, so it never spends tokens, and it reports whether Windows showed it.
Notifications need the AppUserModelId set in `index.ts`. If one doesn't appear,
check Focus assist and the app's notification setting in Windows.

The tray and notification icon is `build/icon.ico`, shipped to
`resources/icon.ico` by electron-builder's `extraResources`.

## Animations

Motion for React (`motion`) throughout, tuned to be **purposeful**: each
animation explains a state change, and none runs longer than ~250 ms. No
celebration effects or count-ups.

`src/renderer/src/theme/motion.ts` holds every preset — springs, the `fadeUp`,
`crossfade`, `slideAcross`, `listItem` and `popIn` variants, and the `shake`,
`pop` and `tick` keyframes. It plays the role `theme.css` plays for colour:
retune the feel of the whole app in one file.

| Where | What moves |
|---|---|
| Tabs | The incoming panel fades up |
| Token panel | Scales out of the rail from its bottom-left corner, and back |
| Quiz screens | Setup, loading, play, score and error crossfade |
| Quiz questions | Old question leaves left, new one arrives from the right |
| Quiz answers | The right answer pops, a wrong pick shakes |
| Quiz reveal | Explanation and Naprej fade up; the score scales in |
| Daily | Today's card and the spinner crossfade; a tick pops the checkbox or the Done button |
| Notes | The note field fades up under a suggestion when it's ticked |
| Progress | By interest opens and closes by height; the chevron turns |
| Streak | The flame pops when today's tick lights it |
| History filter | A new filter crossfades the whole list |
| Lists | Rows slide in; a deleted row leaves and the rest close the gap |
| Confirms | Trash icon and "Delete? Yes/No" crossfade |

### Rules the code follows

- **Transform and opacity only.** List removal uses
  `<AnimatePresence mode="popLayout">` with `layout` on each row: the leaving
  row is lifted out of the flow and its siblings close the gap by transform,
  never by animating `height`. The list container must be `position: relative`.
  The one exception is the collapsible By interest panel: it animates `height`
  from 0 to `auto` in a 160 ms tween, because nothing else can reveal it
  without the content below jumping.
- **No entrance on launch.** `initial={false}` wherever content is already on
  screen at first paint.
- **Never mutate refs during render.** An earlier spring-driven quiz bar read a
  ref during render, and React's double-invoked render left it a step behind.
- **Motion on a wrapper, not the Chakra element.** Both want a `transition`
  prop; the wrapping `motion.div` avoids the clash. A wrapped element loses
  whatever stretching its old flex parent gave it — a `<button>` then shrinks to
  its text, which is how the quiz answers briefly lost their full width. Give it
  `w="full"`.

### Structural choices worth knowing

- **The progress segments and the "Vprašanje N od M" heading sit outside the
  sliding question body**, in `QuestionGeneratorTab`, so they hold still. The
  topic travels with its question.
- **Tab panels stay mounted.** The Daily tab generates on mount, so unmounting
  inactive tabs would re-trigger it. Only the entrance animates, since inactive
  panels are `display: none`. Verified: six tab switches, zero AI calls.
- **Editing an interest uses `popLayout`, not `wait`.** `wait` would delay the
  input by 160 ms and drop keystrokes typed straight after clicking the pencil.
- **Daily history rows carry their own rule** instead of a `Stack separator`,
  whose injected dividers would be orphaned while a row plays its exit.
- **The checkbox has its own `tick`** (scale 1.25): `pop`'s 4% bump moves a
  20px box by less than a pixel.

### Reduced motion

`<MotionConfig reducedMotion="user">` in `main.tsx` drops transform and layout
animation for users with reduced motion on, and keeps the opacity fades.

Motion reads the preference **when each component mounts**. Launch with reduced
motion on and everything is correct; flip the Windows setting while the app is
open and components already on screen keep animating transforms until the next
launch.

### A minimised window freezes transitions

Chromium produces no frames for a minimised window, so a transition in flight
pauses — and in `mode="wait"`, the next screen only mounts once the old one has
finished exiting. A quiz that finishes loading while minimised appears the
moment the window is restored. Nothing is lost: the store has already moved on.

To drive the app over CDP while it is hidden, launch it with
`--disable-backgrounding-occluded-windows --disable-renderer-backgrounding`
and keep the window occluded rather than minimised.

## App icon

`build/icon.ico` is the icon: a multi-size Windows icon (16, 24, 32, 48, 64,
128, 256) generated from `src/renderer/src/logo.png`, which stays as the source
artwork. `electron-builder.yml` stamps it into the `.exe`, and
`src/main/index.ts` passes it to BrowserWindow in dev, where there is no
packaged `.exe` to take it from.

**It must be an .ico, not the PNG.** Electron accepts a PNG and Windows really
does set it — but as a single icon at the PNG's own size. With the 447x447 logo,
`WM_GETICON` returned a 447x447 icon, which Windows cannot use for the title bar
or taskbar, so it silently fell back to the `electron.exe` atom. With the .ico it
returns a proper 32x32.

`app.setAppUserModelId('com.jon.careerapp')` is set on Windows to match the
electron-builder appId, so the taskbar treats the app as itself rather than as
whatever binary launched it.

### Regenerating it

The `.ico` is generated, so it does not follow edits to `logo.png` on its own.
electron-builder produces one from a >=256px PNG: point `win.icon` at the PNG,
run a build, and copy `dist/.icon-ico/icon.ico` back to `build/icon.ico`.

### Dev still shows the Electron icon in the taskbar

Expected, and only in dev. The running binary is `node_modules/electron/dist/electron.exe`,
and the Windows taskbar keys its button to that executable. The packaged app has
the icon embedded in its own `.exe` — verified by extracting it back out — so
installs, shortcuts and Explorer all show the logo.

## Token usage meter

The rail shows Gemini tokens spent today, above Settings. Clicking it
opens a small panel with the input/output split and a per-feature breakdown.

Numbers come from the `usageMetadata` block Gemini returns on every response —
what Google actually counted, not an estimate. `src/main/usage.ts` records each
call into `%APPDATA%/career-app/usage.json`, keyed by local calendar day and
tagged by feature, keeping the last 60 days. Writes are queued so two calls
finishing together can't lose one, and a failure to record never breaks the
feature the user was actually using.

### Why there is no percentage by default

Google exposes no per-key quota endpoint, so there is nothing to show a
percentage *of*. Rather than invent a ceiling, the meter shows the raw count and
draws no bar. Set a self-chosen ceiling in **Settings → Daily token budget** (or
`"dailyTokenBudget": 50000` in config.json) to get one; the meter's panel links
there.

With a budget the bar fills, and turns red once it is passed. This is your own
budget, not a limit Google enforces.

## Testing

Changes are checked in a sandbox, never against real data: the built app is
launched with `--user-data-dir` pointing at a scratch folder and
`--remote-debugging-port`, and driven over CDP. Keep that window occluded or
off-screen, not minimised (see above).

- **No tokens for UI states.** The preload API is frozen, so it can't be stubbed.
  Tests find the zustand stores through a CDP heap query
  (`Runtime.queryObjects` on `Object.prototype`, filtered by
  `getState`/`setState`/`subscribe`) and put, say, a quiz with canned questions
  on screen.
- **Pure logic** — `computeProgress`, `shouldFire`, `buildMarkdown`,
  `buildDailyPrompt` — is bundled with esbuild (electron aliased to a stub) and
  run against hand-computed cases.
- **Native bits** — the title bar hit-test, the save dialog, close-to-tray — are
  driven with Win32 window messages, which touch nothing else on screen.
