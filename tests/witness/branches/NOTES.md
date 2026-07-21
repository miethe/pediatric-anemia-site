# `tests/witness/branches/` — branch-seam pins for `modules/anemia/ranges.js`

Task **EP05-T4** ("Close the M57 class"). These fixtures + `tests/witness/branch-seam.test.mjs`
exist to make every decision branch in the ferritin-threshold selection and the age-band range
selection **uniquely pinned**, so that **a behaviour-changing deletion or reorder of any one of
them fails a test with a readable message.**

**Narrowed in EP05-T5** (the original wording above claimed this held for "any" branch
unconditionally, which is not true): this holds for every branch whose deletion or reorder changes
some fixture's output. It does **not** hold for two branches that are documented, explicit
exceptions — see "Mutations that did NOT fail" below — and it does not by itself guard against
reordering two branches whose *outcomes never overlap on any pinned input* (see the mutually
exclusive branches note below); such a reorder can be invisible to this suite even though it is not
one of the two named exceptions.

They are **synthetic, test-only inputs**. They are not clinical worked examples and not published
(nothing in `scripts/build-static.mjs` copies this directory into `dist/`). They are plain
`assess()` inputs so `scripts/rule-coverage.mjs` can also walk them; the *expectations* live in
`tests/witness/branch-seam.test.mjs`, not in the JSON.

**No new or retuned clinical thresholds.** Every asserted number was read out of
`modules/anemia/ranges.js` and `modules/anemia/reference-ranges.json` as they stand today
(ferritin 20/30; the four AAP2026_IDA age bands and their hb/mcv/rdw limits). The two `localRanges`
values in `ranges-local-override-partial.json` (11.4 / 80.5) are deliberately copied from the
existing adolescent band rather than invented.

**EP5-T6 addition (ARCH §10 condition 2, unrelated to the ferritin/age-band pins above).**
`ferritin-below-supported-age.json` (4 mo) and `ferritin-above-pediatric-range.json` (216 mo) now
also carry `cbc.localRanges.{hbLower,mcvLower,mcvUpper}` (synthetic placeholder values, not read
from any KB band). This is needed ONLY because line 18 above is true — `scripts/rule-coverage.mjs`
feeds every file in this directory through the real `assess()`, and `assess()` now refuses to
produce an assessment (`AgeOutOfSupportedRangeError`) for an age outside
`modules/anemia/module.json`'s `supportedAgeMonths` unless local reference limits are supplied. The
ferritin branch pins these two fixtures exist for are asserted via `branch-seam.test.mjs` calling
`deriveFacts()` directly (never `assess()`), and ferritin-threshold selection does not read
`cbc.localRanges.{hbLower,mcvLower,mcvUpper}` at all — so this addition changes nothing about what
either fixture pins; it only keeps `rule-coverage.mjs`'s walk from throwing.

**Scope of that claim (corrected by the EP05-T5 review).** It covers every *asserted* and every
*threshold-bearing* number — the values these tests pin, and any value chosen to sit on a particular
side of a decision boundary. It does **not** cover the ordinary observational CBC values each
fixture carries to be a coherent patient (RBC, WBC, platelet counts, and Hb/MCV values that no
assertion compares to a bound). Those are synthetic, chosen for internal coherence — notably so the
implied MCHC lands in a physiologic 30–36 g/dL — and are **not** claimed to come from the KB. The
earlier wording implied every number in this directory was KB-derived; it was not, and this
correction is the honest scope.

## Branches enumerated from the code

`ranges.js` delegates band lookup to `src/ranges/registry.js`, so the enumeration covers both.
**19 decision paths** were found:

### `ferritinThresholdRule()` — 5 outcomes

| # | Branch | Result | Pinned by |
|---|---|---|---|
| F1 | `menstruating === true` | 30 / `all menstruating patients` | `ferritin-menstruating-under-adolescent-band.json` (age **120**, ferritin 25) — the verified M57 case |
| F2 | `!Number.isFinite(ageMonths)` early return | `null` | `ranges-age-not-supplied.json` — **behaviourally unpinnable, see below** |
| F3 | `144 <= age < 216` | 30 / `adolescent age band` | `ferritin-adolescent-band-male.json` (168, non-menstruating) + `…-female-not-menstruating.json` (156) |
| F4 | `6 <= age < 144` | 20 / `young or school-aged child` | `ferritin-young-child-band.json` (30 months, ferritin 25 → **not** low) |
| F5 | fall-through (`age < 6` or `age >= 216`) | `null` | `ferritin-below-supported-age.json` (4 mo) and `ferritin-above-pediatric-range.json` (216 mo) |

