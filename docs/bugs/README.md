# Red tests and defects

## Classification of every pre-fix red test

B1: 48 pass, 0 fail (ai-runs/b1-run.txt), so no B1 red-test rows.
B2: 74 tests, 66 pass, 8 fail (ai-runs/b2-run.txt), every red test listed below.

| Test in app/test/spec/tariffs.test.js | Run | Class | Evidence | Action |
|---|---|---|---|---|
| T1: TC-01 (1801s) | B2 | Code defect | ai-runs/b2-run.txt: 30 vs 31 minutes; docs/spec/tariffs.md:45-47 | BUG-1 |
| T2: TC-04 (119s) | B2 | Code defect | ai-runs/b2-run.txt: 2500 vs 0; docs/spec/tariffs.md:54-55 | BUG-2 |
| T2: TC-05 (120s) | B2 | Code defect | ai-runs/b2-run.txt: 2500 vs 0; docs/spec/tariffs.md:54-55 | BUG-2 |
| T2: TC-06 (121s) | B2 | Code defect | ai-runs/b2-run.txt: 2 vs 3 minutes; docs/spec/tariffs.md:45-47 | BUG-1 |
| T4: TC-16 (2400s) | B2 | Code defect | ai-runs/b2-run.txt: subscription 8000 vs 1600; docs/spec/tariffs.md:76-77 | BUG-3 |
| T5,T7: TC-22 (2400s) | B2 | Code defect | ai-runs/b2-run.txt: fee 7500 vs 15000; docs/spec/tariffs.md:86-87 | BUG-4 |
| T5,T8: TC-23 (90000s) | B2 | Code defect | ai-runs/b2-run.txt: fee 100000 vs 200000; docs/spec/tariffs.md:86-87 | BUG-4 |
| T6: TC-26 midnight starts a new Kyiv-day allowance | B2 | Code defect | ai-runs/b2-run.txt: 2026-09-16 vs 2026-09-17; docs/spec/tariffs.md:100-103 | BUG-5 |

No pre-fix canonical failure was classified as a false test or specification gap; ambiguous questions were excluded in Task A.
The preliminary shared-context B2 run also had these eight failures; it is retained for provenance, not counted twice.
A separate baseline/current run hit the random receipt failure; it is deferred to Task D, not treated as a pricing source defect.

## Source defects

| ID | Rule | Problem | Found by code-derived tests? | Found by spec tests? | Fix commit |
|---|---|---|---|---|---|
| BUG-1 | T1 | Round instead of ceil | No | Yes | ae765e1 |
| BUG-2 | T2 | Two minutes billed | No | Yes | c7be405 |
| BUG-3 | T4 | Electric free minutes | No | Yes | 8d46577 |
| BUG-4 | T5 | Discounts fees | No | Yes | 2a8e875 |
| BUG-5 | T6 | UTC ledger date | No | Yes | 89398f0 |

Individual reports include repeatable original-main and fixed results.

## Existing tests corrected after fixes

| Existing unit test | Old assertion | Oracle | Correction |
|---|---|---|---|
| tariff.test.js / a ride of 30 min 20 s is billed as one block | 30 minutes,2500 | spec:45-47 | 31 minutes,5000; name updated |
| tariff.test.js / subscribers ride the first 45 minutes free | classic and ebike both 0 at 40 min | spec:74-77 | classic=0; ebike=6400; both still checked |
| tariff.test.js / reduced fare for a ride returned outside the zone | fee=7500,total=10000 | spec:86-87,111-112 | fee=15000,total=17500 |

No baseline test was deleted or skipped; these checks retain precise expected values.
The preliminary newly authored spec suite was archived verbatim under ai-runs/shared-context/b2-tariffs.test.js and replaced with the fresh B2 suite covering the same 43 case IDs; no baseline test was removed.

## Unchanged code-derived tests after fixes

ai-runs/b1-rerun.txt: 48 tests,40 pass,8 fail; their files are immutable records, excluded from npm test.

| File under ai-runs/b1-from-code | Test | What it asserted | Defect captured |
|---|---|---|---|
| day-cap.test.js | day keys use the UTC date of an instant | UTC instead of Kyiv | BUG-5 |
| day-cap.test.js | equivalent offsets address the same ledger entry | Checks chargedOn UTC date; equivalent instants themselves remain equivalent | BUG-5 |
| tariff.test.js | classic duration 1.49 minutes gives charge 0 | Total 0 is correct, but deepEqual embeds wrong rounded minutes 1 | BUG-1 |
| tariff.test.js | classic duration 1.5 minutes gives charge 2500 | Bills the free-start boundary | BUG-2 |
| tariff.test.js | classic duration 2 minutes gives charge 2500 | Bills inclusive free-start boundary | BUG-2 |
| tariff.test.js | classic duration 30.49 minutes gives charge 2500 | Rounds duration down at block edge | BUG-1 |
| tariff.test.js | subscriber ebike 46 minutes | Deducts free minutes before percentage | BUG-3 |
| tariff.test.js | reduced plan halves time charge and fees | Halves fixed fee | BUG-4 |

## Numbers

- Defects found by code-derived tests: 0.
- Defects found by specification tests: 5.
- Code-derived tests that preserved a defect and turned red after fixes: 8.
- Tests failing for the first time because an expectation depends on unresolved spec policy: none in canonical B2.
