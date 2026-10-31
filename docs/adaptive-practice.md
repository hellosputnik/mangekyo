# Adaptive practice, profiles and evidence

Implemented October 30, 2026. New scored sessions use `adaptive-1-<exercise>`. Earlier records and interrupted sessions retain their earlier protocol; fixed check-ins retain their fixed stimulus. Pursuit and basic saccades remain user-controlled because there is no gaze measurement.

## Controller and physical settings

The controller evaluates five valid first attempts at a setting. Its weighted change is `gain × (success − 0.85)`, normalized to the mode's physical step. Five correct answers permit an increase; four correct and one error cause a small supportive adjustment. Repeated mistakes provide greater support. Earned points and touch levels do not decrease when challenge changes.

The 85% target is a product hypothesis, not a guaranteed observed rate or a clinical learning optimum. Coarse probes, personalized response timing, reversal steps, quantization and physical caps modify the reference model. The [original policy and research](balancing-policy.md) explain these distinctions. Parameters are centralized in `src/adaptive/rules.ts`.

| Activity          | Principal change                            | Pacing and limits                                                                                                                                                                                                               |
| ----------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visual detail     | Target diameter                             | At least five correct before shrinking; steps are limited by an eight-active-second evidence interval. Normal reduction is about 1.8% before reversal scaling, versus the earlier 6% per step. The backing-pixel floor remains. |
| Contrast          | Pattern contrast                            | Smaller relative steps; shape, size and colors stay fixed.                                                                                                                                                                      |
| Crowded symbols   | Flanker spacing                             | Start from the actual fitted gap, keep diameter fixed, and cap challenge at the available gap limit.                                                                                                                            |
| Fine alignment    | Backing-pixel offset                        | A real pixel ladder maps back to renderer coordinates. No nominal challenge accumulates beyond the available offset.                                                                                                            |
| Tap targets       | Visible dot size                            | Deadline and generous hit area stay fixed. Default is timed at 2.5 seconds; hit area is at least 44 CSS pixels. Five centered timely hits still earn a level.                                                                   |
| Follow the target | Motion rate                                 | Dot size and halo stay fixed. Adapt from ten held active seconds. Ten on-target seconds still earn a level independently.                                                                                                       |
| Track & find      | Circle count, then speed                    | Add circles before increasing speed. Duration stays fixed. The speed cap reflects the renderer's actual minimum leg duration.                                                                                                   |
| Find & count      | Distractor count, or motion rate for Moving | Separate Count, Match and Moving profiles. Moving holds item count fixed.                                                                                                                                                       |
| Brief recall      | Memory load, then exposure                  | Separate Locations, Digits, Directions and Compare profiles. Exposure shortens after the load stage; Compare varies exposure at fixed load.                                                                                     |
| Number sequence   | Actual item count                           | Maximum twelve items. Fractional evidence between item changes is not advertised as an earned level.                                                                                                                            |

Default search/recall alternate activities in blocks of five rounds, beginning with a less-practiced variant in the matching profiles. This supplies a full observation window sooner than cycling after every response. Attention headers show round numbers and pace reviews rather than presenting latent challenge as an earned level.

## Profiles, confidence and checks

Profiles distinguish exercise, activity, self-reported eye, input method, hand/base configuration, viewport buckets and pixel ratio. Duration and daily goals do not affect them. Sorted configuration keys make the key independent of JSON property order. Compact stable IDs avoid repeating configuration JSON in every trial; restoration also verifies the full canonical conditions.

Up to 200 profiles persist locally. Returning practice starts slightly below its matching saved challenge and rechecks it. After fourteen days without evidence, recent evidence is cleared and the rechecking state is shown. Wall-clock dates only decide freshness; they never award training time. Timestamps reflect the last accepted outcome, not the last autosave.

“Working range sampled” requires twenty trusted observations, fifteen recent observations and a direction reversal. These are product confidence indicators, not estimates of visual acuity. The inspector gives an approximate Wilson interval for recent binary accuracy, with a warning that adaptive conditions vary. Continuous follow windows do not receive a fabricated binomial interval.