Branch **order** (F1 before F3) is pinned separately: `getFerritinThreshold(168, true)` must carry
the rationale `all menstruating patients`, not `adolescent age band`. A reorder keeps the *value*
30 and changes only the provenance — exactly the M57 failure mode, so value-only assertions would
miss it.

### Age-band selection — 4 bands × 2 sexes = 8 value paths

`6 to <24 months`, `2 to <6 years`, `6 to <12 years`, `12 to <18 years`, each with a female and a
male column — 8 value paths in total. **All 8 are now pinned** (EP05-T5 closed a gap: only 5 of
the 8 were actually present in `BAND_PINS` as originally delivered — infant-male, preschool-female,
and school-age-male were missing, meaning 3 of the "8 value paths" this section claimed were pinned
were not exercised at all). Pinned by `ranges-band-infant-female`/`-male`,
`ranges-band-preschool-male`/`-female`, `ranges-band-school-age-female`/`-male`, and the two
adolescent fixtures — all four hb/mcv/rdw limits plus `ageBand`, `source: AAP2026_IDA`,
`isFallback: true`, for every band/sex combination. Sex non-collapse is pinned explicitly (female
11.4 vs male 12.4 hbLower at 168 months). The three added fixtures use only values read directly
out of `modules/anemia/reference-ranges.json` — no invented numbers.

### Registry guards — 3 paths

Non-finite age → `null`; unrecognized/absent sex → `null`; age outside every band → `null`
(`ranges-sex-not-supplied.json`, `ferritin-above-pediatric-range.json`, plus direct unit calls).

### `getEffectiveRanges().pick()` — 3 outcomes

Local value wins (`LOCAL_LAB`, `isFallback: false`); built-in fallback (`AAP2026_IDA`,
`isFallback: true`); neither (`value/source/isFallback` all `null`, never a silent default).
`ranges-local-override-partial.json` exercises the first two on the same patient.

### Boundaries

Both sides of every seam are pinned: ferritin ages 5/6, 143/144, 215/216; band ages 5/6, 23/24,
71/72, 143/144, 215/216; and the `<=` comparison in `facts.anemia.js` at 19.9/20/20.1 and
29.9/30/30.1. An off-by-one or a `<`→`<=` flip is the same invisible class as M57.

## Mutation verification — executed, not asserted

Every row below was **actually applied** to the source, run, observed failing, and restored with
`git checkout -- <file>` (restore confirmed by an empty `git diff` on that file).

| Mutation | What was changed | Result | Representative failure message |
|---|---|---|---|
| **M-A (M57)** | delete the `menstruating === true` branch in `ranges.js` | **FAIL** — 2 tests (full suite: 173 pass / 2 fail) | `M57: ferritin threshold for a menstruating 120-month-old must be 30 (menstruating branch of ranges.js). A value of 20 means the` `menstruating === true` `branch was deleted or reordered below the age bands.` → `20 !== 30` |
| M-B | delete the adolescent-band branch | **FAIL** — 3 tests | `null !== 30`; `just below the 30 threshold → low: null !== true` |
| M-C | delete the young-child branch | **FAIL** — 5 tests | `a non-menstruating 30-month-old must resolve 20 via the young-or-school-aged-child branch of ranges.js: null !== 20` |
| M-D | move the menstruating branch *below* the age bands (value survives, rationale changes) | **FAIL** — 1 test | `the menstruating branch must be evaluated before the age bands; an "adolescent age band" rationale here means the branches were reordered` |
| M-E | off-by-one: adolescent floor `>= 144` → `>= 143` | **FAIL** — 1 test | `age 143 months is the last young-child month → 20: 30 !== 20` |
| M-F | swap the female/male columns in `unpackBands()` | **FAIL** — 7 tests | `ranges-band-infant-female: mcvLower must be 73.3: 71.1 !== 73.3` |
| M-G | drop the `LOCAL_LAB` precedence line in `pick()` | **FAIL** — 1 test | `a supplied local hbLower must win over the built-in band: + 'AAP2026_IDA'` |
| M-I | delete the sex guard in `src/ranges/registry.js` | **FAIL** — 2 tests | `missing sex → null` (an object was returned); `builtInAgeBand: + '6 to <12 years'` |

