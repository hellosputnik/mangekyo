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

- Responsive practice dashboard, six Canvas exercises, dark training stage, safe-area padding, visual eye selection, glass-style navigation, touch controls, and portrait/landscape layouts. The glass treatment has opaque and reduced-motion accessibility fallbacks.
- Phone portrait setup recommends landscape for pursuit and saccadic practice to provide more horizontal room. Portrait remains available; vertical-only pursuit and discrimination tasks do not show the hint. Rotating keeps session state and never starts an exercise automatically.
- Every exercise has visible **Default / Custom** controls in the same place. Custom opens the shared settings sheet with that exercise's relevant controls. Each exercise keeps its own draft settings and duration while switching within the open app; Default restores stimulus settings while retaining duration and viewing distance. Sessions, including routine steps, record the selected exercise's configuration.
- Pursuit: a compact choice between **Default** and **Custom**, matching the other exercises. Default gives horizontal, vertical, circular, figure-eight, and smooth wandering paths an equal share of active time within the five-minute session. Custom opens a modal settings sheet for path selection, size, speed, contrast, complexity, colors, and viewing distance. Duration is always adjustable. Pausing/recovery preserves the mix position.
- Saccades: reproducible pseudo-random jumps; custom target size, contrast, exposure, pause, jump distance, colors, and optional acknowledgement. No gaze measurement.
- Tap targets: generous target halos, release-to-confirm touch/mouse input, points and correct runs, hit-rate adaptation, saved target position, and per-trial touch distance/tolerance. Misses retain the target. Hit areas never shrink below 44 CSS pixels; drags and cancelled presses do not count as answers.
- Follow the target: a handle below the cursor leaves the dot visible, with pointer capture and preserved grab offset. The timer runs only during a valid hold. Releasing, cancelling or rotating pauses; explicit interruption recovery arms a fresh grab. Custom path, speed, size, contrast, halo, colors, viewing distance and self-reported hand are recorded. Reports show time on target, time-weighted mean distance and best continuous time on target.
- Visual response tasks: C-like opening, directional pattern, directional triangle, with custom size, contrast, and colors. Each correct answer reduces the visual target size; two mistakes in the last three answers enlarge it. Progression continues beyond the former 12-level cap. Contrast tasks: localized gratings or circles with adjustable size, contrast, and background, within non-overlapping panels on small stages. Contrast retains its independent five-answer accuracy rule. Scheduling never advances difficulty.
- Response exercises show a correct-answer checkmark, +1 point, best correct run, and a small milestone every five consecutive correct answers. Incorrect answers retain earned points. Feedback never blocks the next answer. Scores recover with saved trials and appear on the rest screen and in session details. Practice sound and short haptic pulses default on with independent controls; saved choices remain respected. Rest-end notifications have their own preference.
- 30-minute default personal daily goal, 5-minute default sessions, 1-minute default rests; duration sliders with exact minutes-and-seconds entry. These are scheduling preferences, not treatment doses.
- Monotonic active timer; neutral Pause and one End session action with automatic saving. Resume is emphasized while paused. Routine sessions offer Skip exercise. Reaching the configured duration marks completion; ending sooner keeps valid time and records Stopped early. Background interruption still requires explicit reload recovery.
- Saved routines with repeated/reordered steps, individual durations, per-routine rests, manual rests, extension, skipping, and early ending.
- Statistics: day/week/month activity browsing, date selection, interactive chart filtering, timed session lists, and detailed session sheets. Lifetime active time, sessions, practice days, average session duration, exercise report cards, weighted answer accuracy, median response time, recent results, and totals by eye remain available below. Session details retain exercise-specific configurations; professional measurements stay separate.
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
- `src/exercises/visual.ts` and `responses.ts`: size progression, per-answer stimulus records, points and correct runs, independent of React and scheduling.
- `src/exercises/touch.ts` and `factory.ts`: shared lifecycle, touch geometry, pointer interaction and active-time sampling, independent of React and browser APIs. `src/analytics/touch.ts` weights following results by actual tracked time.
- `src/persistence/`: IndexedDB snapshots and validated backup merging.
- `src/analytics/`: deduplicated active-time aggregation, calendar periods, recorded time-zone formatting, lifetime reports, and response metrics.
- `src/components/`: focused practice, statistics, record, navigation, and routine views; shared eye, duration, stepper, and switch controls in `controls/`.
- `src/main.tsx`: application coordination, session lifecycle, and settings.

Canvas backing resolution uses device pixel ratio (capped at 3 for memory use). Target settings are CSS pixels, not millimeters or calibrated visual angles. Viewing distance is recorded metadata, not an automatic calibration. Native adapters, eye tracking, cloud sync, and physical display calibration are intentionally absent.

## Statistics and reset

