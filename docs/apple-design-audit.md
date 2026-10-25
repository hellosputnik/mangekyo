# Apple Design audit and implementation

Applied the Codex port of Emil Kowalski's [apple-design](https://github.com/emilkowalski/skills/tree/main/skills/apple-design), identified by [Charlie Hills's article](https://charliehills.substack.com/p/apples-design-rules-as-a-claude-skill). Its original instructions and MIT license are preserved in `tools/skills/apple-design/`; the installed Codex entrypoint is `~/.agents/skills/apple-design/SKILL.md`. The port adds Codex metadata and a concrete review/fix workflow, replaces the greeting-only startup rule with doing the work, and keeps native release/cancel behavior and functional Canvas motion.

## Interface review — October 25, 2026

Reviewed setup, training, rest, progress, routines, and settings in English and Vietnamese. The crimson identity remains. [Apple's materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials) informed floating navigation with readable content and accessibility fallbacks. This web implementation approximates glass with CSS; it does not use Apple's native Liquid Glass APIs. [Apple's layout guidance](https://developer.apple.com/design/human-interface-guidelines/layout) informed hierarchy and responsive placement.

| Finding | Implemented change |
| --- | --- |
| Eye selection was hidden in a menu without a visual reference. | Native left/right/both radio options with diagrams, selected checks, and a clearly labeled user viewpoint. Shared by setup, routines, and professional measurements. Selection remains self-reported. |
| Duration menus made simple changes cumbersome. | Native slider and exact minutes/seconds entry. Errors preserve the valid setting and prevent invalid starts/saves. Longer exact values extend the slider range. |
| Oversized exercise cards pushed setup down the page. | Compact two-by-two chooser, one selected description, and focused setup. Desktop puts setup beside choices; mobile retains a single reading order. |
| Pursuit details required an unnecessary settings disclosure. | Mixed and five individual motion presets with path illustrations, plus Custom for all detailed controls. Default five-minute Mixed allocates roughly a minute each to horizontal, vertical, circular, figure-eight, and wandering motion. Pauses do not advance it. |
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

- `npm test`: **81 tests pass**, including timing, recovery, persistence, progression, translations, scoped offline caches, and controls. New coverage includes exact duration limits, blank/malformed drafts, zero-length breaks, eye/range/navigation semantics, preset selection, equal mixed-path allocation at several durations, continuous position/velocity, bounded trajectories, pause/recovery, and legacy/mixed backup compatibility.
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
