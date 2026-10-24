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

## Static HTTPS deployment

Deploy the contents of `dist/` to the root of an HTTPS origin. For Cloudflare Pages, connect this repository, select no framework preset, set build command `npm ci && npm run build`, and output directory `dist`. Netlify uses the same command and directory. No environment variables or server functions are needed. For manual hosting, upload all of `dist`, including `sw.js`, icons, manifest, and `assets/`.

Use `Cache-Control: no-cache` for `index.html`, `sw.js`, and `manifest.webmanifest`; fingerprinted files in `assets/` can use immutable caching. Hosting below a subdirectory requires configuring Vite's `base` and rebuilding; root hosting is the supported default. Do not serve this PWA from a cross-origin iframe or a host that blocks service workers.

### iPhone installation

1. Open the HTTPS URL in Safari while online and allow the first load to finish.
2. Share → Add to Home Screen → Add.
3. Open the Home Screen app, then test offline launch before relying on it.
4. An available app update appears as a button outside exercise mode. Finish or save the session before updating.

`localhost` is usable on the development computer. A LAN HTTP address is **not** sufficient for iPhone PWA installation/offline functionality; use HTTPS hosting.

## What works

- Responsive practice dashboard, four Canvas exercises, dark training stage, safe-area padding, touch controls, portrait/landscape layouts.
- Pursuit: horizontal, vertical, circle, figure-eight, smooth wandering; adjustable size, speed, contrast, complexity, colors, duration, and self-reported viewing distance.
- Saccades: reproducible pseudo-random jumps, exposure/pause/distance controls, optional acknowledgement. No gaze measurement.
- Visual response tasks: C-like opening, directional pattern, directional triangle; contrast tasks: localized gratings or circles. Four touch answers. Every five responses, accuracy adjusts an independent exercise level within bounds. Scheduling never advances difficulty.
- 30-minute default personal daily goal, 5-minute default sessions, 1-minute default rests; preset and custom durations. These are scheduling preferences, not treatment doses.
- Monotonic active timer; pause, resume, save early, skip/abandon, background interruption, explicit reload recovery.
- Saved routines with repeated/reordered steps, individual durations, per-routine rests, manual rests, extension, skipping, and early ending.
- IndexedDB history, daily/weekly totals, eye/exercise breakdowns, recent accuracy/difficulty charts, and separately labeled professional measurements.
- JSON export and validated merge import. Existing record IDs win on conflicts. Imported active sessions become interrupted historical records; they do not start automatically. Schedule preferences are restored; in-progress routines are recovered locally, not resumed from imports.
- Offline app-shell caching, update prompt, optional wake lock, optional rest-end sound/vibration, and high-contrast/gentler-motion controls.

## Timing and persistence contract

`ActiveTimer` uses `performance.now()` for running intervals. `visibilitychange` and `pagehide` pause and persist state. Background time is never calculated from wall-clock timestamps. A frame also checks visibility before crediting time. On reload, a saved current session is always interrupted; the user must explicitly resume. Paused and interrupted time never earns credit. Finish/skip write a session once by ID; both retain valid partial time.

Foreground time is checkpointed each animation frame and saved approximately every second and at lifecycle transitions. An abrupt OS kill may lose the most recent unsaved second (or more if the storage transaction was delayed); it does not reconstruct missing time. IndexedDB cannot guarantee a transaction completes during process termination. Storage failures produce a visible error and export remains available for the in-memory state.

Each active-time slice stores local calendar date, IANA timezone, and UTC offset. Intervals crossing midnight are split. Historical days retain the date experienced at training time rather than being reassigned after travel. A manual system-clock change near midnight can affect attribution of that short foreground interval, never its monotonic duration.

Rest countdowns also pause when hidden and are persisted; they never auto-start an exercise. Notifications are optional and best effort. Browser audio policies can suppress sounds; iOS vibration is often unavailable.

## Architecture

- `src/engine/model.ts`: typed configuration, records, validation, defaults.
- `src/engine/timer.ts`: React-independent active timing and bounded adaptive progression.
- `src/engine/routines.ts`: routine and break transitions.
- `src/exercises/exercise.ts`: common exercise lifecycle and Canvas stimulus renderer.
- `src/persistence/`: IndexedDB snapshots and validated backup merging.
- `src/analytics/`: deduplicated time aggregation and response metrics.
- `src/components/Progress.tsx`: historical and professional measurement views.
- `src/main.tsx`: application coordination, session lifecycle, controls, settings, and routines.

Canvas backing resolution uses device pixel ratio (capped at 3 for memory use). Target settings are CSS pixels, not millimeters or calibrated visual angles. Viewing distance is recorded metadata, not an automatic calibration. Native adapters, eye tracking, cloud sync, and physical display calibration are intentionally absent.

## Validation and physical-device checklist

Automated tests cover monotonic timing, pause/resume/background exclusion, duration caps, partial and abandoned sessions, recovery, local midnight boundaries, duplicate accounting, routine advancement, break transitions, invalid configuration, adaptive boundaries, exercise termination, IndexedDB round trips, snapshot isolation, and backup validation.

Desktop browser checks cover start, pause, reload recovery and completion-to-rest transitions. A physical iPhone is still required to verify:

- Safari and installed Home Screen launches, airplane-mode cold starts, and update activation.
- Rotation during an active session, dynamic browser bars, safe areas, zoom accessibility, and both small and large iPhone displays.
- Lock/unlock, incoming calls, app switching, low-power mode, force quit, storage eviction, and quota failure.
- Wake lock, optional audio and vibration, and performance at 60/120Hz.
- Daylight saving changes, travel across timezones, and manual clock changes on a device.

## Limitations and safety

Not clinically validated. No claim of curing amblyopia, improving acuity, or measuring eye movements. Display contrast and target size are uncalibrated. Improved task scores may reflect familiarity and do not establish improved eyesight. Follow qualified eye-care guidance for patching and frequency. Practice seated with comfortable brightness, never while driving/walking or doing hazardous tasks. Stop immediately if uncomfortable.

Browser storage can be cleared or evicted. Export backups regularly. Do not train simultaneously in multiple tabs: the initial version uses a single local state snapshot and does not arbitrate concurrent writers. No native apps, accounts, cloud synchronization, gaze tracking, or clinical testing have been implemented.