The Statistics tab (Thống kê in Vietnamese) starts with calendar activity inspired by [Apple Health's period selection and chart details](https://support.apple.com/guide/iphone/view-your-health-data-iphe3d379c32/ios). Choose Day, Week, or Month, move between periods, or select a date. Tap/drag the chart to filter sessions by date or start hour; Show all clears the selection. Weeks follow the selected regional locale, including Monday-first Vietnamese weeks. Month navigation respects calendar lengths and leap years.

Open a session row for start/end date, recorded time zone and UTC offset, active/planned time, eye, status, answer results, best correct run, and full settings. New visual responses include the range of presented target sizes. Session lists show ten entries at a time with Show more; the full historical list remains available too. A session spanning midnight appears on each affected day with that day's active-time credit.

The chart uses positive-time local calendar slices; duplicate session IDs count once and a current session takes precedence. Partial sessions retain valid time. Day view groups each day's credited time by the session's **start hour**, not exact minute-by-minute activity: saved slices do not contain individual interval timestamps. Time continuing from an earlier day's session is reported separately. Start/end clocks use the recorded IANA time zone (or saved UTC offset), while legacy records without either explicitly use the device time zone. Travel does not move saved daily credit to a different date. Charts scale to their data, independently of the daily goal.

The lifetime report and balanced exercise cards remain below calendar activity.

Exercise report cards aggregate their recorded eyes and settings. Response accuracy is correct answers divided by all answers for that exercise, rather than an average of session percentages. Median response time includes correct and incorrect answers. The six latest response sessions show their individual accuracy; their conditions can differ. Pursuit and saccades report time and sessions without assigning a gaze score. Exercise scores are training performance, separate from eyesight or clinical outcomes.

All exercise cards share a four-metric summary, last-practice date, and Details disclosure. Tracking cards include practice days and average session duration; response cards include accuracy and median response time. Card practice durations use minutes:seconds. Completion counts, response breakdowns, recent charts, and recorded levels are available in Details.

**Manage statistics → Reset statistics** opens a confirmation. It clears saved session history and starts a fresh report. Professional measurements and exercise difficulty can be cleared independently with explicit switches; routines and preferences stay. Reset and Undo are blocked while an exercise or routine is in progress, including interrupted recovery. Cancel receives initial focus, and confirmation actions remain visible while the body scrolls on a short landscape screen.

Undo retains one previous copy locally through reloads. It merges the old records with new practice and measurements without duplicating IDs. If difficulty was reset, Undo restores it only for exercises with no new session since reset. Another reset replaces the previous Undo copy. JSON exports include this copy; validated imports keep it separate from current statistics until Undo is selected.

Report previews in [the design audit](docs/apple-design-audit.md) use synthetic example records, not a person's training or clinical results.

## Visual size progression and feedback

A correct visual-discrimination response advances one step, reducing the nominal target radius by 6%. A single mistake holds the size; two mistakes among the last three answers step back three levels (about 20% larger). Repeated errors can return to the configured starting size. The initial radius fits the actual stage before scaling, so large custom targets also shrink immediately. The only size floor is a nominal four backing-pixel diameter at the renderer's device-pixel ratio, with a minimum one-pixel stroke. This is a rendering limit, not a visual acuity threshold.

Difficulty is saved per exercise and clamped to the current stage's renderable range on rotation. New trials record the nominal presented diameter in CSS pixels before advancing. Levels from the older five-answer, 0.91-scale visual progression are preserved, but are not directly comparable with these new steps; compare recorded settings and target sizes where available. Historical trials without size metadata do not receive invented values. Contrast progression is unchanged. Time goals and completion runs never change difficulty.

One correct answer earns one point. Best run means consecutive correct answers **within that session**, not consecutive days. No points are removed for errors or missed days. Scores are practice results, never evidence of improving eyesight. Visual confirmation always works; optional sound/vibration is best effort and may be unavailable under Safari policies. Reload restores points from recorded trials without replaying feedback.

## Touch coordination

Tap targets and Follow the target use the same Default/Custom controls, duration settings, eye selection, routines, rest flow, local history and calendar as the other exercises. Custom records the practicing hand; restoring Default preserves hand, duration and viewing distance. Existing records, four-exercise difficulty snapshots and backups migrate without rewriting stored identifiers. The new identifiers are `tap` and `follow`.

Tap times run from target presentation to release, or from the previous missed attempt to release. They include finger movement and browser input latency. Hits move the target with a minimum screen-space separation; misses let the user retry. An earned level requires **five consecutive centered hits within the displayed deadline**. Default starting pace is 2.5 seconds per hit; Custom allows 1–10 seconds. The threshold is rounded to the same tenth of a second shown in the interface, so the displayed boundary matches scoring exactly. A forgiving hit in the outer halo still earns a point, with a cue to aim closer or respond within the pace limit. Slow/off-center attempts break the qualifying run. An expired target contributes one failed adaptation outcome without fabricating a tap or counting its eventual release twice. Three consecutive failures ease task difficulty, preserving earned levels and points.

Both Default touch exercises start with a 44px dot and 100px halo/hit area; Follow starts at 0.04 cycles/second. Custom values establish the base conditions. A shared performance controller calibrates with larger initial steps when results are clearly easy, then holds or makes small adjustments around a provisional 80–90% success band. Tap success means a centered hit within pace, measured over five outcomes; Follow uses the fraction of each ten active held seconds spent on target. These are game-balancing preferences, not validated clinical thresholds. See [adaptive balancing](docs/adaptive-balancing.md) for sources, exact rules and limits.

Task difficulty is separate from earned levels. Adaptation adjusts dot size, halo, pace, motion speed and jump spacing. A fine adjustment changes size by about 1%, halo/pace by about 0.8% and following speed by about 1.2%. The visible target has a 16 CSS-pixel floor (or a smaller explicitly chosen Custom size), while the hit area retains a 44px minimum diameter and tap pace has a 0.6-second floor. Each tap trial stores presented size, distance, hit tolerance, precision radius, time limit, adaptive load and whether it qualified. A bounded decision history records performance and actual tuning changes; target size does not fluctuate with an unfinished streak.

Follow starts in Ready with no time credit. Grab the visible 44px handle; the cursor is 56px above it. Pointer movement maps one-to-one with the original grab offset, constrained to the working area. Lifting or losing capture pauses immediately and requires a new grab. Manual Pause and background interruption require explicit Resume before another grab is accepted. Stage geometry changes release the gesture, keep results and return to Ready. The cursor is transient; recovered sessions rebuild it and never assume a finger is still held.

Following metrics integrate monotonic active milliseconds between pointer/frame samples, using up to 32ms substeps for target movement. Mean distance is time weighted; off-target holds count in its denominator. Ready, lifted, paused and background intervals do not count. **Ten seconds on target earns a level**, with halfway encouragement at five seconds. Short excursions up to one second are tolerated without counting as on-target time, while longer excursions restart the goal. Five seconds continuously off target eases task difficulty without removing earned levels. An integrated, persisted motion phase and stable path bounds prevent position jumps when speed or difficulty changes. The gentler-motion preference caps adaptive following speed at 0.08 cycles/second; other automatic speed increases are bounded at 0.22 cycles/second unless the user explicitly chose a faster base speed.

Both modes display earned levels, an actual goal meter, best level, session score, calibration/personalized status and recent measured performance. Levels can continue past the former 30-level ceiling; difficulty can hold steady while accomplishments accumulate. Following earns one point per whole second on target. Task difficulty adjusts automatically, with neutral “Pace adjusted” feedback and no Easier button. Pause, End session and Custom base settings remain available. Incomplete qualifying runs and unfinished measurement windows restart after pause, release or reload; completed adaptation evidence, earned levels, points, peak level, achievements and motion phase persist. The tuned pace is saved separately for each exercise, eye, hand and base settings. Time goals, duration and language never increase difficulty. Clearing Statistics preserves tuning unless difficulty reset is selected; Undo and backups retain it.

Session details record starting/ending/highest earned level, level-up count, adaptation phase and recent measured results. The report-card Details retain highest earned level. These are revision-3 touch rules; completed older records retain their original metadata, while resumed exercises adopt current rules with fresh calibration if no tuning exists. Old records receive no invented adaptation history. Earlier touch levels described different rules and should not be treated as equivalent task difficulty.

The challenge header has a 44px speaker/muted-speaker button with a localized accessible label, pressed state and action title. It shares **Settings → Practice sounds**. Sound defaults on for new installations and records without a saved choice; an existing saved mute remains respected. Correct taps, tracking halfway milestones and level-ups have quiet distinct tones; visual feedback remains available with sound off. A shared AudioContext is unlocked from a user gesture and reused for later milestones, with an explicit resume attempt after interruptions.

**Settings → Practice haptics** independently enables brief pulses: 8ms for a correct response, 12ms for a milestone and 16ms for a level. It defaults on and works with sound muted when supported. Failures, unsupported APIs or blocked audio never interrupt practice. [Safari has no standard web vibration API](https://w3c.github.io/vibration/reports/implementation.html), so iPhone Safari cannot reliably provide these haptics; no hidden switch workaround or native wrapper is added. Physical-device audibility and vibration remain unverified. These are game progress and finger-control measurements, not clinical improvement or gaze accuracy. Long-press menus, selection and scrolling are suppressed within the practice canvas.

Further mode ideas and primary research, including **crowded symbols**, **fine alignment** and **Gabor discrimination**, are documented in [the exercise roadmap](docs/exercise-roadmap.md). They are proposals, not additional implemented modes or validated treatment protocols.

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

Visual parity is a product rule: equivalent elements share labels, proportions, spacing, and interaction patterns. Keep summary cards balanced and place longer exercise-specific information behind consistent disclosures. Allow text and expanded content to grow for accessibility. The shared Default/Custom controls use one heading and layout across all exercises.

Exercise choices use compact localized labels, with full names in setup, history and accessible help. Action labels are centered and concise; layouts can reflow instead of clipping or shrinking words. The mobile shell shares horizontal gutters, and grouped controls use consistent spacing and matching heights. Recovery still requires an explicit Resume action even though its label is shorter.

At widths of 64rem and above, desktop uses navigation in the header, a shared 68rem content width, and consistent 1.5rem panel spacing and padding. Practice and routines use equal columns; settings group the schedule beside language, backups, and guidance. Statistics pairs the calendar with a scrollable session list and uses responsive report cards. Phone layouts retain the floating navigation and existing spacing. Text can reflow without fixed card heights.
