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
