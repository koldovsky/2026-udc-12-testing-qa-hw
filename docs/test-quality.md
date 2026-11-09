# Test quality: coverage versus mutation testing

## 1. Before: coverage and mutation score

| Metric | Before | Evidence |
|---|---|---|
| src line coverage, unit tests only | 96.36% | ai-runs/c-before.txt, all files |
| Mutation score, unit + spec | 89.2% | ai-runs/c-before.txt, total |
| Killed / survived / timeout | 74 / 9 / 0, out of 83 | ai-runs/c-before.txt |
| Executed mutation-suite tests / static assert call sites | 72 / 59 | ai-runs/c-before.txt header |

Line coverage shows which source lines executed; it does not show that their results were checked correctly.
The mock-only fare test and the weak daily-cap assertion execute code or fixtures without detecting many wrong prices.
Mutation testing asks whether a deliberate code change makes a test fail; surviving mutants can expose weak checks, equivalent code, or unspecified behavior.

## 2. Test smells: participant-side inventory before AI review

The initial inventory was written before the independent AI smell run; line numbers below are corrected against the post-B baseline.

| Smell | Baseline file:line / test | Why | AI found? |
|---|---|---|---|
| Weak ledger oracle | app/test/unit/day-cap.test.js:8 / charges recorded for a day | Any reduction passes; exact 18000 unchecked | Yes, c-smells row 1 |
| Weak fare oracle | app/test/unit/tariff.test.js:17 / itemised price | Nonnegative wrong fare passes | Yes |
| Mirrored implementation | app/test/unit/tariff.test.js:32 / ebike rate | Imports production rate/block constants | Yes |
| Weak subscription oracle | app/test/unit/tariff.test.js:45 / long ebike subscription | Any discount and decrease pass | Yes |
| Weak night oracle | app/test/unit/tariff.test.js:61 / night | Exact 1750 unchecked | Yes |
| Collection length only | app/test/unit/tariff.test.js:66 / both fees | Wrong codes/amounts can pass | Yes |
| Weak daily cap oracle | app/test/unit/tariff.test.js:76 / daily cap | Even uncapped 12000 is <=30000; expected third charge is 6000 | Yes |
| Mocking SUT | app/test/unit/tariff.test.js:80 / 45-minute classic fare | Mock returns 5000; quote never called | Yes |
| Weak receipt oracle | app/test/unit/receipt-format.test.js:19 / every item | Count and substring do not prove full receipt | Yes |

AI additionally identified nondiscriminating date inputs, incomplete HTTP assertions, and weak table diagnostics (ai-runs/c-smells.md).
Qualified disagreement: bundling GET page and health is a small diagnostic drawback, not by itself an invalid functional test; priority is below incorrect monetary oracles.
Smells are recorded even when stronger spec tests now protect the same behavior; not every old smoke test needs to become the sole acceptance oracle.

## 3. Independent AI strengthening and review

The fresh agent ran the exact strengthen prompt in a complete working snapshot with its own git baseline; root commit approval was pending.
Full answer: ai-runs/c-strengthen.md; complete generated app/tools/package diff: ai-runs/c-strengthen.diff.
The only generated change was the new app/test/unit/tariff-boundaries.test.js; no source, mutation tool or configuration changes.

| Metric | Before | Raw AI after | Reviewed retained suite |
|---|---|---|---|
| Mutation score | 89.2% | 97.6% | 95.2% |
| Killed / survivors / timeout | 74 / 9 / 0 | 81 / 2 / 0 | 79 / 4 / 0 |
| Mutation-suite tests | 72 | 81 | 81 |
| Static assert call sites | 59 | 69 | 73 |
| Unit-only src line coverage | 96.36% | 97.27% | 97.27% |
| Evidence | c-before.txt | c-after.txt | c-reviewed.txt |

These are three different preserved measurements, not replacements of an earlier output.
The full application has 83 tests; mutation runs exclude the two integration tests by configuration.

### Audit: removed, skipped, weakened or unsupported checks

The agent added nine tests and deleted/skipped/weakened zero existing tests; no existing expected value was changed in its diff.
Evidence: c-strengthen.diff:1-79 is one new-file hunk; there are no removed test lines, source/tool hunks, skip or todo additions.

| Finding | Original diff line | Decision |
|---|---|---|
| Night ride assumes no zero-value discount row | c-strengthen.diff:39-45, deepEqual discounts=[] | Reject the presentation assumption: Q-4 is unresolved; retain exact minutes/base/total checks |
| Exact allowance assumes no zero-value cap row | c-strengthen.diff:48-55, deepEqual discounts=[] | Reject only the zero-row assumption; retain exact charge, recorded balance and remaining allowance |
| Null ride exact QuoteError | c-strengthen.diff:71-72 | Retained and labelled API characterization, not product-price acceptance; source documents ride shape, exact error class is not a product rule |
| Offset-less timestamp exact QuoteError | c-strengthen.diff:75-77 | Retained and labelled API characterization; explicit-offset API convention is separate from approved pricing rules |

