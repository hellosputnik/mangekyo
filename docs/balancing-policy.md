# Balancing all Mangekyo exercises

Design study, October 28, 2026. Source audit: application revision `06b33aef78f3878d5feabd9c72081f2d168a0bae`.

**Guiding principle: start comfortably, find a working range from repeated demonstrated performance, then make small adjustments around that range. Accomplishment and task difficulty are separate.**

New sessions now implement this policy under the `adaptive-1` protocol. See [implementation, parameters and verification](adaptive-practice.md). The original study below remains a mathematical workbench; its abstract gains are not the physical parameters shipped in the games. The audit table records behavior before `adaptive-1`. Intended-user evaluation remains necessary.

## What established work gives us

- [Levitt, 1971, Transformed Up-Down Methods in Psychoacoustics](https://bdml.stanford.edu/twiki/pub/Haptics/DetectionThreshold/psychoacoustics.pdf): adaptive staircases place successive trials using previous responses. Their response rules determine a sampling target. Under idealized assumptions, four consecutive correct responses followed by a harder step, and one incorrect response followed by an equally sized easier step, targets about 84.1% correct. This is a convergence property, not evidence that 84.1% optimizes practice or treats amblyopia.
- [Kaernbach, 1991, Simple adaptive testing with the weighted up-down method](https://link.springer.com/article/10.3758/BF03214307): different step sizes for correct and incorrect outcomes permit an explicit target probability. Its balance equation gives a transparent basis for the controller below. Aggregating five outcomes before changing a stimulus is our product adaptation of that principle, rather than the paper's per-response procedure.
- [Guadagnoli and Lee, 2004, Challenge point](https://pubmed.ncbi.nlm.nih.gov/15130871/): functional challenge depends on the interaction between the person's skill and the task. The framework motivates individual adaptation; it does not prescribe one success percentage for every activity.
- [Wilson et al., 2019, The Eighty Five Percent Rule for optimal learning](https://www.nature.com/articles/s41467-019-12552-4): the approximately 85% result concerns particular gradient-descent learning models and binary classification assumptions. It is a useful hypothesis to examine, not a universal optimum for games, finger tracking, memory, or amblyopia.
- [Karmali et al., 2016, Determining thresholds using adaptive procedures and psychometric fits](https://dspace.mit.edu/entities/publication/69d93d17-3381-4c75-a4f6-669d3d14935e): adaptive procedure, step size and observation count affect estimation efficiency. The paper evaluates threshold estimation, including simulations and human experiments. Efficient measurement and beneficial practice are different objectives.

There is no verified clinical or hospital standard here that supplies difficulty settings for these twelve phone activities. We can adopt established methods, specify assumptions, and test our choices. That does not validate the application as a treatment.

## A concrete problem in the current rules

Contrast, Crowded symbols and Fine alignment use five-answer blocks: four or five correct makes the task harder, three holds, and zero through two makes it easier. With equal-sized difficulty steps, at a true success probability of 80%:

- The probability of a harder block is **73.728%**.
- The probability of an easier block is **5.792%**.

The controller therefore keeps pushing harder at 80%. Under independent, stationary responses and equal effective steps, its zero-drift point is approximately **59.434% correct**. The four-out-of-five advancement criterion is not an 80% operating target.

This is an analytic diagnosis of that rule, not an observation that users achieve 59%. Display limits, finite sessions, changing ability and unequal rendered steps affect actual results. Alignment's pixel skipping particularly violates the equal-effective-step assumption. The mismatch still explains why counting successful blocks without analyzing both directions is insufficient.

## Reference controller for scored response tasks

Use a weighted controller with a declared target, rather than a collection of unrelated advancement thresholds:

```text
nextChallenge = clamp(challenge + gain × (observedSuccess − targetSuccess))
```

Higher `challenge` always means harder. For the reference study:

- `targetSuccess = 0.85`: a provisional comfort/challenge preference, not a clinical threshold or proven learning optimum.
- One observation window contains five valid, first-attempt, unassisted outcomes at the same settings and activity.
- `observedSuccess = correct / 5`.
- The exercise maps continuous challenge to its own actual stimulus settings.

With a fixed gain and no bounds or quantization, the expected change is `gain × (trueSuccess − 0.85)`. Its zero-drift point is explicit. The target can be changed without inventing another correctness pattern.

| Correct in a five-answer window | Change, as a fraction of gain |
| ------------------------------- | ----------------------------: |
| 5                               |                         +0.15 |
| 4                               |                         −0.05 |
| 3                               |                         −0.25 |
| 2                               |                         −0.45 |
| 1                               |                         −0.65 |
| 0                               |                         −0.85 |

An increase requires five correct outcomes, so one lucky answer cannot advance difficulty. One mistake produces a small correction; repeated mistakes provide more support. Neither removes points or earned achievements. This is preferable to shrinking after every correct answer or treating four correct answers and one error as evidence to keep pushing harder.

The 85% target applies to the reference controller's **binary outcomes**. It does not mean every five-answer window should contain 85% correct, which is impossible. Evaluate longer-run behavior and uncertainty. A two-choice task, a four-choice task and a complete multi-tap recall round also have different chance rates; record those differences and do not compare their raw scores as equivalent abilities.

An alternative symmetric staircase has target `2^(−1 / requiredConsecutiveCorrect)`: three correct targets 79.4%, four 84.1%, five 87.1%. Requiring more correct answers changes the operating target as well as the pace. We should not casually alter such requirements and continue claiming the same difficulty target.

### Boundaries of the formula

The derivation assumes fixed conditions within a window and a well-defined success probability. Saturation, unequal up/down caps, discrete item counts, timing-dependent gains, mixed activities and correlated errors can change the realized operating point. Any such addition must be simulated as part of the complete controller. A deadband is not automatically an 80–90% guarantee.

Never maintain an invisible high challenge above a display cap: it creates a delay before errors can actually make the task easier. Quantize to a realizable setting, retain a bounded residual where necessary, and make the next supportive change affect the presented stimulus. Stop at renderable limits and explain that limit; do not invent a clinical score or introduce an unrelated task to hide it.

## Pacing and evidence contract

Use the same phases across response modes, with exercise-specific physical mappings:

1. **Orient.** Keep Try it unscored and repeatable. A first real session starts at comfortable base conditions. For returning practice, use a matching saved profile and a short easier warm-up; do not reset everyone to the slowest introduction every day.
2. **Find the range.** Permit larger upward probes only after multiple valid successes. End coarse probing when errors or slower confident responding identify a working range. Set both the evidence requirement and maximum physical probe in the mode's parameter record. Long tracking/recall rounds need their own search budget; five trials in one mode can take much longer than five in another.
3. **Practice.** Use smaller relative changes and shrink step size around reversals. Adjust between trials, preserving the stimulus during each trial. Measure how much physical change results, not just a nominal level number.
4. **Support.** Repeated errors should make the current activity more achievable. Keep the same presentation and earned accomplishments. Avoid a cascade of decreases caused by repeatedly reusing the same old errors.

Response speed helps pace the search after the minimum correct evidence is met. Use robust, within-person response-time estimates under comparable conditions. Slow accurate answers remain successful in untimed discrimination. In explicitly timed tasks, such as Tap targets, accuracy and the displayed active-time deadline jointly define success. Do not add an invisible speed test to every exercise.

Each mode needs an explicit limit on physical change per observation window and per active minute. Visual detail needs a conservative size-change limit, reflecting the existing feedback that it shrinks too quickly. These limits and the quick-search budget must be evaluated together: a long-round game can remain boring despite a correct long-run setpoint. **The simulation's abstract gains are not ready-to-ship size, speed or timing defaults.**

Only answered, unassisted trials or actual held tracking time supply evidence. Exclude replays, rehearsal, canceled gestures, pending answers, pauses, release time and background time. Consume each completed window once. Keep pending evidence across intentional pause/reload only when the exact presented task can be recovered; otherwise restart it explicitly without converting it into errors. Never award active training time from wall-clock absence.

## Per-mode audit and tuning direction

| Mode              | Before adaptive-1                                                                                                                                          | Primary signal and proposed control                                                                                                                                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Smooth pursuit    | Configured motion; optional variable speed. No gaze score.                                                                                                 | Keep pace under user control. Offer smooth variation within chosen bounds. Completion is scheduling information and cannot justify automatic difficulty increases.                                                                                 |
| Saccades          | Configured target jumps and optional tap acknowledgement.                                                                                                  | Keep size, jump distance and timing controllable. An acknowledgement measures a touch response, not whether the eye landed accurately. No automatic gaze-based tuning.                                                                             |
| Visual detail     | Size scales by `0.94^level`; at least five correct, recent accuracy and fixed response-time bands gate shrinking. Two of three errors enlarge three steps. | Binary direction identification; use a conservative size staircase with minimum correct evidence and a size-change rate limit. Keep the current symbol presentation. Prefer personal latency evidence over universal 1.8/3.5-second cutoffs.       |
| Contrast          | Five-answer 4/5-up, ≤2/5-down rule; contrast scales by `0.84^level`, with a floor.                                                                         | Correct panel choice; tune contrast independently with smaller relative steps near the working range. Screen settings remain uncalibrated.                                                                                                         |
| Crowded symbols   | Same block rule; fixed symbol size, gap scales by `0.9^level`.                                                                                             | Central-symbol direction; adapt spacing while holding size and contrast fixed. Stop at actual geometric limits.                                                                                                                                    |
| Fine alignment    | Same block rule; `0.9^level` offset, with backing-pixel quantization and skipped identical offsets.                                                        | Left/right response; adapt actual pixel offset. Test its discrete ladder separately; equal nominal levels are not equal physical steps.                                                                                                            |
| Tap targets       | Five-outcome touch controller, separate earned levels; load changes dot size, halo and deadline together.                                                  | Centered hit within the displayed deadline; make target size the initial principal adaptive axis. Keep a generous accessible hit area. Tune deadline in a separate stage if precision is stable; retain timed Default and untimed Custom.          |
| Follow the target | Ten active held seconds per window; load changes size, halo and speed together.                                                                            | Time-weighted on-target fraction over ten held seconds, using a continuous controller. Tune one principal axis at a time. Keep the ten-on-target-second accomplishment goal separate.                                                              |
| Track & find      | Three successes during coarse calibration; later eight/ten, with recent correct answers; speed, count and eventually duration increase.                    | First-attempt final identity choice. Use repeated evidence and a declared speed/count ladder. Vary trajectories to reduce shortcuts. Test spacing/crowding when adding circles; avoid increasing count and speed on the same step.                 |
| Find & count      | Count, Match and Moving share a saved level and evidence; mostly five/eight correct to advance.                                                            | First-attempt correct result per variant. Keep separate profiles. Adapt distractor count for static variants; movement speed for Moving, with count held stable during that stage. Record answer latency without silently failing untimed answers. |
| Brief recall      | Locations, Digits, Directions and Compare share a saved level; exposure shrinks while memory load can rise.                                                | Complete first-attempt recall per variant; keep load and exposure on separate stages. Mixed Default selects activities, not a pooled estimate of one ability.                                                                                      |
| Number sequence   | Five/eight correct rounds to advance; item count increases every four nominal levels.                                                                      | Complete ordered sequence without error, with latency recorded separately. Use a real item-count ladder; do not award a harder nominal level that renders the identical task.                                                                      |

This is parity of evidence, lifecycle and feedback, rather than identical stimulus changes. A single physical curve cannot describe a C opening, a memory load and finger tracking.

### Continuous following and unmeasured practice

For Follow the target, a separate controller can use `change = gain × (onTargetTime / heldActiveTime − targetOccupancy)`. The existing ten-second window is useful and preserves the requested pacing. A provisional 85% occupancy target would be a product preference; the binary-learning result does not establish it. Frames are correlated observations, not independent trials. Integrate time, and simulate dropouts, release/regrab and different sample rates.

For pursuit and basic saccades there is no measured success probability. Use explicit comfort controls and user-chosen variation. Do not fabricate an accuracy score to make them fit the scored-game policy.

## Parameter and recording requirements

Keep one versioned parameter record per activity. Every setting must name its basis:

| Parameter                                                                | Basis                                                                                |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Weighted update equation and zero-drift calculation                      | Method-derived, under stated assumptions                                             |
| 85% response target; any occupancy target                                | Provisional product preference requiring intended-user evaluation                    |
| Five-outcome reference window                                            | Product evidence/feedback tradeoff; not a universal experimental standard            |
| Warm-up, probe budget, fine gain, reversal reduction and change-rate cap | Mode-specific pacing choices; test actual trials per minute and five-minute sessions |
| Pixel floors, minimum touch area, non-overlap and motion limits          | Rendering/accessibility constraints; verify actual geometry                          |
| Trial unit and chance probability                                        | Task-defined; specify per variant and presentation                                   |

Do not scatter these values across rendering, rewards and session timing. The controller owns evidence and challenge; the renderer owns actual geometry; rewards own earned progress; scheduling owns time goals.

Profiles must distinguish exercise **and activity variant**, self-reported eye, input/hand, base configuration, protocol and meaningful viewport conditions. Current touch profiles already distinguish many such settings; the other modes mostly save a level per exercise. Language and daily time goals do not define ability. Rotation can change the presented task even when its nominal settings remain the same.

Record each decision's consumed trial/window IDs, active timestamp, protocol, measured performance, phase, before/after challenge, actual presented values, and any clipping/ceiling reason. Retain enough evidence to resume without repeating a decision. Make old and new protocols distinct in matching-condition comparisons. Preserve historical scores, active time and interrupted sessions; never reinterpret old trials as evidence under a new rule.

Report actual stimulus size/contrast/spacing, correct responses, first-attempt response time and earned achievements. Levels are exercise-specific milestones. They do not estimate visual acuity or demonstrate improved eyesight. Keep fixed check-ins separate from adaptive practice and from professional measurements.

## Reproducible study

Run:

```sh
node scripts/balance-study.mjs
node scripts/balance-study.mjs > docs/balance-study.json
```

The script has no dependencies and fails if the analytical or simulation checks fail. [Checked-in results](balance-study.json) include the audit revision, assumptions, gains and deterministic seeds. It verifies:

- The current five-answer rule's idealized 59.434% zero-drift point.
- The weighted reference equation's zero drift at 85%, and correct direction above/below it.
- The multi-correct staircase targets and the reference block's minimum correct evidence.
- Thirty-two seeded runs for each of eleven scenarios: different capability ranges, different chance levels, lapses, capability increases/decreases, guesses and unreachable targets at both bounds.

For the eight synthetic capability scenarios, success in the final 1,000 trials is about 85.0–85.1%. Random guesses stay near the minimum load; perfect and wholly unsuccessful observers reach the appropriate boundary instead of forcing an impossible target.

**The first 30 trials are still about 93–97% successful for the capability scenarios.** A controller can have the right eventual target and still have an introduction that is too easy. These runs use 10,000 trials per seed, no display quantization, no latency model and no activity mixing. They establish reference-model behavior, not within-session settling, intended-user experience, learning, or therapeutic benefit. The small fixed calibration budget in this example needs particular scrutiny for long-round activities.

## Validation requirements for gameplay changes

1. Build actual per-mode challenge ladders from presented settings. Check monotonicity, parameter coupling and display limits at small portrait/landscape sizes and DPR 1/2/3. A reported change must change the task.
2. Put all candidate controllers through the same repeatable observer suite. Include chance-level responders, accurate-but-slow responses, rapid guesses, clustered mistakes, lapses, fatigue, learning, mode/eye changes and ceilings. Test response deadlines and ten-second held windows using the existing foreground clock.
3. Simulate real **one-, five- and fifteen-minute** sessions, using each mode's actual cue, exposure, animation and response durations. Record early exposure, time/evidence to reach a working range, error clusters, oscillation, maximum physical change and time stuck at a boundary. Publish seed distributions, not only averages or a long-run success rate.
4. Test persistence and matching keys: pause/reload, variant changes, rotation, assistance, replay, export/import, reset/Undo and protocol migration must neither mix abilities nor reuse evidence. Fixed check-ins stay fixed; time goals never alter challenge.
5. Evaluate with the intended user on an actual iPhone, using comfortable conditions and existing professional guidance. Review whether the introduction is boring, adjustments are noticeable, mistakes feel punitive, and comfort changes during a session. Local structured feedback is enough; no cloud telemetry is required.

The target range, gains and physical increments remain explicit hypotheses until that evaluation. If a mode reaches the long-run target only after hundreds of trials, or its practical limits force a different experience, revise that mode's search and mapping. Do not claim that applying a formula has completed game balancing.

## Original October 28 study checks

The analytical assertions and all eleven seeded scenarios pass. Regenerating the report twice produces data identical to the checked-in JSON. The existing application still passes all 357 automated tests and the strict TypeScript/production build. No application controller, user interface, stored record or deployment configuration was changed by this study; physical-device evaluation of the proposed policy has not occurred.
