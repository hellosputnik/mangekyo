# Attention, search, recall and sequencing

Implemented October 28, 2026 following the [Flash Focus comparison](flash-focus-research.md). These are original experimental activities inspired by broad task mechanics. They do not reproduce a clinical study or establish an amblyopia treatment effect.

## Four modes, nine activities

| Mode | Default | Custom |
| --- | --- | --- |
| Track & find / Theo dõi và tìm | Remember one of three circles and identify it after four seconds of shuffling. | Starting object count, tracking duration, speed, target size, contrast and colors. |
| Find & count / Tìm và đếm | Rotate through orientation counting, matching an orientation, and counting a designated moving letter. | Choose one activity or variety; set initial symbol count, speed, size, contrast and colors. |
| Brief recall / Ghi nhớ nhanh | Rotate through locations, numbers, ordered directions and a brief same/different comparison. | Choose one activity or variety; set initial memory load, display time, recall delay, size, contrast and colors. |
| Number sequence / Chạm số theo thứ tự | Tap six scattered numbers in ascending order. | Starting number count, size, contrast and colors. |

All four use the shared eye choice, duration, viewing-distance setting, Default/Custom sheet, saved setups, Try it, routines, session controls and local history. Stored IDs are `tracking`, `search`, `memory` and `sequence`; translations only affect display text. Existing installations receive these setups and zero starting levels without replacing earlier settings or records.

## Timing and recovery

The engine uses the session's accumulated active milliseconds. No round transition depends on wall-clock time, an interval tick, or time spent away. Cues, presentation, recall delay and response phases stop with the session timer. Response timing begins after the display and delay, so forced viewing time is excluded from answer latency.

Only the answer phase accepts input. Number choices are hidden while a recall stimulus is visible. Spatial selection uses real, labelled 48 CSS pixel buttons over the Canvas, retaining ordinary release/cancel behavior, keyboard access and focus styling. Selected number/location buttons cannot be counted twice. Partial sequences survive pause and reload; only a complete round or an incorrect choice records a trial. A completed round immediately begins the next cue. Previously earned points remain after mistakes.

Round contents, motion seed, start time, difficulty, correct choices, partial selections and replay count are serializable. Reload recovers as interrupted and requires explicit Resume. Replay repeats the same unfinished round from its cue, clears partial selections, retains accumulated active time, and records that assistance with the completed trial. Replayed rounds can earn points but cannot raise difficulty or enter matching-condition personal bests.

Track & find swaps disjoint pairs of circles along opposite smooth arcs. Several pairs can move together. The first two pairings involve every circle; subsequent pairings, arc directions and timing vary by seed, with no long run of one pairing. Answer circles have no visible identity numbers. Accessible labels and tab order follow their final spatial positions, so remembering an original ordinal is not a substitute for tracking. The seed and active timeline determine identity and position; viewport changes rescale geometry while retaining identity. This is an object-selection task. It does not measure gaze, fixation or saccade accuracy.

## Difficulty and feedback

Search, recall and number sequence retain five accurate rounds for the first two difficulty increases, then eight, with the latest three rounds correct. Track & find has its own calibration: three correct rounds are the minimum for an early increase. A median answer time of at most 2.5 seconds allows two steps; slower accurate answers take one. Coarse calibration ends on reaching internal difficulty six or accumulating two unassisted errors. Thereafter eight correct rounds are required, rising to ten at difficulty twelve; the latest three must be correct. Two errors in the latest three rounds at the current difficulty provide support without repeatedly applying the same errors at successive levels. Points remain. These provisional thresholds are game rules, not clinical measures of ability.

Tracking begins with three circles and a four-second display. Faster paced motion and an extra circle at four-step intervals introduce meaningful changes earlier, up to six circles. Tracking duration stays at the chosen base until later levels, rather than lengthening every few early wins. The gentler-motion speed cap is retained. Search adds distractors gradually. Recall increases memory load at six-step intervals and gently reduces exposure, with an 800 ms minimum. Number sequence gradually adds numbers. Stimuli do not continually shrink. Replays and elapsed time do not advance difficulty. All controllers are bounded at 24 internal steps and stay independent of scheduling.

Correct selections use the existing optional soft confirmation sound and supported haptics. Partial correct selections receive affirmation; only completed correct rounds earn points. A level increase uses the existing level tone and a visible localized message. The speaker control shares the global practice-sound setting. Safari vibration support is not assumed.

## Recorded results

Each completed trial stores its activity, item count, memory load, display duration, tracking duration, recall delay, speed, difficulty, replay count and response latency. Session details separate the variants, showing correct rounds, accuracy, median answer time, replayed rounds and the range of presented conditions. Base configuration and viewport remain with the session. Matched-condition comparisons include the task and recorded presentation; pooled game scores are not clinical outcomes.

Backups validate the new settings, levels, round arrays and task metadata. Export/import, statistics reset/undo, routines and daily active-time accounting use the existing infrastructure. Existing fixed-condition check-ins remain available for the original discrimination tasks; these new mixed activities do not add a clinical baseline or an Eye Age score.

The revised tracking task uses `attention-tracking-2` and per-trial `trackingVersion: 2`. Earlier scores retain their original protocol. An unfinished older tracking round restarts from a new cue with replay assistance recorded; accumulated active time and past answers remain, and interruption still requires Resume. Sessions containing both versions use a distinct transition protocol so matching-condition comparisons do not treat them as unchanged tasks.

## Verification

Automated coverage includes all nine activities, deterministic generation, valid answers, cue/input timing, pause/background exclusion, reload with partial selections, repeated taps, replay accounting, progression boundaries, extreme settings, trajectory separation, legacy migration, IndexedDB recovery, validated backup round trips, routine advancement, comparison grouping, and English/Vietnamese controls and reports.

Initial-release validation passed 340 tests and the production build. WebKit checks covered Vietnamese iPhone emulation at 390 × 664 and 844 × 390 CSS pixels, English desktop at 1280 × 900, the Custom activity selector, paired comparison, 48-pixel answer targets, and partial-sequence pause/reload/resume. All nine activities accepted and recorded correct answers after a production offline reload. A landscape layout imbalance found during these checks was corrected; remembered location arrangements stay stable on rotation.

The tracking revision passes 357 automated tests and the strict TypeScript/production build. New checks cover identity-free answer mapping, every object's involvement, simultaneous pairings, varied final order, calibration and error support, replay exclusion, historical-session migration, and seeded simulated capabilities. Native touch input in iPhone WebKit emulation confirmed three correct selections and early calibration, pause/reload/resume without additional time or lost points, hidden identity numbers, six-circle Custom practice, 48-pixel hit areas and portrait/landscape layouts, with no browser errors. These checks do not substitute for real playtesting or physical-device validation.

Physical iPhone testing remains necessary for calls/locking, touch comfort, audio behavior, Home Screen presentation, device text sizes and actual Safari interruptions. A usability pass with Tuyền is still needed to tune pacing and Vietnamese phrasing.
