# Adaptive touch balancing

Implemented October 26, 2026. The objective is a welcoming start, quick calibration, then a challenge that follows the individual. These are product rules for finger-control activities, not a treatment protocol, a measurement of eyesight or a guaranteed learning optimum.

## Design basis

- [Hunicke, 2005: The Case for Dynamic Difficulty Adjustment in Games](https://doi.org/10.1145/1178477.1178573) argues that adaptation should preserve the player's experience rather than make adjustments feel unfair. Mangekyo explains that difficulty adapts and keeps earned accomplishments when it eases.
- [Karmali et al., 2016: Determining thresholds using adaptive procedures and psychometric fits](https://doi.org/10.1007/s00221-015-4501-8) describes adaptive searches with large initial steps and smaller steps after direction reversals. This motivates the coarse-to-fine search here. Mangekyo is not implementing a clinical staircase or estimating a perceptual threshold.
- [Wilson et al., 2019: The Eighty Five Percent Rule for optimal learning](https://doi.org/10.1038/s41467-019-12552-4) derives an approximately 85% optimum under specific learning-model assumptions. It does not establish a universal game success rate, an optimal tracking fraction, or an amblyopia prescription. The 80–90% band below is our provisional usability hypothesis and needs individual playtesting.

## Rules shipped

| Stage                  | Behavior                                                                                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Comfortable start      | Default dot 44 CSS px, halo/hit area 100px; Follow base speed 0.04 cycles/second. Custom keeps the chosen base conditions.                                                                                                           |
| Quick calibration      | A complete measurement window with at least 95% success raises load by four units, for at most the first three windows. Perfect following can reach load 12 in 30 active held seconds. This is evidence-dependent, not a timed ramp. |
| Find the working range | An in-band result, less decisive success, a direction reversal or exhausting the three-window search ends coarse calibration. At most one-unit steps follow; reversals halve the step.                                               |
| Hold near capability   | At 80–90%, keep the current load and use quarter-unit steps for later increases. Above 90%, require two consecutive completed strong windows before increasing. A merely lucky window does not raise a personalized pace.            |
| Provide support        | Below 80%, ease after one complete window; below 60%, ease more. Three consecutive failed tap outcomes or five continuous held off-target seconds provide earlier relief. Pause/release is not a failed outcome.                     |
| Preserve control       | Pause, exit and Custom base conditions remain available. Automatic support retains earned levels and points; its message is neutral. Breaks and further practice require explicit action.                                            |

For taps, a success is a centered hit inside the displayed pace limit. Five outcomes form a window. An expired target supplies exactly one failed outcome; releasing it later does not count the failure twice. A forgiven outer-halo hit earns a point even if it does not qualify for adaptation or a level. One error in five is a valid 80% window; perfection is not required to maintain difficulty.

For following, success is the fraction of each ten active held seconds spent within the halo. Pointer/frame frequency does not weight the result. Completed windows tune difficulty independently from the ten-on-target-second level goal. The goal retains its five-second encouragement and one-second excursion tolerance. Ready, pause, release and background time earn no training or adaptation credit. An unfinished window restarts on interruption; completed evidence and tuning survive it.

## Accomplishment and task challenge

Earned levels rise after five consecutive qualified taps or a ten-on-target-second following run. They can pass 30, do not control the task settings and do not decrease when settings ease. Points, best runs and best earned levels remain visible. A new session continues earned levels while starting a fresh session score. The million-level bound is a storage guard, not a displayed gameplay target.

The task load is separately bounded from 0 to 40. Relative to the chosen base, size scales by `0.96^load`, halo diameter and tap pace by `0.97^load`, and following speed by `1.05^load`. A fine quarter-step changes these by roughly 1%, 0.8% and 1.2%, respectively. Larger early steps are temporary probes, not permanent acceleration after every reward. Stable path bounds and integrated motion phase prevent target position jumps when speed changes.

Floors remain 16 CSS px for the dot, or a smaller explicitly chosen base size, and 44px for the touch diameter. Pace is rounded to the displayed tenth of a second with a 0.6s minimum. Following respects the gentler-motion 0.08 cycles/second cap, or 0.22 otherwise, unless a faster base was explicitly chosen. Renderable geometry can impose additional limits. At the adaptive load ceiling the interface says so; the controller holds rather than promising unlimited physical challenge.

## Continuity and records

Tuning profiles are independent for exercise, self-reported eye, hand, base size, tolerance, speed, path, complexity, contrast/colors, viewing distance and gentler-motion preference. Duration, daily goal and language do not affect them. Orientation changes discard pending evidence but preserve learned tuning; viewport geometry can still change the real task, so reports should be compared with care. Up to 100 recently used profiles persist locally. Each session retains up to 1,000 recent adaptation decisions with active timestamps, measured performance and before/after load; tap trials also record actual geometry, deadline and adaptive load.

Clearing session history retains profiles unless difficulty reset is selected. Reset Undo restores prior profiles while favoring subsequent practice at matching settings. Exports/imports preserve profiles, revision-3 sessions and earned levels; existing local profiles take precedence over imported duplicates. Existing revision-1/2 records remain intact. An interrupted older session retains accomplishments, switches to current rules, and begins calibration without inventing past tuning.

## Validation and remaining uncertainty

Automated checks exercise exact ten-second timing, foreground-only integration, short-slip exclusion, calibration limits, small reversal steps, the hold band, hysteresis, easier settings, stored profiles, pause/reload, reset/Undo, malformed imports and continued levels past 30. Deterministic capability curves and seeded noisy five-tap simulations check that difficulty settles rather than escalating forever. They validate controller behavior under the stated simulated observers, not real users or therapeutic benefit.

The first practical evaluation should use comfortable, short sessions and inspect recent success, failure clusters, time to settle and the user's stated comfort. A real person's tracking may not follow a stationary curve; fatigue, finger occlusion, screen geometry, hand choice and Safari input latency can change results. Physical iPhone Safari, audio/haptics and interruption checks remain necessary. No cloud telemetry is added.
