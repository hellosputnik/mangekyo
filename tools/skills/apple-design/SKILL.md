---
name: apple-design
description: Build or audit web interfaces using Apple-inspired interaction, typography, feedback, materials, and accessibility principles. Use for interface polish, touch responsiveness, fluid gestures, interruptible motion, or applying this skill to an existing app; preserve the product's identity and functional requirements.
---

# Apple Design for Codex

Adapted from [Emil Kowalski's apple-design skill](https://github.com/emilkowalski/skills/tree/main/skills/apple-design), discovered through [Charlie Hills's article](https://charliehills.substack.com/p/apples-design-rules-as-a-claude-skill). The upstream skill is MIT licensed; keep `LICENSE` when redistributing. This is an independent adaptation, not an Apple-endorsed standard.

## Apply it to the task

Proceed with the user's concrete request. For an existing product, inspect the actual code and rendered interface, identify the most consequential interaction and readability problems, then fix the authorized findings. Preserve the established visual identity, layout intent, data, and working flows unless change is needed to solve an observed problem. For an audit-only request, report evidence and fixes without making changes.

Read [the upstream reference](references/upstream.md) for detailed motion, gesture, material, typography, and design reasoning. Its greeting-only initial-response instruction is not part of this port. Use the workflow below when guidance conflicts; specific user requirements take priority.

## Review and implementation

- **Response:** show immediate pointer-down feedback. Commit ordinary button actions on click/release so users can cancel by moving away; retain keyboard and assistive-technology activation. Remove needless input delays. Apply hover treatments only to hover-capable devices.
- **Control:** preserve pause, exit, cancellation, and recovery. Never lock input while an effect plays. Announce meaningful results and expose selected/expanded state semantically. Keep reversible actions easy to reverse.
- **Direct manipulation:** only introduce gestures when the product needs them. Use Pointer Events, capture, grab offset, a short velocity history, and one-to-one tracking. Settle from the current displayed position and velocity; project momentum before choosing a destination. Prefer native scrolling and controls when they already solve the task.
- **Motion:** use a velocity-aware, interruptible spring for gesture-driven movement; use restrained CSS press feedback or short fades for ordinary controls. Do not add a spring dependency merely to animate buttons. Avoid decorative loops, input gates, blanket `will-change`, or full-screen moving backgrounds.
- **Hierarchy and materials:** make the primary task and exit path obvious. Use translucency only where overlapping chrome benefits from depth; maintain legibility and an opaque fallback. Avoid stacking glass surfaces and using blur on every card.
- **Typography and layout:** use system fonts, comfortable body sizes and line height, size-appropriate tracking, and relative text/layout units. Keep interface text readable, tap targets at least 44 CSS pixels, and controls stable during state changes. Test narrow, landscape, long-label, and enlarged-text layouts.
- **Accessibility:** independently honor `prefers-reduced-motion`, `prefers-reduced-transparency`, and `prefers-contrast`; keep visible focus and sufficient text/control contrast. Use static or gentle feedback when motion is reduced. Never apply decorative motion rules to a functional stimulus in a way that changes its meaning; offer an explicit task-appropriate alternative instead.
- **Feedback:** tie optional audio/haptics to a meaningful causal event. Keep visual feedback available without either. Status, completion, warning, and error messages need specific wording and nearby placement.
- **Performance:** keep high-frequency animation outside framework rerenders where practical. Use `requestAnimationFrame` and Canvas for functional stimuli; use transform/opacity for DOM movement. Stop unnecessary render loops when nothing is changing.

## Verify the result

Use available browser tools to check the affected interactions, responsive layout, focus, press/release/cancel behavior, and accessibility preferences. Run checks appropriate to changed behavior. Record concrete findings, implemented fixes, and verification limits in an appropriately sized project artifact when useful. Do not claim device testing, measured latency, clinical benefit, or exact Apple specifications from inspecting source alone.

Respect the user's preview preferences. Skill use does not authorize communication, publication, or new dependencies beyond the requested work. Do not copy platform-specific tool names, hard-coded paths, or product facts from the source without checking that they apply.