After twenty-five trusted responses, a non-touch activity above its base range inserts a more comfortable check. Checks are excluded from progression and ordinary accuracy comparisons. A missed check briefly holds increases, retains earned achievements and does not diagnose fatigue.

Only complete valid windows drive adjustment. Each consumed response number appears in at most one decision. Deliberate pause can retain pending evidence; backgrounding/reload discards pending evidence and requires explicit resume while preserving trusted history, scores and active time.

## Presentation quality

The shell records animation gaps above 250 milliseconds, background interruptions and changes to screen/input conditions. Responses before a recorded presentation are marked too. This is a conservative software guard, not a hardware-latency or display-calibration measurement.

Affected responses remain in history but are excluded from adaptation, matched bests and accuracy/latency comparisons. Earned points remain. Following does not interpolate on-target time across an unobserved gap. Its incomplete window restarts, with the interruption recorded separately so the next fully observed window can count.

Valid active time still contributes to the scheduling goal. Paused, released follow input and background time remain excluded. Time goals never change difficulty.

## Recaps and inspection

Recaps describe physical accomplishments only when supported by repeated comparable evidence and maintained accuracy. These include smaller targets, reduced contrast/spacing/offset, additional objects, or faster motion. A much slower final response cohort does not produce a speed-insensitive accomplishment. Follow summaries require repeated measured windows at comparable size/tolerance. Sparse evidence keeps the ordinary saved-session summary.

Vietnamese recaps use a shorter best-run label, aligned values and concise exclusion notes. Task scores are never described as improved eyesight.

Open **Settings → Developer tools → Balance inspector** (**Cài đặt → Công cụ phát triển → Kiểm tra độ khó**). This read-only local tool loads only when opened. Select a session, activity and condition group. Charts show the presented measure, success and response time against active time. Select a decision for its phase, before/after challenge, consumed responses, outcomes, exclusion reasons and stimulus values. Profile data is available in a disclosure. Different condition groups are not joined into one curve.

Each session retains up to 1,000 recent decisions, 300 quality events and 256 recent condition descriptions. Trials retain their actual presentation and compact condition ID. Exports/imports preserve profiles and evidence; existing local profiles win on conflicts. Difficulty reset clears profiles, and Undo restores them while preserving matching profiles learned afterward. Imported active sessions become interrupted historical records, never auto-resumed practice.

## Verification

Tests cover minimum evidence, weighted direction, active-time pacing, profile separation and canonical keys, rechecking, isolated check trials, physical limits, ten-second follow rewards, browser gaps, pause/reload, backup validation, merge conflicts, reset/Undo, meaningful recaps and English/Vietnamese inspector rendering.

The actual-engine pacing suite uses each mode's cue, exposure, delay and response timing for one-, five- and fifteen-minute sessions across 32 deterministic seeds. Observers respond to presented geometry/count/speed, rather than treating every nominal level as a physical change. Per-seed results are in [game-balance-results.json](game-balance-results.json). Regenerate them with:

```sh
MANGEKYO_BALANCE_REPORT=1 npx vitest run scripts/game-balance.test.mjs
npm test
npm run build
```

The modeled first minute remains approachable. Five-minute results generally move closer to the proposed working band; longer recall/search activities provide less evidence than rapid discrimination. These runs test declared synthetic observers, not human learning or therapeutic benefit.

WebKit checks use isolated synthetic records. Physical iPhone Safari/Home Screen behavior, audio/haptics, phone calls/locking and intended-user comfort still require real-device evaluation. Browser emulation does not establish those results.

WebKit verification completed for Vietnamese and English, 320/390px portrait, 844px landscape and 1280px wide layouts. Inspector controls measured at least 44px after the Safari native-select correction, the dialog remained balanced, and 200% text did not cause horizontal overflow. Synthetic sessions verified explicit reload recovery, unchanged active time while away, separate eye profiles, returning-profile rechecks, matched recaps and selectable decision evidence. These are browser-emulation results.

Final automated verification passed **417 tests in 41 files**, strict TypeScript and the production build. The production WebKit offline check retained saved practice after reload and opened the inspector for the first time with networking disabled, confirming its separate JavaScript chunk was precached. Earned tap levels are excluded from physical-condition comparison keys when actual adaptive geometry is recorded.
