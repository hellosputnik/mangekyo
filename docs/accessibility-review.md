# Accessibility review

This is an implementation review and verification record, not a WCAG conformance claim or medical-device certification. Reference: [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [non-text contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

## Implemented

- Essential default control borders use a stronger shared color, separate from decorative panel dividers. Automated checks enforce 3:1 against the page, panel and raised control surfaces, plus 4.5:1 for normal interface and primary-button text.
- Native labeled radios, sliders, switches and exact-value fields retain selected state, validation feedback and keyboard activation. Existing pause/stop controls remain prominent. A skip link and focused page headings support navigation.
- Native modal dialogs keep a visible close control, contain scrolling, lock the background, support Escape and restore focus to the opener. Import review explicitly separates record merging from preference restoration.
- Touch practice supports keyboard input: arrow keys move the tap cursor, Enter presses/releases a tap; hold Space with arrows to follow and release Space to pause. Escape pauses; losing focus during a keyboard gesture cancels/pauses it. Keyboard, pointer and mixed input are recorded separately and never silently pooled into a comparable-best group.
- Exercise images have descriptive identification. The visual tasks are inherently sensory tests; identifying their stimuli is not replaced by revealing the correct answer to assistive technology. This is a task-specific assessment under WCAG 1.1.1, not a blanket exemption for surrounding controls.
- Reduced motion, reduced transparency, increased contrast and forced-color treatments preserve usable controls. Functional exercise motion keeps its explicit pause and gentler-motion options.

## Verification on this revision

The 253 automated tests and strict production build pass. Contrast regression tests cover the shared essential borders and interface text, rather than treating low-contrast exercise stimuli as interface controls.

Chromium viewport checks covered all four pages in English and Vietnamese from 320px phones through 1920px desktops. Both languages at 200% text at 320, 390 and 1280px retained visible controls without horizontal overflow or clipped headings. Enlarged-text findings in eye choices, duration/routine controls, backup buttons, history rows and report headings were repaired with reflow. Exact per-tab viewport dimensions were checked during the final matrix. Text-spacing overrides (1.5 line height, 0.12em letter spacing, 0.16em word spacing, 2em paragraph spacing) passed on all four pages in both languages at 320, 390 and 1280px.

Rehearsal retained its close control at 320×740, 390×844 and 844×390; closing restored focus to Try it. Keyboard tap input produced affirmative rehearsal feedback without a saved session. Real tap/follow keyboard controls, Escape pause and release-to-Ready behavior were exercised. A partial-session recap received focus after ending and after offline reload. Import cancellation left local totals unchanged; confirmation with preference restoration disabled retained the current language and schedule.

## Still requiring direct verification

- iPhone Safari, Home Screen mode, native text-size settings, software keyboard, safe areas and interruptions on physical devices.
- VoiceOver reading order, names, status announcements, modal focus and recovery on both iPhone and macOS Safari.
- A complete criterion-by-criterion WCAG 2.2 A/AA evaluation across all states, plus intended-user usability validation. Automated tests and Chromium viewport checks do not establish these results.

The [Vietnamese iPhone walkthrough](iphone-walkthrough.vi.md) prepares the usability session. No physical-device or representative-user pass is claimed here.

## Follow-up: summaries, check-ins and crowded symbols

The current revision passes 265 automated tests and the strict production build. An 88-state Chromium matrix covered all four pages in English and Vietnamese at phone, landscape and desktop widths, plus 200% text and expanded text spacing. Two existing narrow-screen English disclosure labels were repaired and rechecked. Custom settings retained readable controls at 320×740, 390×844 and 844×390; an enlarged-text Done-button finding was repaired by reflowing the dialog header. The weekly mini chart uses a focusable native horizontal scroller when enlarged labels need more room, with full dated list labels for assistive technology.

The new crowded-symbol task keeps answer controls large and reports actual presented spacing and diameter. A twelve-answer check-in preserved its answers and active time across pause/reload, required explicit Resume, and completed into the shared recap. Repeat retained a fresh answer counter and the ordinary practice duration. Two matching completed check-ins appeared together in the dated accuracy/response-time chart; a partial repetition stayed in history. Saved setup loading restored the exact spacing value. A two-tab browser check paused the stale tab, exposed an export-copy action and loaded the winning eye selection after explicit reload.

With the production server stopped, a saved setup survived reload, the new exercise completed twelve answers, and its result, chart and reminder dismissal survived another offline reload. These remain Chromium and mocked-API checks. Direct iPhone Safari, Home Screen interruptions, VoiceOver and representative-user observation are still outstanding.

## Follow-up: eighth mode and complete rows

Fine alignment adds two large Left/Right response controls and a bounded two-line stimulus. The mode chooser uses complete rows of two or four equal tiles and reflows to one column for large text. At 390px, all eight tiles measured 96px high and about 162px wide in four pairs. Thirty-six checks covered all four pages in English and Vietnamese at 320×740, 390×844, 844×390 and 1280×900, plus the practice/Custom views at 200% text on a 320px viewport, with no horizontal overflow or clipped labels.

Browser practice verified affirmative feedback for the observed line direction, an explicit pause/reload/Resume path preserving the answer counter, and completed twelve-answer results in Statistics. Automated tests cover both direction mappings, renderer termination, pixel quantization and viewport bounds, visible progression/support, fixed-condition check-ins, backup metadata and migration from seven setups. Physical iPhone and VoiceOver checks remain outstanding.

With the production preview server stopped, the cached application reloaded, completed a twelve-answer alignment check-in and retained its active time and completed recap after another reload. The final production assets were used for this Chromium check; it does not replace iPhone Safari or Home Screen testing.

## Follow-up: response pacing

Visual discrimination keeps its stationary stimulus and answer layout. A single observed correct answer retained the same rendered diameter and produced affirmative feedback. Automated checks require multiple correct answers, recent accuracy and latency-based evidence before shrinking; five-minute perfect-fast-answer runs stay above the display floor at DPR 1/2/3. Pause/reload retains the evidence without crediting time away. Fixed-condition check-ins retain their protocol.

Default Tap targets now shows an active-time countdown ring and moves on timeout. The browser displayed neutral timeout feedback, froze at pause and retained its active time after reload. An untimed Custom choice survived reload; its stage image remained identical over 91 active seconds, then a centered tap earned a point and qualifying progress. Twelve checks covered timed/untimed Custom controls in English and Vietnamese at 320×740, 390×844 and 844×390, without horizontal overflow or clipped labels. Actual iPhone Safari, VoiceOver and intended-user pacing validation remain necessary.

With the final production server stopped, a timed session reloaded at the same twelve active seconds, required explicit Resume, continued moving targets on expiration and saved a 22-second partial recap that survived another offline reload. The production build's cached-file check reported complete before the server was stopped.
