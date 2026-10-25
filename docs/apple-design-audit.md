# Apple Design audit and implementation

Applied the Codex port of Emil Kowalski's [apple-design](https://github.com/emilkowalski/skills/tree/main/skills/apple-design), identified by [Charlie Hills's article](https://charliehills.substack.com/p/apples-design-rules-as-a-claude-skill). The skill is MIT licensed. Its original instructions and license are preserved in `tools/skills/apple-design/`; the installed Codex entrypoint is `~/.agents/skills/apple-design/SKILL.md`.

## Port decisions

- Added Codex discovery metadata, a concrete review/fix workflow, and reusable invocation text.
- Replaced the source's greeting-only startup rule with doing the requested work.
- Kept upstream content in a linked reference and preserved the MIT license.
- Clarified that press feedback happens immediately but normal actions commit on release; moving away can cancel activation.
- Kept gesture/spring guidance conditional on actual gestures. This app needs no new gesture or animation library.
- Preserved functional Canvas motion. General reduced-motion styling does not suppress the exercise; gentler pursuit is an explicit user setting.

## Findings and fixes

| Priority | Finding                                                                                                            | Implemented result                                                                                                                                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High     | Helper, safety, and status text used small fixed pixel sizes.                                                      | Relative type, larger helper/body text, visible safety copy, and responsive text wrapping.                                                                                                                                                |
| High     | Buttons had no pointer-down feedback; hover styling also applied on touch devices.                                 | Immediate pressed opacity; hover styling restricted to fine pointers that support hover. Native click/release and drag-away cancellation remain intact.                                                                                   |
| High     | React rerendered every display frame, including paused sessions; an idle animation loop remained outside sessions. | Canvas keeps display-timed drawing; timer labels refresh at most ten times a second. Paused sessions draw only on entry/resize. No training animation loop runs with no current session. Rest labels refresh at most five times a second. |
| Medium   | Exercise selection and advanced-panel disclosure were only visually apparent.                                      | `aria-pressed` on exercise choices; `aria-expanded` and `aria-controls` on settings disclosure; decorative art is hidden from accessibility APIs.                                                                                         |
| Medium   | All advanced exercise controls appeared for every exercise, and custom seconds duplicated preset duration.         | Task-specific advanced controls. Custom seconds appear only when Custom is selected.                                                                                                                                                      |
| Medium   | Navigation icons depended on unrelated Unicode glyphs.                                                             | Consistent original inline SVG icons, hidden from assistive technology; labels name each destination.                                                                                                                                     |
| Medium   | Navigation retained the prior page's scroll offset.                                                                | Destination pages start at the top without animated scrolling.                                                                                                                                                                            |
| Medium   | The floating bar did not honor reduced transparency or system increased contrast.                                  | Opaque fallback under reduced transparency; clearer text and borders under increased contrast.                                                                                                                                            |
| Medium   | Tight mobile grids and the daily card were fragile with larger text.                                               | Minimum-width-safe columns, a stable daily-summary grid, and single-column exercise rows on very narrow screens.                                                                                                                          |

## Verification

- Production TypeScript/Vite build passes; all 19 existing automated tests pass after the changes.
- Codex `quick_validate.py` validates the installed skill.
- Browser viewport checks at 320×740 and 390×844: no horizontal document overflow. At 390px the visible button targets measured at least 44px in both dimensions.
- A running pursuit session remained active and retained time through resizing to 844×390 landscape; all three controls remained within the viewport and measured 44px high. Pausing then held active time steady.
- With Finish & save pressed down, computed opacity was 0.72. Moving the pointer away before release left the session paused rather than finishing it.
- Emulated reduced transparency and increased contrast produced an opaque navigation background, no backdrop blur, and lighter secondary text. Emulated text scaling did not produce horizontal overflow; this is not a physical iPhone Dynamic Type verification.
- Exercise choice exposes `aria-pressed="true"`; advanced disclosure exposes its expanded state.
- Existing pause/recovery, partial-session, routine, and offline behavior is preserved. The prior production test verified a cache-based cold reload and response exercise with its local server stopped.

## Remaining device checks

Physical iPhone Safari and Home Screen testing remain necessary for actual safe areas, Dynamic Type, interruption behavior, and offline launch. Browser viewport emulation does not establish physical-device performance, measured input latency, or clinical effectiveness.
