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
3. Open the Home Screen app. In Settings, wait for **Offline files → Download complete**, then test offline launch before relying on it. If the cache is incomplete, **Download offline files** retries the download while online.
4. An available app update appears as a button outside exercise mode. Finish or save the session before updating.

`localhost` is usable on the development computer. A LAN HTTP address is **not** sufficient for iPhone PWA installation/offline functionality; use HTTPS hosting.

## Language

Mangekyo supports English and Vietnamese. It reads the browser's ordered language preferences, chooses the first supported language, and falls back to English. Dates and numbers follow a matching regional locale when available. **Settings → Language / Ngôn ngữ** can override device language; the choice is saved in IndexedDB and included in backups.

[Open in Vietnamese](https://hellosputnik.github.io/mangekyo/?lang=vi) for a direct Vietnamese entry point, including from an English-language browser. `?lang=en` also works. A manual language change removes the URL override, and `Use device language` restores automatic selection. Older data and backups without a language field remain compatible.

Both language catalogs and the Vietnamese install manifest are cached for offline use. The interface, safety text, response controls, recovery, history, and settings are translated. User-entered routine names and professional measurement notes retain their original text. Stored exercise/eye identifiers and time accounting remain language-independent.

Translation catalogs are in `src/i18n/en.ts` and `src/i18n/vi.ts`; `locale.ts` handles detection/formatting and `react.tsx` supplies the UI context. Tests check locale selection, translation/placeholder parity, regional formatting, stable option values, record preservation, and preference migration.

## What works

- Responsive practice dashboard, eight Canvas exercises, dark training stage, safe-area padding, visual eye selection, glass-style navigation, touch controls, and portrait/landscape layouts. The glass treatment has opaque and reduced-motion accessibility fallbacks.
- Phone portrait setup recommends landscape for pursuit and saccadic practice to provide more horizontal room. Portrait remains available; vertical-only pursuit and discrimination tasks do not show the hint. Rotating keeps session state and never starts an exercise automatically.
- Every exercise has visible **Default / Custom** controls in the same place. Custom opens the shared settings sheet with that exercise's relevant controls. The last exercise, eye, duration and all eight setups survive reloads. Default restores stimulus settings while retaining duration and viewing distance; **Reset setup** restores that exercise's full defaults, with Undo and no change to history or adaptive progress. Sessions, including routine steps, record the selected exercise's configuration.
- **Try it** offers an easy, repeatable example of every exercise. Its timer, answers and gestures stay separate from saved training time, scores and difficulty. Closing it does not start a real session.
- Custom includes a static, live-updating stimulus preview and up to 30 named setups shared across exercises. Setups retain configuration and duration, support replace/remove with Undo, survive reloads and merge through validated backups. Eye selection and adaptive profiles stay separate.
- Fine alignment (Căn chỉnh): judge whether a lower line is offset left or right from an upper line. Default line length is 64 CSS pixels, width 4, gap 16 and starting offset 12. Five-answer blocks reduce the offset after at least 80% correct and relax it below 60%. Line geometry is quantized to Canvas backing pixels, with a one-pixel offset floor; steps skip offsets that would render identically. Actual offset, length, width and gap are saved per answer. Default/Custom, named setups, unscored rehearsal, routines, fixed check-ins and reports share the existing flow. This is an experimental positional-discrimination task, not a calibrated Vernier-acuity test.
- Crowded symbols: identify the opening of the central C-like symbol between two flankers. Default symbol diameter is 44 CSS pixels; spacing adapts after five answers while symbol size remains fixed within a viewport. At least 80% correct tightens the gap by 10%; below 60% relaxes it. Actual presented diameter and gap are saved with every trial. These are experimental task settings.
- Pursuit: a compact choice between **Default** and **Custom**, matching the other exercises. Default gives horizontal, vertical, circular, figure-eight, and smooth wandering paths an equal share of active time within the five-minute session. Custom opens a modal settings sheet for path selection, size, speed, contrast, complexity, colors, and viewing distance. Duration is always adjustable. Pausing/recovery preserves the mix position.
- Saccades: reproducible pseudo-random jumps; custom target size, contrast, exposure, pause, jump distance, colors, and optional acknowledgement. No gaze measurement.
- Tap targets: generous target halos, release-to-confirm touch/mouse input, points and correct runs, hit-rate adaptation, saved target position, and per-trial touch distance/tolerance. Misses retain the target. Hit areas never shrink below 44 CSS pixels; drags and cancelled presses do not count as answers.
- Follow the target: a handle below the cursor leaves the dot visible, with pointer capture and preserved grab offset. The timer runs only during a valid hold. Releasing, cancelling or rotating pauses; explicit interruption recovery arms a fresh grab. Custom path, speed, size, contrast, halo, colors, viewing distance and self-reported hand are recorded. Reports show time on target, time-weighted mean distance and best continuous time on target.
- Visual response tasks: C-like opening, directional pattern, directional triangle, with custom size, contrast, and colors. Multiple accurate answers and response speed determine each size reduction; two mistakes in the last three answers enlarge it. Progression continues beyond the former 12-level cap. Contrast tasks: localized gratings or circles with adjustable size, contrast, and background, within non-overlapping panels on small stages. Contrast retains its independent five-answer accuracy rule. Scheduling never advances difficulty.
- Response exercises show a correct-answer checkmark, +1 point, best correct run, and a small milestone every five consecutive correct answers. Incorrect answers retain earned points. Feedback never blocks the next answer. Scores recover with saved trials and appear on the rest screen and in session details. Practice sound and short haptic pulses default on with independent controls; saved choices remain respected. Rest-end notifications have their own preference.
- 30-minute default personal daily goal, 5-minute default sessions, 1-minute default rests; duration sliders with exact minutes-and-seconds entry. These are scheduling preferences, not treatment doses.
- Monotonic active timer; neutral Pause and one End session action with automatic saving. Resume is emphasized while paused. Routine sessions offer Skip exercise. Reaching the configured duration marks completion; ending sooner keeps valid time and records Stopped early. Background interruption still requires explicit reload recovery.
- A consistent recap shows the exercise, eye, active/planned time and relevant results after completed or partial sessions. Standalone practice offers **Repeat**, which explicitly starts a fresh session with the recorded eye and base settings; adaptive progression remains independent.
- Saved routines with repeated/reordered steps, individual durations, per-routine rests, manual rests, extension, skipping, and early ending.
- Statistics starts with a seven-day summary and an accessible weekly mini chart. Filters are collapsed until requested. A compact rest screen pairs the recap and break status with explicit Repeat/Next and exit actions; break controls remain available behind Break options.
- Statistics: day/week/month activity browsing, date selection, interactive chart filtering, timed session lists, and detailed session sheets. Lifetime active time, sessions, practice days, average session duration, exercise report cards, weighted answer accuracy, median response time, recent results, and totals by eye remain available below. Session details retain exercise-specific configurations; professional measurements stay separate.
- Confirmed statistics reset, optional clearing of professional measurements or exercise difficulty, and a persistent Undo copy that preserves practice added afterward.
- JSON export and validated merge import with a review before saving: added records, adaptive profiles, Undo archives and preference changes. Users can keep current preferences and setups. Existing record IDs win on conflicts. Imported active sessions become interrupted historical records; they do not start automatically. In-progress routines are recovered locally, not resumed from imports. Imports are limited to 20 MB.
- Offline app-shell caching with verified file completeness and a repair download, update prompt, optional wake lock, optional rest-end sound/vibration, and high-contrast/gentler-motion controls. Settings records when the last export was created, with an explicit reminder to check the file actually saved.


## Practice check-ins

Visual discrimination, Contrast discrimination, Crowded symbols and Fine alignment offer an optional **Practice check-in** beneath Start. A check-in has 12 answers at the selected base settings and level zero. It does not adapt, restore adaptive load or update the saved exercise difficulty. Reaching 12 answers completes it; stopping sooner or reaching the ten-minute active-time safety cap retains a partial record. Only actual foreground time counts toward the daily scheduling goal. Pause, interruption recovery and Repeat retain the trial goal; repeating a check-in does not replace the ordinary practice duration with its safety cap.

Statistics charts the latest eight completed check-ins with matching eye, exercise, base configuration, protocol, recorded screen geometry and input metadata. Partial records and changed/missing screen geometry remain in history but do not enter the chart. Accuracy and median response time include all 12 answers, with accessible dated rows below the chart. Check-ins are separately grouped from adaptive sessions. Same recorded settings do not establish physical calibration, an acuity measurement or clinical improvement.

## Storage protection and backups

Settings can request persistent browser storage and shows the actual grant result, with an unsupported/best-effort fallback. This does not prevent manual browser-data deletion. Optional backup reminders default off and appear on rest screens after new practice when the last export or reminder dismissal is at least seven days old. A new export records creation time; users must still verify that their browser saved the file.

## Timing and persistence contract

`ActiveTimer` uses `performance.now()` for running intervals. `visibilitychange` and `pagehide` pause and persist state. Background time is never calculated from wall-clock timestamps. A frame also checks visibility before crediting time. On reload, a saved current session is always interrupted; the user must explicitly resume. Paused and interrupted time never earns credit. End/skip write a session once by ID and retain valid partial time. The timer classifies newly ended sessions as completed only when accumulated active time reaches the configured duration; shorter sessions are stored as stopped early. Repeated ending, pausing, or resuming cannot reopen a terminal timer. Historical records retain their original status.

Foreground time is checkpointed each animation frame and saved approximately every second and at lifecycle transitions. An abrupt OS kill may lose the most recent unsaved second (or more if the storage transaction was delayed); it does not reconstruct missing time. IndexedDB cannot guarantee a transaction completes during process termination. Storage failures produce a visible error and export remains available for the in-memory state.

Each active-time slice stores local calendar date, IANA timezone, and UTC offset. Intervals crossing midnight are split. Historical days retain the date experienced at training time rather than being reassigned after travel. A manual system-clock change near midnight can affect attribution of that short foreground interval, never its monotonic duration.

Rest countdowns also pause when hidden and are persisted; they never auto-start an exercise. Notifications are optional and best effort. Browser audio policies can suppress sounds; iOS vibration is often unavailable.

## Architecture

- `src/engine/model.ts`: typed configuration, records, validation, defaults.
- `src/engine/practice.ts`: independent exercise drafts and Default/Custom selection, separate from scheduling and adaptive levels.
- `src/engine/rehearsal.ts`: isolated, unscored examples using the real exercise engine.
- `src/engine/timer.ts`: React-independent active timing and bounded adaptive progression.
- `src/engine/routines.ts`: routine and break transitions.
- `src/engine/statistics-reset.ts`: scoped report reset and recovery without interrupting an active session.
- `src/exercises/exercise.ts`: common exercise lifecycle and Canvas stimulus renderer.
- `src/exercises/pursuit.ts`: motion presets, active-time path selection, and continuous mixed-path transitions.
- `src/exercises/visual.ts` and `responses.ts`: size progression, per-answer stimulus records, points and correct runs, independent of React and scheduling.
- `src/exercises/touch.ts` and `factory.ts`: shared lifecycle, touch geometry, pointer interaction and active-time sampling, independent of React and browser APIs. `src/analytics/touch.ts` weights following results by actual tracked time.
- `src/persistence/`: IndexedDB snapshots and validated backup merging.
- `src/analytics/`: deduplicated active-time aggregation, calendar periods, recorded time-zone formatting, lifetime reports, and response metrics.
- `src/analytics/comparison.ts`: filters and comparable results under recorded exercise, eye, input, viewport, protocol and task settings. `recap.ts` supplies shared end-of-session summaries.
- `src/pwa/`: service-worker update registration and message-based offline-file verification/repair.
- `src/components/`: focused practice, statistics, record, navigation, and routine views; shared eye, duration, stepper, and switch controls in `controls/`.
- `src/main.tsx`: application coordination, session lifecycle, and settings.

Canvas backing resolution uses device pixel ratio (capped at 3 for memory use). Target settings are CSS pixels, not millimeters or calibrated visual angles. Viewing distance is recorded metadata, not an automatic calibration. Native adapters, eye tracking, cloud sync, and physical display calibration are intentionally absent.

## Statistics and reset

The Statistics tab (Thống kê in Vietnamese) starts with calendar activity inspired by [Apple Health's period selection and chart details](https://support.apple.com/guide/iphone/view-your-health-data-iphe3d379c32/ios). Choose Day, Week, or Month, move between periods, or select a date. Tap/drag the chart to filter sessions by date or start hour; Show all clears the selection. Weeks follow the selected regional locale, including Monday-first Vietnamese weeks. Month navigation respects calendar lengths and leap years.

Open a session row for start/end date, recorded time zone and UTC offset, active/planned time, eye, status, answer results, best correct run, and full settings. New visual responses include the range of presented target sizes. Session lists show ten entries at a time with Show more; the full historical list remains available too. A session spanning midnight appears on each affected day with that day's active-time credit.

The chart uses positive-time local calendar slices; duplicate session IDs count once and a current session takes precedence. Partial sessions retain valid time. Day view groups each day's credited time by the session's **start hour**, not exact minute-by-minute activity: saved slices do not contain individual interval timestamps. Time continuing from an earlier day's session is reported separately. Start/end clocks use the recorded IANA time zone (or saved UTC offset), while legacy records without either explicitly use the device time zone. Travel does not move saved daily credit to a different date. Charts scale to their data, independently of the daily goal.

The lifetime report and balanced exercise cards remain below calendar activity. Filters above the calendar apply to activity, totals, eye summaries, cards and history. Select an exercise, eye and recorded-settings group to inspect matching practice. Export, Reset and professionally recorded measurements retain their global scope, stated beside the filters.

Comparable bests require recorded, unchanged viewport geometry and the same base conditions, eye, exercise protocol and input method. Response bests compare at least five answers within a session at the latest actual presented difficulty/size; following compares complete ten-second windows at the latest adaptive load. Easier presentations are not pooled into the result. Legacy records remain in totals without inventing missing geometry. CSS pixels, self-reported distance and matching viewport metadata do not establish calibrated physical display conditions or clinical comparability.

Exercise report cards aggregate their recorded eyes and settings. Response accuracy is correct answers divided by all answers for that exercise, rather than an average of session percentages. Median response time includes correct and incorrect human answers, excluding timed-out targets. The six latest response sessions show their individual accuracy; their conditions can differ. Pursuit and saccades report time and sessions without assigning a gaze score. Exercise scores are training performance, separate from eyesight or clinical outcomes.

All exercise cards share a four-metric summary, last-practice date, and Details disclosure. Tracking cards include practice days and average session duration; response cards include accuracy and median response time. Card practice durations use minutes:seconds. Completion counts, response breakdowns, recent charts, and recorded levels are available in Details.

**Manage statistics → Reset statistics** opens a confirmation. It clears saved session history and starts a fresh report. Professional measurements and exercise difficulty can be cleared independently with explicit switches; routines and preferences stay. Reset and Undo are blocked while an exercise or routine is in progress, including interrupted recovery. Cancel receives initial focus, and confirmation actions remain visible while the body scrolls on a short landscape screen.

Undo retains one previous copy locally through reloads. It merges the old records with new practice and measurements without duplicating IDs. If difficulty was reset, Undo restores it only for exercises with no new session since reset. Another reset replaces the previous Undo copy. JSON exports include this copy; validated imports keep it separate from current statistics until Undo is selected.

Report previews in [the design audit](docs/apple-design-audit.md) use synthetic example records, not a person's training or clinical results.

## Variable pursuit pace

Smooth pursuit keeps its existing steady timing under Default. In **Custom → Vary speed**, enable a fresh random pace for each session and choose 10–60% variation (35% initially) around the chosen base rate. The chosen path and the existing mixed-path sequence stay the same. Speed transitions smoothly toward new random values over random 3–7-second intervals. This varies the rate along the path; actual on-screen velocity also depends on the path and stage geometry.

The engine integrates the speed curve from accumulated active time rather than multiplying elapsed time by the current speed. The stored per-session seed restores the same position and pace after pause/reload or backup recovery. Repeat and a new routine step receive fresh sequences, while named setups retain the variation preference. Gentler motion caps the rate at 0.08 cycles/second, including Repeat; the ordinary instantaneous cap is 1. Variable sessions record their base rate, variation and sequence seed under a separate protocol. These are experimental task variations, not evidence of a clinical benefit.

## Visual size progression and feedback

Visual discrimination retains its stationary stimulus, size curve and answer controls. A shrink step now needs at least five correct answers at the current size, at least four correct among the latest five answers and a correct latest answer. Median latency of the latest five correct answers selects the evidence requirement: up to 1.8s needs five correct and eight active seconds; up to 3.5s needs eight correct and fourteen active seconds; slower answers need ten correct and twenty active seconds. Slower accurate users can still progress. Each earned step reduces nominal radius by 6%. One mistake holds size; two mistakes among the last three at that size step back three levels. The nominal four-backing-pixel diameter floor and one-pixel minimum stroke remain rendering limits, not acuity thresholds.

Difficulty is saved per exercise and clamped to the current stage on rotation. New ordinary visual sessions start no harder than level 12 for a comfortable warm-up; an interrupted session retains its exact size and accumulated answer evidence. Each trial records its presented CSS-pixel diameter. The new adaptive protocol is kept separate from older scores; fixed-condition check-ins retain their existing protocol and comparisons. No historical sizes are invented. Contrast progression is unchanged. Time goals and completed sessions never advance difficulty.

One correct answer earns one point. Best run means consecutive correct answers **within that session**, not consecutive days. No points are removed for errors or missed days. Scores are practice results, never evidence of improving eyesight. Visual confirmation always works; optional sound/vibration is best effort and may be unavailable under Safari policies. Reload restores points from recorded trials without replaying feedback.

## Touch coordination

Tap targets and Follow the target use the same Default/Custom controls, duration settings, eye selection, routines, rest flow, local history and calendar as the other exercises. Custom records the practicing hand; restoring Default preserves hand, duration and viewing distance. Existing records, four-exercise difficulty snapshots and backups migrate without rewriting stored identifiers. The new identifiers are `tap` and `follow`.

Tap times run from target presentation to release, including finger movement and browser input latency. By default, a target moves after a hit or when its 2.5-second starting lifetime expires. The ring shows remaining active time. Custom allows 1–10 seconds or an untimed target that stays until hit. Misses allow a retry without restarting the lifetime. Each deadline is frozen when its target appears, survives pause/reload and never counts background time. A timeout records one failed attempt and one adaptation outcome, then creates one new target; animation stalls do not produce catch-up bursts, and releases belonging to an expired target are cancelled. Timeouts affect hit rate but are excluded from median human tap latency. Five consecutive centered hits earn a level, within the deadline when timed. Outer-halo hits still earn a point. Repeated unsuccessful outcomes ease difficulty while preserving earned levels and points.

Both Default touch exercises start with a 44px dot and 100px halo/hit area; Follow starts at 0.04 cycles/second. Custom values establish the base conditions. A shared performance controller calibrates with larger initial steps when results are clearly easy, then holds or makes small adjustments around a provisional 80–90% success band. Tap success means a centered hit within pace, measured over five outcomes; Follow uses the fraction of each ten active held seconds spent on target. These are game-balancing preferences, not validated clinical thresholds. See [adaptive balancing](docs/adaptive-balancing.md) for sources, exact rules and limits.

Task difficulty is separate from earned levels. Tap dot size scales by `0.92^load` with an 8 CSS-pixel floor; Follow retains `0.96^load` and a 16px floor. Both retain a 44px minimum touch area. Tap lifetime scales more gently by `0.985^load`, rounded to the displayed tenth with a 0.8s floor. Default lifetime remains about 1.4s even at the maximum load. Follow motion and halo balancing are unchanged. Each tap outcome records its presented size, tolerance, precision radius, load and any deadline; actual taps also record distance, while expired targets carry a timeout flag. Size changes follow completed performance windows, not unfinished streaks.

Follow starts in Ready with no time credit. Grab the visible 44px handle; the cursor is 56px above it. Pointer movement maps one-to-one with the original grab offset, constrained to the working area. Lifting or losing capture pauses immediately and requires a new grab. Manual Pause and background interruption require explicit Resume before another grab is accepted. Stage geometry changes release the gesture, keep results and return to Ready. The cursor is transient; recovered sessions rebuild it and never assume a finger is still held.

Following metrics integrate monotonic active milliseconds between pointer/frame samples, using up to 32ms substeps for target movement. Mean distance is time weighted; off-target holds count in its denominator. Ready, lifted, paused and background intervals do not count. **Ten seconds on target earns a level**, with halfway encouragement at five seconds. Short excursions up to one second are tolerated without counting as on-target time, while longer excursions restart the goal. Five seconds continuously off target eases task difficulty without removing earned levels. An integrated, persisted motion phase and stable path bounds prevent position jumps when speed or difficulty changes. The gentler-motion preference caps adaptive following speed at 0.08 cycles/second; other automatic speed increases are bounded at 0.22 cycles/second unless the user explicitly chose a faster base speed.

Both modes display earned levels, an actual goal meter, best level, session score, calibration/personalized status and recent measured performance. Levels can continue past the former 30-level ceiling; difficulty can hold steady while accomplishments accumulate. Following earns one point per whole second on target. Task difficulty adjusts automatically, with neutral “Pace adjusted” feedback and no Easier button. Pause, End session and Custom base settings remain available. Incomplete qualifying runs and unfinished measurement windows restart after pause, release or reload; completed adaptation evidence, earned levels, points, peak level, achievements and motion phase persist. The tuned pace is saved separately for each exercise, eye, hand and base settings. Time goals, duration and language never increase difficulty. Clearing Statistics preserves tuning unless difficulty reset is selected; Undo and backups retain it.

Session details record starting/ending/highest earned level, level-up count, adaptation phase and recent measured results. Tap now uses the `tap-paced-4` protocol; Follow retains `touch-balance-3`. Timed and untimed tap tuning profiles stay separate, and earlier tap profiles recalibrate under the new size/lifetime rules without removing earned levels. Older records retain their metadata and receive no invented adaptation history. Tap details distinguish timeouts from human responses.

The challenge header has a 44px speaker/muted-speaker button with a localized accessible label, pressed state and action title. It shares **Settings → Practice sounds**. Sound defaults on for new installations and records without a saved choice; an existing saved mute remains respected. Correct taps, tracking halfway milestones and level-ups have quiet distinct tones; visual feedback remains available with sound off. A shared AudioContext is unlocked from a user gesture and reused for later milestones, with an explicit resume attempt after interruptions.

**Settings → Practice haptics** independently enables brief pulses: 8ms for a correct response, 12ms for a milestone and 16ms for a level. It defaults on and works with sound muted when supported. Failures, unsupported APIs or blocked audio never interrupt practice. [Safari has no standard web vibration API](https://w3c.github.io/vibration/reports/implementation.html), so iPhone Safari cannot reliably provide these haptics; no hidden switch workaround or native wrapper is added. Physical-device audibility and vibration remain unverified. These are game progress and finger-control measurements, not clinical improvement or gaze accuracy. Long-press menus, selection and scrolling are suppressed within the practice canvas.

Further mode ideas and primary research, including **crowded symbols**, **fine alignment** and **Gabor discrimination**, are documented in [the exercise roadmap](docs/exercise-roadmap.md). They are proposals, not additional implemented modes or validated treatment protocols.

## Validation and physical-device checklist

Automated tests cover monotonic timing, pause/resume/background exclusion, duration caps, partial and abandoned sessions, recovery, local midnight boundaries, duplicate accounting, routine advancement, break transitions, invalid configuration, adaptive boundaries, exercise termination, IndexedDB round trips, ordered snapshot writes, remembered setups, isolated rehearsals, common recaps, matched presentation comparisons, backup previews, contrast ratios and offline-file verification/repair.

Desktop browser checks cover start, pause, reload recovery, completion-to-rest transitions, update activation, and an offline reload plus response exercise with the production server stopped. The offline test caught and fixed static-asset cache misses caused by `Vary: Origin`; cached same-origin assets now ignore Vary during lookup. A physical iPhone is still required to verify:

- Safari and installed Home Screen launches, airplane-mode cold starts, and update activation.
- Rotation during an active session, dynamic browser bars, safe areas, zoom accessibility, and both small and large iPhone displays.
- Lock/unlock, incoming calls, app switching, low-power mode, force quit, storage eviction, and quota failure.
- Wake lock, optional audio and vibration, and performance at 60/120Hz.
- Daylight saving changes, travel across timezones, and manual clock changes on a device.
- VoiceOver reading/focus order, native text resizing and software-keyboard behavior. See the [accessibility review](docs/accessibility-review.md) and [Vietnamese iPhone walkthrough](docs/iphone-walkthrough.vi.md). These are verification guides, not a claim of WCAG conformance or observed intended-user results.

## Limitations and safety

Not clinically validated. No claim of curing amblyopia, improving acuity, or measuring eye movements. Display contrast and target size are uncalibrated. Improved task scores may reflect familiarity and do not establish improved eyesight. Follow qualified eye-care guidance for patching and frequency. Practice seated with comfortable brightness, never while driving/walking or doing hazardous tasks. Stop immediately if uncomfortable.

Browser storage can be cleared or evicted. Export backups regularly. Writes use an atomic IndexedDB revision check: a stale updated tab cannot replace a newer snapshot. BroadcastChannel pauses stale tabs promptly when supported; the transaction check also works without it. A conflict offers an export of that tab’s unsaved copy and an explicit reload. Finish and close older app versions before updating: old clients do not participate in the revision protocol. No native apps, accounts, cloud synchronization, gaze tracking, or clinical testing have been implemented.

Setup choices are saved locally and included in exports; changing them never rewrites recorded sessions. A started session stores its own complete configuration for recovery and history. Rehearsals are deliberately unsaved. Export timestamps record creation, not a verified file-system write. Offline readiness is checked against the current worker's complete asset list; it cannot prevent future browser storage eviction.

## Design skill

The reusable Codex `$apple-design` port is included at `tools/skills/apple-design/`, with the original MIT license and upstream reference. It is installed for this user at `~/.agents/skills/apple-design`. See [the applied design audit](docs/apple-design-audit.md) for findings, changes, and verification limits.

Visual parity is a product rule: equivalent elements share labels, proportions, spacing, and interaction patterns. Keep summary cards balanced and place longer exercise-specific information behind consistent disclosures. Allow text and expanded content to grow for accessibility. The shared Default/Custom controls use one heading and layout across all exercises.

Exercise choices use compact localized labels, with full names in setup, history and accessible help. Action labels are centered and concise; layouts can reflow instead of clipping or shrinking words. The mobile shell shares horizontal gutters, and grouped controls use consistent spacing and matching heights. Recovery still requires an explicit Resume action even though its label is shorter.

At widths of 64rem and above, desktop uses navigation in the header, a shared 68rem content width, and consistent 1.5rem panel spacing and padding. Practice and routines use equal columns; settings group the schedule beside language, backups, and guidance. Statistics pairs the calendar with a scrollable session list and uses responsive report cards. Phone layouts retain the floating navigation and existing spacing. Text can reflow without fixed card heights.

Additional primary-source task research is recorded in [the research inventory](docs/amblyopia-task-research.md), distinguishing training tasks from outcome assessments and ordinary phone adaptations from eye-separated protocols.
