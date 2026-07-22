# EPR1-T4 — No-clinical-change proof (FR-WP1-04)

**Task**: Phase EP-R1, EPR1-T4. **Claim under proof**: adding rights metadata for
`modules/anemia/reference-ranges.json` (EPR1-T1) and the bidirectional `KB_JSON_FILES` coverage gate
(EPR1-T2, EPR1-T3) changed **zero** clinical output — no threshold, no derived fact, no rule firing.

This is a verification task, not a code task: no code or clinical-data change was expected or made.
The four checks below are the plan's stated acceptance criteria, run against the tip of this branch
after EPR1-T1/T2/T3 landed.

## 1. Golden-fixture equivalence — all 6 examples, zero diff

`tests/module-equivalence.test.mjs` (a permanent fixture of `npm test` since the platform-foundation
P0 refactor) diffs `assessPediatricAnemia()` output for every `examples/*.json` worked example
against the corresponding `tests/golden/*.json` fixture captured before that refactor. It covers all
6 examples on the branch: `anemia-inflammation`, `beta-thalassemia-trait`, `hemolysis-hs`,
`ida-toddler`, `lead-capillary`, `marrow-red-flags`.

```
$ npm test
...
# tests 1093
# pass 1093
# fail 0
# cancelled 0
```

All 6 `module equivalence: <name> matches golden fixture` subtests pass — zero output diff (deep-equal
modulo the scrubbed `meta.generatedAt` timestamp, the harness's documented normalization).

## 2. `reference-ranges.json` and `facts.anemia.js` are byte-unchanged

Diffed against `fa50ac8` — the merge-base with `main`, i.e. the state of the repo before any EP-R0..
EP-R1 rights-feature commit landed:

```
$ git diff fa50ac8 HEAD -- modules/anemia/reference-ranges.json modules/anemia/facts.anemia.js
(empty)
```

SHA-256 confirms byte-identity directly (not just a no-op diff):

| File | fa50ac8 | HEAD |
|---|---|---|
| `modules/anemia/reference-ranges.json` | `799ac702b99a2288e9c1810178eb5623d8f7575cffda9f20aed66b3ac9ace062` | same |
| `modules/anemia/facts.anemia.js` | `deeacb9c71d41b971dd67a689ee3e273a6e31ac5c53399f63eed1f3c93a450bd` | same |

The same zero-diff also holds for the rest of the derived-fact/rule pipeline that the golden-fixture
harness exercises — `modules/anemia/rules.json`, `modules/anemia/candidates.json`, `src/facts.js`,
`src/ruleEngine.js`, `src/engine.js` — confirming the rights-metadata work (rights records + coverage
gate) touched only the new `rights/` tree, `scripts/validate-kb.mjs`, `scripts/validate-rights.mjs`,
and test files, never a clinical file.

## 3. `npm run coverage:rules` still reports 91/91

```
$ npm run coverage:rules
...
Rule activation coverage: 91/91 (100.0%)
```

Unchanged rule count, unchanged 100% activation-witness coverage — no rule was added, removed, or
made unreachable.

## 4. `npm run validate` still green (coverage-shaped, not affected by this proof)

```
$ npm run validate
Validated modules: anemia (91 rules, 26 candidates, 6 evidence records, 41 passage records).
anemia: rule sourcePassageId status split — 0 source-supported, 0 quarantined, 91 implementation-proposal.
anemia: candidate sourcePassageId status split — 0 source-supported, 0 quarantined, 26 implementation-proposal.
build-evidence-pack --check: modules/anemia/evidence.json matches regenerated output (6 sources, 41 passages).
validate-rights: 5 gate(s) passed (10 clinical identifier(s), 7 rights record(s), 3 rights failure(s)).
```

## Conclusion

All four of FR-WP1-04's acceptance signals hold simultaneously at this commit:

- [x] Golden-fixture output shows zero diff across all 6 examples.
- [x] `git diff` shows `modules/anemia/reference-ranges.json` unmodified (byte-identical, hash-confirmed).
- [x] `modules/anemia/facts.anemia.js` unmodified (byte-identical, hash-confirmed).
- [x] `npm run coverage:rules` still reports 91.

No new gate or test was added for this task: the golden-fixture equivalence harness that proves this
already exists as a permanent, committed part of `npm test` (from the platform-foundation-p0
refactor), and it already runs on every `npm run check`. This task's contribution is the point-in-time
verification record above, not new infrastructure — per D7, this is a coverage/consistency-shaped
proof, not a clearance gate, and no `CLEARED_*`, `approvedBy[]`, `clinicalApprovers[]`, or
authoritative `derived_synthesis` value was written anywhere in this task.
