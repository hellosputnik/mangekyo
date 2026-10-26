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