Participant review intentionally made two new aggregate assertions less prescriptive about undefined presentation; no baseline test was removed or weakened.
The original generated checks remain verbatim in c-strengthen.diff; the reviewed file and c-reviewed.txt show the retained behavior.
A higher raw score is not a reason to invent a product policy.

## 4. Surviving-mutant investigation

Strict rubric exception: c-after.txt has only two survivors, so selecting five distinct survivors from that file is impossible.
Both are assessed below; five additional survivors from c-before.txt were killed and the after run proves their disappearance.
This is disclosed rather than fabricating five after-run survivors or weakening tests to create them.
After rejecting the unsupported zero-row assertions, two additional survivors reappear in c-reviewed.txt and remain explicit specification questions.

| Mutant | Source location | Change | Evidence and verdict |
|---|---|---|---|
| M016 | app/src/tariff.js:47:21 | threshold 0 to 1 | Survives raw and reviewed after; equivalent for documented inputs: positive plan savings are multiples of 50, minimum 800; no saving of exactly 1 is reachable from fixed 2500/4000 rates and 20/50 percent plans |
| M019 | app/src/tariff.js:50:13 | threshold 0 to 1 | Survives raw and reviewed after; equivalent for documented inputs: before night/cap, positive time due is a multiple of 50, minimum 1250; ledger allowance is applied later, so custom allowance cannot create due=1 here |
| M024 | app/src/tariff.js:58:51 | cap discount subtraction to addition | Before survivor, killed after: tariff-boundaries.test.js / T6,T7 cap discount itemization checks 1500, not 3500; absent from c-after.txt and c-reviewed.txt |
| M030 | app/src/tariff.js:69:42 | 60000 to 60001 | Before survivor, killed after: millisecond-beyond-boundary rows expect 3 and 31 minutes; absent after |
| M064 | app/src/tariff.js:115:13 | invalid-ride guard OR to AND | Before survivor, killed after by API null-ride QuoteError characterization; absent after; this kill measures API exception behavior, not fare correctness |
| M066 | app/src/tariff.js:118:16 | returned < pickup to <= | Before survivor, killed after by T1 zero elapsed-time free ride; absent after |
| M075 | app/src/tariff.js:131:33 | timestamp guard OR to AND | Before survivor, killed after by API offset-less input tests; absent after; API contract kill only |
| M018 | app/src/tariff.js:50:11 | due > 0 to >= 0 | Raw AI killed it by asserting omission of a zero night row; reviewed suite lets it survive. Monetary results unchanged, discount array/receipt can differ; not claimed equivalent: Q-4 needs a product decision |
| M023 | app/src/tariff.js:57:11 | due > allowance to >= | Raw AI killed it by asserting omission of zero cap row; reviewed suite lets it survive. Same money, potentially extra receipt row; not claimed equivalent: Q-4 |

Equivalence claims are restricted to valid plain documented ride/rider inputs and the fixed production tariffs, not arbitrary injected JavaScript objects/getters or changed rates.
All locations are from the unchanged post-B production code, so IDs remain stable across these runs.
No repeated mutation run is claimed to have resolved Q-4; its specification gap remains visible.

## 5. Rules for the agent

File: app/AGENTS.md, section ## Тести; 11 rules.

| Rule | Finding that motivated it |
|---|---|
| Spec-based price expectations | A1 electric/free-start/fee/date errors, docs/test-cases.md |
| Missing oracle => no price assertions | B1 captured 8 defective-behavior tests, docs/bugs/README.md |
| Separate named boundary rows | BUG-1/BUG-2 fractional and inclusive boundaries |
| Exact amounts/items | Weak cap and fee-length checks in section 2 |
| Real SUT | Mock-only 45-minute fare test |
| Fixed instants and isolated ledgers | BUG-5 Kyiv date; CI-1141 elapsed offsets |
| Questions instead of undefined policies | A1 night assumptions; C zero-row assumptions |
| Do not weaken checks to go green | Three old unit tests required spec-backed corrections in Task B |
| Do not change mutation targets/tools | Full generated diff audit, section 3 |
| Deterministic cases, no retries/sleeps | Receipt flaky oracle, docs/triage.md |
| Distinguish API from product acceptance | B1 exact error/schema contracts; C API guard mutants |

## 6. Fresh run with rules

The exact B1 prompt was reused against original-main app/src plus participant rules, deliberately without the specification.
Answer: ai-runs/c-with-rules.md; verbatim tests: ai-runs/c-with-rules/*.test.js; repeat against fixed branch: ai-runs/c-with-rules-run.txt.

| Comparison | Without rules | With rules |
|---|---|---|
| Test count | 48 | 18 |
| Original snapshot | 48 pass,0 fail | 18 pass,0 fail |
| Product-price assertions | Includes current defective behavior | None; explicitly reports missing specification |
| Date assumptions | UTC date asserted near midnight | Avoids disputed date boundary in ledger API cases |
| Fixed-code repeat | 8 fail,40 pass | 18 pass,0 fail |
| Claims | Characterizes behavior as expectations | Clearly states API/ledger bookkeeping only |

Rules 1/2/7/11 appear to have changed scope and disclosure; this is a single descriptive experiment, not statistical proof of causation.
The with-rules agent could not validate product tariffs without the oracle and did not claim it had.