M-A was additionally run through **`npm test` itself** (see the wiring status below) with the glob
temporarily widened: exit code **1**, `# fail 4` (2 of them mine, 2 from a parallel task's in-flight
file). `package.json` was restored immediately afterwards and is unmodified in the final state.

### EP05-T5: an additional reorder that is genuinely invisible to this suite — reported, not fixed

The ferritin branch order is `menstruating` → `adolescent-band (144–<216)` → `young-child-band
(6–<144)` → fall-through `null`. `M-D` above proves the `menstruating` branch's position relative
to the two age bands is pinned (a menstruating adolescent satisfies both the menstruating and the
adolescent-band conditions, so their relative order is observable). **The adolescent-band and
young-child-band branches, however, are mutually exclusive on age — no `ageMonths` value can ever
satisfy both `>= 144 && < 216` and `>= 6 && < 144` simultaneously.** Swapping the order of just
those two `if` statements (leaving the menstruating check and the fall-through where they are)
therefore changes NOTHING for any input at any age: every age still resolves to the same value via
whichever branch it was always going to satisfy. This was reasoned through rather than executed as
a mutation (running it would be a no-op by construction, so there is nothing to observe) — it is
recorded here as a second, distinct example of a reorder this suite cannot see, alongside the two
mutations below, and it is why the headline claim at the top of this file is stated as "a
*behaviour-changing* deletion or reorder," not "any deletion or reorder."

### Mutations that did NOT fail — the stated exception to this file's headline claim

Reported rather than faked. **These two mutations are the explicit, acknowledged exception to
"every branch is uniquely pinned":** both are **behaviourally redundant defensive guards** — deleting
either produces byte-identical output for every input, because the numeric comparisons that follow
are already `false` for `NaN`/`undefined`. No fixture can pin them because there is no observable
difference to pin; a test that claimed to distinguish them would be testing something else. This is
not a gap in fixture authorship — it is a structural fact about the current code that this corpus
records rather than papers over.

| Mutation | What was changed | Result | Why unpinnable |
|---|---|---|---|
| **M-H** | delete `if (!Number.isFinite(ageMonths)) return null;` from `ferritinThresholdRule()` | 20/20 still **pass** | With a non-finite age, `ageMonths >= 144` and `ageMonths >= 6` are both `false`, so the function falls through to the same `return null`. The guard is documentation, not behaviour. |
| **M-J** | weaken the registry guard from `!Number.isFinite(ageMonths) \|\| !sexOk` to `!sexOk` | 20/20 still **pass** | `bands.find()` with a `NaN` age matches nothing, so the lookup returns `null` by a different route. |

No test can distinguish these; a test that appeared to would be testing something else. They are
safe-by-redundancy today, but that redundancy is *load-bearing and undeclared* — if a future band
table ever gained an open-ended or non-numeric bound, deleting either guard would stop being
harmless. Worth a comment in the source (out of scope for this task: `modules/` and `src/` must not
be modified here).

## Wiring status: `npm test` / `npm run check` DO run these pins (resolved)

**Update (EP05-T5):** this section previously warned that `npm test`'s glob
(`node --test tests/*.test.mjs`) was top-level-only and did not discover
`tests/witness/branch-seam.test.mjs`, so these pins ran only when invoked directly and were not yet
a real CI gate. **That has since been fixed by the orchestrator.** `package.json`'s `"test"` script
is now `node --test tests/*.test.mjs tests/witness/*.test.mjs`, so `npm test` and `npm run check`
execute every pin in this file alongside `tests/witness/alerts.test.mjs` and
`tests/witness/corpus.test.mjs`. Verified directly: this file's subtests appear by name in the
`npm test` run log. (A specific total is deliberately not quoted here — it changes whenever any test
is added, and a stale number in this document is exactly the defect the EP05-T5 review caught.) This
guard is no longer something that has to be remembered and run manually — a regression here now fails
`npm run check` the same way any other test failure does.

All mutation results in the table above were additionally obtained by running the suite explicitly
(`node --test tests/*.test.mjs tests/witness/*.test.mjs`), and M-A additionally through a real
`npm test` run with the glob temporarily widened and then restored, before the glob fix landed
permanently.
