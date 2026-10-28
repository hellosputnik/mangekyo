# Flash Focus: comparison and candidate games

Reviewed October 28, 2026 against Mangekyo's eight current exercises. This is product research, not a treatment plan or a systematic clinical review. Manufacturer descriptions establish what a game does; they do not establish medical benefit. No modes were implemented as part of this research.

Implementation follow-up: Mangekyo now includes four additional experimental modes covering the missing core mechanics. See [attention activities](attention-exercises.md) for the implemented variants, controls, pacing, reports and verification limits. The comparison below preserves the eight-mode starting point used for the research.

## What Nintendo shipped

Flash Focus is the Nintendo DS game also sold as Sight Training. It groups activities under moving-object recognition, brief visual memory, eye movement, peripheral awareness and hand–eye coordination. Its “Eye Age” is a game-performance score, not a clinical measurement. [Nintendo's product description](https://www.nintendo.com/en-gb/Games/Nintendo-DS/Sight-Training-Enjoy-Exercising-and-Relaxing-Your-Eyes-272871.html).

There are ten core games and seven sports games. English names and categories were checked against the US manual, printed pages 18–21; mechanics were checked against Nintendo's Japanese instructions. The comparisons below are our interpretation of the current source code. [Official manual](https://csassets.nintendo.com/noaext/image/private/t_KA_PDF/DS_Flash_Focus?_a=DATC1RAAZAA0), [core-game instructions](https://www.nintendo.co.jp/ds/ag3j/trainingmenu/index.html).

| Core game | Basic interaction | Mangekyo comparison |
| --- | --- | --- |
| Box Track | Follow the marked box through shuffling. | Missing identity tracking among distractors. Pursuit follows one visible dot; Follow measures finger control. |
| Letter Count | Count a designated letter in a moving stream. | Missing moving search/counting. Visual discrimination currently presents a stationary target. |
| Number Flash | Recall a briefly displayed number. | No brief-recall task. |
| Circle Spot | Remember the circle's location in a brief array. | No location-memory task. |
| Symbol Order | Recall three C-opening directions in order. | Visual discrimination supplies a similar symbol, but has no ordered recall. |
| C Count | Count Cs with the specified orientation. | No search/count task. Crowding asks about the central symbol, not the distractors. |
| Middle Match | Match surrounding Cs to the central C. | Related symbols; different attention/selection task from Crowding. |
| Fast Match | Judge two briefly shown Cs as same/different. | Related to Visual discrimination; paired comparison/exposure is missing. |
| Box Tap | Tap each square before it disappears. | Close overlap with timed Tap targets. |
| Number Tap | Tap numbered panels in ascending order. | Tap targets lacks the search-and-sequence component. |

The sports games are Baseball, Boxing, Table Tennis, Soccer, Basketball, Volleyball and Football. They are not all interchangeable timing games: for example, Baseball involves timed contact, while Basketball involves recognizing previously visible teammates after they become silhouettes. [Sports instructions](https://www.nintendo.co.jp/ds/ag3j/trainingmenu/sports.html).

Mangekyo's Saccades also overlaps the broad eye-movement theme, although taps cannot verify saccade accuracy. Contrast discrimination and Fine alignment address task families outside Nintendo's five-category framing. Similar branding or stimuli do not make exercises equivalent.

## What the evidence supports

**Direct evidence for the commercial game is limited and mixed.** I did not find a controlled amblyopia-treatment trial of Flash Focus in the sources checked. Searching its regional names matters; studies can call it Sight Training.

- **Hutchinson et al., published online 2015 / journal volume 2016:** a controlled study enrolled 60 nongamers with normal or corrected vision and no eye disease. Only ten participants completed the Sight Training arm. That arm showed no benefit on the untrained Simon response-conflict task. This is a narrow transfer result, not a test of every visual ability or an amblyopia trial. Small groups and attrition limit interpretation. [Primary paper](https://doi.org/10.3758/s13423-015-0912-6).
- **de la Vega Marcos et al., 2015:** 29 college students without vision problems were assigned by availability, rather than randomly, to training (16) or control (13). The authors report an attention benefit but not coordination or anticipation benefits. However, Table 1 lists trained participants' correct answers as 39.13 before and 38.63 afterward, while the discussion describes improvement. That unresolved table/text inconsistency and the nonrandom design weaken the claimed benefit. The table was visually checked in the English PDF, printed page 349. [Primary paper](https://rimcafd.com/revista/revista58/artanalisis577e.pdf).

There is a more relevant **task-family rationale** for search/counting. Hou and Nicholas studied 13 adults with amblyopia using searching/counting and attention cues, with different content delivered to each eye. The lack of an invalid-cue comparison limited attribution to cueing itself. An ordinary phone game would not reproduce that eye-separated protocol. [Primary study, 2022](https://www.nature.com/articles/s41598-022-13747-4).

Motion tracking also appears in amblyopia research. Chow and colleagues found an interocular attention bias in strabismic/mixed amblyopia using eye-separated tracking conditions; the anisometropic group did not show that same bias. This was an assessment study, not evidence that training such a game treats amblyopia. Tuyền's subtype should not be assumed. [Primary study, 2018](https://pubmed.ncbi.nlm.nih.gov/30242356/).

Nintendo's Japanese overview itself distinguishes these activities from improving ordinary stationary visual acuity. That distinction should remain explicit in Mangekyo. [Official overview](https://www.nintendo.co.jp/ds/ag3j/index.html?link=txt).

## Product recommendation

These priorities are design judgments, not clinical efficacy rankings.

1. **Track & find — add first.** Highlight one of three identical objects, move them, stop, and ask which was highlighted. This adds sustained attention and identity tracking with an objectively scorable answer. Start with generous spacing and short trajectories. Adapt tracking duration and speed separately before adding more objects. Accuracy is object-selection accuracy, not gaze accuracy.
2. **Find & count — add alongside it.** Cue an orientation, then ask how many matching symbols appear among distractors. This reuses the symbol renderer while adding a distinct selection task. Begin with large symbols and a few distractors; vary count and similarity independently. Large answer controls avoid making tiny finger targets the limiting factor. This also develops the search/counting proposal already in the research roadmap.
3. **Brief recall — later.** Show a small pattern, cover it, and ask for its location or sequence. Begin with one item. Adjust exposure, delay and memory load separately. It offers variety, but has a less direct amblyopia-specific rationale in the sources reviewed. Brief exposure should not become repeated rapid flashing.

An optional **moving-detail variant** could extend Visual discrimination: identify an opening while the symbol moves. A simple **interception game** could add anticipation and contact timing later. Both would need separate task metrics and usability testing; neither should be labeled a calibrated dynamic-acuity test. Seven elaborate sports adaptations would add more implementation and presentation work than distinct task coverage.

Peripheral matching is a lower priority on a phone. Screen size, viewing distance and uncontrolled fixation constrain interpretation. Without eye tracking, the app cannot confirm central fixation or claim to expand a visual field.

For either initial addition, keep the existing Default/Custom pattern, English/Vietnamese parity, optional confirmation sounds, gentle progression and recoverable sessions. Require several accurate trials before advancing; avoid increasing size, speed, distractor count and exposure demands together. Record the actual conditions so scores remain interpretable. These are proposed balancing rules to test with users, not validated thresholds.

Borrow short rounds, clear goals and satisfying feedback. Keep task-specific history and fixed-condition check-ins instead of adopting “Eye Age.” Completion time, streaks and higher levels remain practice measurements, separate from professionally measured vision. No new practice dose or patching schedule follows from this comparison.

Related: [exercise roadmap](exercise-roadmap.md), [additional amblyopia task research](amblyopia-task-research.md), [adaptive balancing](adaptive-balancing.md).
