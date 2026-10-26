# Apple Design audit and implementation

Applied the Codex port of Emil Kowalski's [apple-design](https://github.com/emilkowalski/skills/tree/main/skills/apple-design), identified by [Charlie Hills's article](https://charliehills.substack.com/p/apples-design-rules-as-a-claude-skill). Its original instructions and MIT license are preserved in `tools/skills/apple-design/`; the installed Codex entrypoint is `~/.agents/skills/apple-design/SKILL.md`. The port adds Codex metadata and a concrete review/fix workflow, replaces the greeting-only startup rule with doing the work, and keeps native release/cancel behavior and functional Canvas motion.

## Interface review — October 25, 2026

Reviewed setup, training, rest, progress, routines, and settings in English and Vietnamese. The crimson identity remains. [Apple's materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials) informed floating navigation with readable content and accessibility fallbacks. This web implementation approximates glass with CSS; it does not use Apple's native Liquid Glass APIs. [Apple's layout guidance](https://developer.apple.com/design/human-interface-guidelines/layout) informed hierarchy and responsive placement.

| Finding | Implemented change |
| --- | --- |
| Eye selection was hidden in a menu without a visual reference. | Native left/right/both radio options with diagrams, selected checks, and a clearly labeled user viewpoint. Shared by setup, routines, and professional measurements. Selection remains self-reported. |
| Duration menus made simple changes cumbersome. | Native slider and exact minutes/seconds entry. Errors preserve the valid setting and prevent invalid starts/saves. Longer exact values extend the slider range. |
| Oversized exercise cards pushed setup down the page. | Compact two-by-two chooser, one selected description, and focused setup. Desktop puts setup beside choices; mobile retains a single reading order. |
| Pursuit setup was too large and complicated. | Two compact options: Default (mixed) and Custom. Custom opens a modal settings sheet; path choice and detailed controls live there. The default five-minute mix still allocates roughly a minute per path. |
| Changing a mixed path could cause a target jump. | A React-independent motion function blends position and velocity at joins. The mix is deterministic from active time, preserving its position across recovery. Custom can also use Mixed. |
| Navigation resembled a solid content panel. | Floating glass-style capsule, consistent icons/labels, moving selection, safe-area offsets, and immediate press feedback. Opaque fallbacks for reduced transparency, increased contrast, and missing backdrop support. Reduced motion removes transitions. |
| Directional answers appeared in a flat row without a clear question. | Explicit questions, spatial direction pad, matching quadrant layout for contrast, and disabled responses while paused. |
| Landscape exercises crowded controls. | Full-height training layout. Short landscape response exercises place stimulus beside answers and keep a full-width control row. Resume is available directly in the paused control row. |
| Routine editing only moved a step upward. | Up/down, repeat, remove, exact duration summaries, and visible invalid collapsed summaries. Structural changes reset transient editors so drafts cannot move to another exercise. |
| Saved routines lacked removal recovery and save feedback. | Delete with Undo, saved feedback, accurate active-duration summaries, eye selection before Start, and hidden countdown settings during manual rest. |
| Settings coerced incomplete numbers and used small checkbox affordances. | Validated goal/reminder entry with steppers; native checkbox switches with whole-row targets. Shared duration controls throughout. |
| Empty charts looked unfinished and optional measurement entry dominated. | Helpful empty text, actionable empty history, measurement disclosure, and announced save feedback. |
| Loading and storage failure offered little recovery. | Loading feedback; retry or export on errors. Backup selection resets for retry. Navigation clears stale page feedback and starts at the top. |

Canvas retains display-timed drawing. Timer labels refresh at most ten times per second, paused sessions draw only on entry/resize, and no training animation loop runs without a session. Scheduling and adaptive difficulty remain independent. Presets provide task variation without a claim of clinical benefit.

## Verification

- `npm test`: **82 tests pass**, including timing, recovery, persistence, progression, translations, scoped offline caches, and controls. New coverage includes exact duration limits, blank/malformed drafts, zero-length breaks, eye/range/navigation semantics, preset selection, equal mixed-path allocation at several durations, continuous position/velocity, bounded trajectories, pause/recovery, and legacy/mixed backup compatibility.
- `npm run build`: strict TypeScript and production Vite/service-worker generation pass.
- Browser checks at **320×740**, **390×844**, **844×390**, and **1280×900**. No horizontal overflow in tested settings, setup, Custom controls, or training screens. These are browser viewport checks, not physical Safari tests.
- At 390px, setup buttons, disclosures, eye options, range input, and navigation measured at least 44px in each dimension. All motion presets also meet this at 320px. Switch tracks are smaller visually; their entire label rows are clickable and at least 62px high.
- Exact 2:35 committed as 155 seconds. Invalid 0:01 showed a localized error and disabled Begin. Editing to 1:10 and tapping Begin directly used the new 70-second setting.
- Routine checks covered invalid collapsed summaries, downward reordering with exact duration retained, repetition, manual rests, saving, deletion, and Undo.
- At 844×390, discrimination answers matched their positions; control-row buttons remained visible and 44px high. The stimulus retained about 240px height. Responses recorded trials; pausing disabled answers.
- Holding Begin produced immediate inset press feedback. Moving away before release did not start a session.
- Emulated reduced transparency/increased contrast produced opaque navigation without blur. Reduced motion gave a zero-duration selection transition. Resetting preferences restored the glass backdrop.
- A shortened browser session visibly cycled through all five mixed paths and paused on wandering. Automated tests additionally cover all five paths across the default 300 seconds. Custom exposed every pursuit setting; changing an individual preset restored defaults, and Custom inherited that selected path.
- Served the production build at `/mangekyo/`, stopped its local server after caching, and reloaded successfully. Pursuit start/pause still worked; another reload required interrupted-session confirmation. This offline check preceded the final motion-preset changes; the service-worker logic remains unchanged.
- Previews: [phone presets](screenshots/iphone-presets.jpg), [phone controls](screenshots/iphone-controls.jpg), [desktop setup](screenshots/desktop-controls.jpg).

## Remaining device checks

Physical iPhone Safari and Home Screen testing remain necessary for safe areas, the software keyboard, Dynamic Type, VoiceOver, interruptions, offline launch, and installation/update behavior. macOS Safari also needs a device pass. Browser emulation does not establish physical-device performance, input latency, or clinical effectiveness.

## Follow-up: compact modes and Custom sheet

The user's Safari preview showed the prior auto-sized card grid expanding far beyond its intended 72/88px minimum heights. That was unintended. Earlier Chromium viewport checks missed it, and direct native Safari inspection could not be completed in this pass. The exact Safari sizing calculation remains unverified.

Replaced the entire card composition with two text buttons, **Default (mixed)** and **Custom**, in one content-sized row. The row no longer depends on intrinsic SVG sizing or native flex-button layout. Default preserves the existing five-path sequence; stored `Mixed` identifiers remain compatible. Removed the redundant subtitle and long explanatory copy.

Custom opens a native modal dialog styled as a bottom sheet on mobile. It contains path selection and all pursuit parameters. Done, Escape, and tapping the backdrop dismiss it. The page behind it is inert, background scrolling is locked while open, and focus returns to Custom. Edits remain when reopening; selecting Default restores preset parameters. The header stays visible while scrolling, with safe-area padding around its controls.

Browser checks show a **48px-high mode row** for English at 320px/390px and Vietnamese at 390px. At 320px the longer Vietnamese label wraps and the row grows to about 61px, with no horizontal overflow. Verified opening, changing the path/target size, Done, reopening with those changes retained, Escape, focus return, and restoration of background scrolling. The existing timer/mixed-motion tests remain unchanged. These browser checks do not establish a physical Safari pass.

Updated previews: [compact setup](screenshots/iphone-presets-compact.jpg), [Custom settings](screenshots/iphone-custom-settings.jpg), [Vietnamese setup](screenshots/iphone-presets.jpg).

## Follow-up: exercise-name wrapping

The exercise tiles combined a horizontal icon, reserved checkmark padding, and `overflow-wrap: anywhere`. That left too little text width and allowed the final `n` in “discrimination” to wrap alone. Removed arbitrary word breaking and moved the icons above the labels so each title uses the available card width. Full exercise names and stored identifiers remain unchanged. The card buttons now use a block shell with an internal layout grid, and the saccade mark no longer wraps its dots.

Browser checks measured every word's text range to ensure it occupied one line and stayed inside its card: English at widths 320, 350, 375, 390, 430, 844, and 1280; Vietnamese at 320, 390, and 430. No broken words or horizontal document overflow were observed. Selecting an exercise still updates its pressed state. The existing 82 tests and production build pass. These remain Chromium browser checks; no direct Safari pass is claimed.

Previews: [English exercise choices](screenshots/iphone-exercises-en.jpg), [Vietnamese exercise choices](screenshots/iphone-exercises-vi.jpg).

## Follow-up: exercise artwork

Replaced the font-character artwork with a typed SVG set in `src/components/ExerciseArtwork.tsx`. Saccadic targets use two focal targets and a diagonal jump arrow; contrast discrimination uses a split-tone circle. Pursuit and visual discrimination retain their infinity/C motifs with matching stroke, color, and proportions. Icons occupy fixed square slots and are decorative to assistive technology; the full button labels remain the accessible names. Exercise stimuli and settings are unchanged.

Verified equal icon dimensions at 320px and 390px, no horizontal overflow, and preserved whole-word labels. All 82 tests and the production build pass. [Updated phone artwork](screenshots/iphone-exercise-icons.jpg).

## Follow-up: session actions and completion status

Previously, Finish & save and End early both retained time but allowed the same short session to be labeled completed or stopped early based on button choice. Removed that ambiguous distinction. A running standalone exercise now has two secondary controls: Pause and End session. The routine equivalent is Pause and Skip exercise, followed by the existing rest/next-step screen, where the routine can be ended. Pause has no primary color while running. The single Resume control receives emphasis while paused, and interrupted sessions explicitly say Confirm & resume. Removed the duplicate resume button from the pause overlay.

Saving remains automatic at checkpoints and transitions. New completion status follows active duration: reaching the target is completed; ending sooner is stopped early (the existing stored `abandoned` identifier). Both retain valid active time. Terminal timers are idempotent and cannot be reopened by pause/resume. Existing history is not relabeled.

All **91 tests** pass, including boundary classification, ending while paused/interrupted without counting time away, terminal idempotency, localized action labels, routine skip wording, and conditional primary emphasis. Browser checks verified a three-second early session retained 0:03 in history with zero completed sessions; a full ten-second session recorded 0:10 and one completion. Skipping a routine step transitioned to rest with the next exercise and End routine available. Reloading showed one explicit confirmation control. At 320px the Vietnamese recovery controls remained visible with 65px-high targets. Normal running controls at 390px measured at least 44px high, both with neutral backgrounds.

[Updated running session controls](screenshots/iphone-session-controls.jpg). Direct Safari/physical iPhone validation remains outstanding.

## Follow-up: landscape recommendation

Added a small phone-portrait hint near Begin for smooth pursuit and saccadic targets, plus matching guidance for saved routines and the next routine step during rest. Landscape gives these tasks more horizontal room; the hint makes no health or performance claim. Vertical-only pursuit and discrimination setup omit it. The hint disappears in landscape, and portrait remains usable without another confirmation screen. There is no orientation lock, automatic start on rotation, or timer change. English and Vietnamese copy remain in the language catalogs.

Browser checks at 320×740 and 390×844 showed readable copy without horizontal overflow. At 844×390 the hint was hidden and setup duration stayed at five minutes. Starting in portrait and rotating retained the active saccade session; rotating back while paused kept active time unchanged. Both session controls stayed visible in landscape. Verified the vertical-only and visual-discrimination exceptions and the saved-routine hint. All **91 tests**, the production build, and whitespace checks pass. Physical iPhone Safari rotation and browser-bar behavior still need device verification.

[Portrait setup with landscape guidance](screenshots/iphone-landscape-hint.jpg).

## Follow-up: customization across all exercises

The previous interface exposed pursuit customization above setup but put the other exercises' settings behind a separate disclosure below Begin. This made those settings look unavailable. All four exercises now use the same visible Default/Custom row and native modal sheet. The sheet names the selected exercise, places task selection first where relevant, and shows only applicable controls. Removed the old below-Begin disclosure. Default (mixed) remains the pursuit label; the others say Default. English and Vietnamese are translated together.

Saccades expose target size, contrast, exposure, pause, jump distance, viewing distance, colors, and optional acknowledgement. Visual tasks expose the opening/orientation/shape choice, pattern size, contrast, distance, and colors. Contrast exposes grating/shape, pattern size, contrast, distance, and background, with the display-calibration limitation nearby. Each exercise owns an independent draft and duration; resetting one preserves its schedule and viewing distance and does not affect other exercises or adaptive levels. Routine starts now read the step's exercise configuration. Drafts remain in memory until reload; started sessions retain full configuration in IndexedDB as before.

Corrected a functional gap behind contrast customization: gratings had a fixed size and circles stopped growing at 30px. Both now follow the size parameter, bounded to keep the four panels inside the stage without overlap. Default rendering dimensions are preserved. History summaries now show saccade timing/jump settings or the chosen response task instead of unrelated pursuit path/speed labels.

All **102 tests**, the strict production build, and whitespace checks pass. New tests cover independent settings, default resets without schedule changes, immutable configurations, contrast scaling and narrow-stage bounds, and relevant history labels. Browser checks at 320×740, 390×844, and 844×390 verified applicable fields, independent settings when switching, a retained 2:35 duration after Default with other exercises still at 5:00, focus return on Done/Escape, restored background scrolling, no horizontal overflow, and at least 44px input/select/Done targets (the switch retains its larger clickable label). Custom saccade acknowledgement appeared during training; its 120px setting was recorded, while a routine's pursuit step retained 28px. A custom visual Shape session used directional answers. A maximum-size contrast grating fit in landscape with answer/pause/end controls visible and saved its task/size in history. These are Chromium browser checks; direct Safari and physical iPhone validation remain outstanding.

Previews: [contrast settings](screenshots/iphone-contrast-customization.jpg), [Vietnamese saccade settings](screenshots/iphone-customization-vi.jpg).

## Follow-up: lifetime Statistics and report cards

Replaced Progress with **Statistics / Thống kê**. The new page leads with lifetime active time, session count, positive-time practice days, response count, average active session duration, and completion/early-stop/interruption totals. A seven-day activity chart and daily detail disclosure provide recent context without completion streaks or grades. Exercise report cards show time, sessions, answer accuracy, median response time, correct/total answers, recent session results, last practice, and latest recorded task level where applicable. Pursuit and saccades have no gaze score. Lifetime totals by eye, paged session history, and separate professional measurements remain available.

Accuracy is weighted by individual answers; response timing uses the median of valid recorded responses. Time uses accumulated foreground activity, never wall time away. Calendar summaries use stored local slices. Duplicate IDs and a current copy of a historical session are counted once. The interface explains that conditions can differ and task results do not measure eyesight. English and Vietnamese labels, numbers, durations, and dates are translated together.

Reset opens a native confirmation with Cancel focused. Saved sessions are cleared by default; switches separately include professional measurements or exercise difficulty. A one-copy Undo snapshot persists in IndexedDB, survives reload, and merges subsequent activity without duplicate records. New sessions retain their newer exercise levels during Undo. Routines/preferences stay, and active/interrupted exercises or routines block reset and restore. Empty resets cannot replace an existing Undo copy. Exports/imports validate and retain the snapshot without silently adding archived records to current totals. After reset/Undo, focus moves to the corresponding available action.

All **117 tests**, the production build, and whitespace checks pass. Added coverage for weighted accuracy, response medians, partial time, local day boundaries/daylight saving, deduplication, missing scores, reset scopes, immutable snapshots, active-session guards, no-op resets, new-record preservation, durable Undo, and backup validation. Browser checks at 320×740, 390×844, and 844×390 showed no horizontal overflow. Vietnamese reset buttons measured about 65px high at 320px; both actions stayed visible after rotating to landscape once the dialog header/footer were fixed and its body made scrollable. Verified Cancel, default-off switches, field access while scrolling, professional-record restoration, history paging from 20 to all 29 records, and focus return.

A synthetic 28-session week produced 2 hr 17 min, seven practice days, 266 answers, visual accuracy 105/140 = 75%, and contrast accuracy 77/126 ≈ 61%. On the isolated local test origin, a full reset survived reload and began a visual task at Level 1. A new 13-second partial session with one answer was retained when Undo restored the previous records, yielding 29 sessions and 267 answers. That result also survived reload. The browser's file picker stalled during initial example-data import; no production records were used or reset. These are Chromium viewport checks; physical iPhone Safari, VoiceOver, Dynamic Type, and Home Screen checks remain outstanding.

The following previews contain **synthetic example data**: [lifetime report](screenshots/iphone-statistics-example.jpg), [exercise report cards](screenshots/iphone-statistics-cards.jpg), [Vietnamese report](screenshots/iphone-statistics-vi.jpg).
