# Mangekyo

A local-first visual practice PWA built with React, TypeScript, Vite, and Canvas. No account, analytics service, external fonts, or backend is required. Experimental training performance is **not** a clinical outcome or validated amblyopia treatment.

## Develop and build

Use Node.js 22.12+ (or a newer supported release) and npm.

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

The production output is `dist/`. `npm run build` type-checks the application, builds fingerprinted assets, and generates an offline service worker from those exact assets. Development mode intentionally does not register the service worker. Icons are original procedural artwork; regenerate with `node scripts/icons.mjs`.

## GitHub Pages deployment

The checked-in workflow at `.github/workflows/pages.yml` tests, builds, and publishes the app on pushes to `main`. Pull requests run the tests and build without deploying. It uses GitHub's Pages artifact deployment and requires no third-party hosting credentials.

1. Create a GitHub repository named `mangekyo` and push this source to its `main` branch.
2. In repository **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source.
3. Run **Deploy to GitHub Pages** from the Actions tab (or push another commit).
4. Wait for the deploy job to succeed and open the URL reported by that job. A project named `mangekyo` normally uses `https://<owner>.github.io/mangekyo/`.

GitHub Pages works with public repositories on GitHub Free; Pages from a private repository needs an eligible paid GitHub plan. The Pages site itself is normally public even when its source repository is private. See [GitHub's Pages workflow guidance](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Vite emits relative asset URLs, so the same build works at the project path and at a custom-domain root. The manifest, install icons, and service worker resolve within that path. Offline caches are scoped per deployment path so updates do not delete another Pages project's caches on the same origin. GitHub controls HTTP caching headers; the app provides its own service-worker update prompt.

To move existing history from the previous host, export a backup from **Settings → Export all data**, then import it on the new Pages URL. Browser storage belongs to each origin and does not transfer automatically.

For other static hosts, upload all of `dist/`, including `sw.js`, the manifest, icons, and `assets/`. No backend or environment variables are required.

### iPhone installation

1. Open the HTTPS URL in Safari while online and allow the first load to finish.
2. Share → Add to Home Screen → Add.
3. Open the Home Screen app, then test offline launch before relying on it.
4. An available app update appears as a button outside exercise mode. Finish or save the session before updating.

`localhost` is usable on the development computer. A LAN HTTP address is **not** sufficient for iPhone PWA installation/offline functionality; use HTTPS hosting.

## Language

Mangekyo supports English and Vietnamese. It reads the browser's ordered language preferences, chooses the first supported language, and falls back to English. Dates and numbers follow a matching regional locale when available. **Settings → Language / Ngôn ngữ** can override device language; the choice is saved in IndexedDB and included in backups.

[Open in Vietnamese](https://hellosputnik.github.io/mangekyo/?lang=vi) for a direct Vietnamese entry point, including from an English-language browser. `?lang=en` also works. A manual language change removes the URL override, and `Use device language` restores automatic selection. Older data and backups without a language field remain compatible.

Both language catalogs and the Vietnamese install manifest are cached for offline use. The interface, safety text, response controls, recovery, history, and settings are translated. User-entered routine names and professional measurement notes retain their original text. Stored exercise/eye identifiers and time accounting remain language-independent.

Translation catalogs are in `src/i18n/en.ts` and `src/i18n/vi.ts`; `locale.ts` handles detection/formatting and `react.tsx` supplies the UI context. Tests check locale selection, translation/placeholder parity, regional formatting, stable option values, record preservation, and preference migration.

## What works

- Responsive practice dashboard, four Canvas exercises, dark training stage, safe-area padding, visual eye selection, glass-style navigation, touch controls, and portrait/landscape layouts. The glass treatment has opaque and reduced-motion accessibility fallbacks.
- Phone portrait setup recommends landscape for pursuit and saccadic practice to provide more horizontal room. Portrait remains available; vertical-only pursuit and discrimination tasks do not show the hint. Rotating keeps session state and never starts an exercise automatically.
- Every exercise has visible **Default / Custom** controls in the same place. Custom opens the shared settings sheet with that exercise's relevant controls. Each exercise keeps its own draft settings and duration while switching within the open app; Default restores stimulus settings while retaining duration and viewing distance. Sessions, including routine steps, record the selected exercise's configuration.
- Pursuit: a compact choice between **Default (mixed)** and **Custom**. Default gives horizontal, vertical, circular, figure-eight, and smooth wandering paths an equal share of active time within the five-minute session. Custom opens a modal settings sheet for path selection, size, speed, contrast, complexity, colors, and viewing distance. Duration is always adjustable. Pausing/recovery preserves the mix position.
- Saccades: reproducible pseudo-random jumps; custom target size, contrast, exposure, pause, jump distance, colors, and optional acknowledgement. No gaze measurement.
- Visual response tasks: C-like opening, directional pattern, directional triangle, with custom size, contrast, and colors. Contrast tasks: localized gratings or circles with adjustable size, contrast, and background. Contrast pattern size works for both forms and fits within non-overlapping panels on small stages. Four touch answers. Every five responses, accuracy adjusts an independent exercise level within bounds. Scheduling never advances difficulty.
- 30-minute default personal daily goal, 5-minute default sessions, 1-minute default rests; duration sliders with exact minutes-and-seconds entry. These are scheduling preferences, not treatment doses.
- Monotonic active timer; neutral Pause and one End session action with automatic saving. Resume is emphasized while paused. Routine sessions offer Skip exercise. Reaching the configured duration marks completion; ending sooner keeps valid time and records Stopped early. Background interruption still requires explicit reload recovery.
- Saved routines with repeated/reordered steps, individual durations, per-routine rests, manual rests, extension, skipping, and early ending.
- Statistics: lifetime active time, sessions, practice days, answers, average session duration, exercise report cards, weighted answer accuracy, median response time, recent results, a seven-day activity chart, and totals by eye. Session history retains exercise-specific configurations; professional measurements stay separate.
- Confirmed statistics reset, optional clearing of professional measurements or exercise difficulty, and a persistent Undo copy that preserves practice added afterward.
- JSON export and validated merge import. Existing record IDs win on conflicts. Imported active sessions become interrupted historical records; they do not start automatically. Schedule preferences are restored; in-progress routines are recovered locally, not resumed from imports.
- Offline app-shell caching, update prompt, optional wake lock, optional rest-end sound/vibration, and high-contrast/gentler-motion controls.

## Timing and persistence contract

`ActiveTimer` uses `performance.now()` for running intervals. `visibilitychange` and `pagehide` pause and persist state. Background time is never calculated from wall-clock timestamps. A frame also checks visibility before crediting time. On reload, a saved current session is always interrupted; the user must explicitly resume. Paused and interrupted time never earns credit. End/skip write a session once by ID and retain valid partial time. The timer classifies newly ended sessions as completed only when accumulated active time reaches the configured duration; shorter sessions are stored as stopped early. Repeated ending, pausing, or resuming cannot reopen a terminal timer. Historical records retain their original status.

Foreground time is checkpointed each animation frame and saved approximately every second and at lifecycle transitions. An abrupt OS kill may lose the most recent unsaved second (or more if the storage transaction was delayed); it does not reconstruct missing time. IndexedDB cannot guarantee a transaction completes during process termination. Storage failures produce a visible error and export remains available for the in-memory state.

Each active-time slice stores local calendar date, IANA timezone, and UTC offset. Intervals crossing midnight are split. Historical days retain the date experienced at training time rather than being reassigned after travel. A manual system-clock change near midnight can affect attribution of that short foreground interval, never its monotonic duration.

Rest countdowns also pause when hidden and are persisted; they never auto-start an exercise. Notifications are optional and best effort. Browser audio policies can suppress sounds; iOS vibration is often unavailable.

## Architecture

- `src/engine/model.ts`: typed configuration, records, validation, defaults.
- `src/engine/practice.ts`: independent exercise drafts and Default/Custom selection, separate from scheduling and adaptive levels.
- `src/engine/timer.ts`: React-independent active timing and bounded adaptive progression.
- `src/engine/routines.ts`: routine and break transitions.
- `src/engine/statistics-reset.ts`: scoped report reset and recovery without interrupting an active session.
- `src/exercises/exercise.ts`: common exercise lifecycle and Canvas stimulus renderer.
- `src/exercises/pursuit.ts`: motion presets, active-time path selection, and continuous mixed-path transitions.
- `src/persistence/`: IndexedDB snapshots and validated backup merging.
- `src/analytics/`: deduplicated active-time aggregation, lifetime reports, and response metrics.
- `src/components/`: focused practice, statistics, record, navigation, and routine views; shared eye, duration, stepper, and switch controls in `controls/`.
- `src/main.tsx`: application coordination, session lifecycle, and settings.

Canvas backing resolution uses device pixel ratio (capped at 3 for memory use). Target settings are CSS pixels, not millimeters or calibrated visual angles. Viewing distance is recorded metadata, not an automatic calibration. Native adapters, eye tracking, cloud sync, and physical display calibration are intentionally absent.

## Statistics and reset

The Statistics tab (Thống kê in Vietnamese) presents a lifetime report from saved session records. Partial sessions retain their active time. Practice days come from positive-time local calendar slices, including sessions crossing midnight; older records without slices use their start date. Duplicate IDs are counted once, with a current session taking precedence. The seven-day chart uses stored local dates and scales to the largest day, independently of the daily goal.

Exercise report cards aggregate their recorded eyes and settings. Response accuracy is correct answers divided by all answers for that exercise, rather than an average of session percentages. Median response time includes correct and incorrect answers. The six latest response sessions show their individual accuracy; their conditions can differ. Pursuit and saccades report time and sessions without assigning a gaze score. Exercise scores are training performance, separate from eyesight or clinical outcomes.

**Manage statistics → Reset statistics** opens a confirmation. It clears saved session history and starts a fresh report. Professional measurements and exercise difficulty can be cleared independently with explicit switches; routines and preferences stay. Reset and Undo are blocked while an exercise or routine is in progress, including interrupted recovery. Cancel receives initial focus, and confirmation actions remain visible while the body scrolls on a short landscape screen.

Undo retains one previous copy locally through reloads. It merges the old records with new practice and measurements without duplicating IDs. If difficulty was reset, Undo restores it only for exercises with no new session since reset. Another reset replaces the previous Undo copy. JSON exports include this copy; validated imports keep it separate from current statistics until Undo is selected.

Report previews in [the design audit](docs/apple-design-audit.md) use synthetic example records, not a person's training or clinical results.

## Validation and physical-device checklist

Automated tests cover monotonic timing, pause/resume/background exclusion, duration caps, partial and abandoned sessions, recovery, local midnight boundaries, duplicate accounting, routine advancement, break transitions, invalid configuration, adaptive boundaries, exercise termination, IndexedDB round trips, snapshot isolation, and backup validation.

Desktop browser checks cover start, pause, reload recovery, completion-to-rest transitions, update activation, and an offline reload plus response exercise with the production server stopped. The offline test caught and fixed static-asset cache misses caused by `Vary: Origin`; cached same-origin assets now ignore Vary during lookup. A physical iPhone is still required to verify:

- Safari and installed Home Screen launches, airplane-mode cold starts, and update activation.
- Rotation during an active session, dynamic browser bars, safe areas, zoom accessibility, and both small and large iPhone displays.
- Lock/unlock, incoming calls, app switching, low-power mode, force quit, storage eviction, and quota failure.
- Wake lock, optional audio and vibration, and performance at 60/120Hz.
- Daylight saving changes, travel across timezones, and manual clock changes on a device.

## Limitations and safety

Not clinically validated. No claim of curing amblyopia, improving acuity, or measuring eye movements. Display contrast and target size are uncalibrated. Improved task scores may reflect familiarity and do not establish improved eyesight. Follow qualified eye-care guidance for patching and frequency. Practice seated with comfortable brightness, never while driving/walking or doing hazardous tasks. Stop immediately if uncomfortable.

Browser storage can be cleared or evicted. Export backups regularly. Do not train simultaneously in multiple tabs: the initial version uses a single local state snapshot and does not arbitrate concurrent writers. No native apps, accounts, cloud synchronization, gaze tracking, or clinical testing have been implemented.

Unstarted exercise settings are drafts in memory and reset on reload. A started session stores its complete configuration in IndexedDB for recovery and history; changing a draft never rewrites recorded sessions.

## Design skill

The reusable Codex `$apple-design` port is included at `tools/skills/apple-design/`, with the original MIT license and upstream reference. It is installed for this user at `~/.agents/skills/apple-design`. See [the applied design audit](docs/apple-design-audit.md) for findings, changes, and verification limits.
