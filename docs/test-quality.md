# Test quality: coverage versus mutations

Task C. Every number comes from `ai-runs/c-before.txt` and `ai-runs/c-after.txt` unless a
row names another command.

## 1. Before: line coverage and mutation score

| Measure | Value | Source |
|---|---|---|
| Line coverage of `src/` (`npm run coverage`, `app/test/unit/` only) | 96.36 % (branches 81.91 %) | `ai-runs/c-before.txt`, row `all files` |
| Mutation score (`npm run mutate`, `app/test/unit/` + `app/test/spec/`) | 91.6 % | `ai-runs/c-before.txt`, row `разом` |
| Mutants: killed / survived / timeout | 76 / 7 / 0 of 83 | `ai-runs/c-before.txt`, row `разом` |
| Tests / assert calls | 131 / 45 | `ai-runs/c-before.txt`, header `тести:` |
| Mutation score of `app/test/unit/` alone | 61.4 % (51 killed, 32 survived of 83; 18 tests, 37 assert calls) | `node tools/mutate.mjs --config <copy of tools/mutate.config.json with "tests": ["test/unit"]>` |

The assert count is a static count of `assert` calls in `*.test.js` files
(`tools/mutate.mjs:348`). The three calls in `app/test/spec/support.js`, which every spec test
goes through, are not counted, so 8 of the 45 calls belong to `app/test/spec/`.

What the difference means. Line coverage counts the lines of `src/` that the unit tests
executed, not what they checked: the 18 unit tests execute 96.36 % of the lines, but they
notice only 51 of the 83 mutants (61.4 %). The 91.6 % of the configured run comes mostly
from the 113 tests in `app/test/spec/` written from the specification in Task B, which give
exact expected amounts. A line that a test executes without checking its result counts as
covered and still lets a mutant survive.

## 2. Test smells in `app/test/unit/`

The participant's list first. The evidence column is a sabotage check: the source file was
changed in a scratch copy of `app/` outside the repo, `node --test test/unit/<file>` was run
there, and the named test stayed green. The repo's `app/src/` was not touched.

| # | Smell | Test (file:line › name) | Why it is a problem | Evidence | AI found? |
|---|---|---|---|---|---|
| 1 | Weak assertions (type and sign checks only) | `app/test/unit/tariff.test.js:9` › `quote returns an itemised price` | Lines 17–20 check `total >= 0`, two `Array.isArray` and `typeof minutes`. No amount is checked, so any price passes. The test executes most of `quote` and raises coverage without checking it. | `return { …, total: timeCharge }` (all discounts and fees ignored): test green | yes, AI #4 |
| 2 | Tautological expected value (the oracle repeats the code) | `app/test/unit/tariff.test.js:30` › `e-bikes are billed at the e-bike rate` | Line 32 computes the expected value with the code's own formula and constants, `Math.ceil(result.minutes / BLOCK_MINUTES) * RATES.ebike`, and takes `minutes` from the result under test. A wrong block length or a wrong T1 rounding changes both sides. The spec gives 75 min → 3 blocks → 12000 (`docs/spec/tariffs.md:70`). | `BLOCK_MINUTES = 20`: test green. `Math.ceil` → `Math.floor` in `rideMinutes`: test green | yes, AI #3 |
| 3 | Testing the mock, not the code | `app/test/unit/tariff.test.js:79` › `a 45-minute classic ride costs 50 UAH` | `quote` is never called. The test calls `priceRide`, a `mock.fn` that returns a hard-coded 5000, and asserts that it returned 5000 and was called once. It cannot fail whatever `src/` does. | `RATES.classic = 5000` (double price): test green, while 3 other tests in the file go red | yes, AI #1 |
| 4 | Assertion that cannot fail | `app/test/unit/tariff.test.js:69` › `the daily cap limits the time charge` | Line 76 checks `last.total <= DAY_CAP`. The third 80-min e-bike ride costs 12000 without any cap, and 12000 ≤ 30000, so the assertion holds with the cap removed. The spec example says the third ride costs 6000 (`docs/spec/tariffs.md:105-106`). Only the last of three results is checked. | `if (due > allowance)` → `if (false)` (no cap at all): test green | yes, AI #2 |
| 5 | Weak assertion (direction instead of amount) | `app/test/unit/tariff.test.js:55` › `night rides get 30 % off` | Line 61 checks `total < timeCharge`. Any discount passes, although the name promises 30 %. The spec gives 1750 for this exact ride (`docs/spec/tariffs.md:143`). | `NIGHT_PERCENT = 10`: test green | yes, AI #8 |
| 6 | Weak assertions, name without an expected result | `app/test/unit/tariff.test.js:43` › `subscription on a long e-bike ride` | Lines 45–46 check that a `subscription` discount exists and that `total < timeCharge`. The name says what is set up, not what should happen. 100 min on an e-bike is 4 blocks = 16000, 20 % off → 12800 (`docs/spec/tariffs.md:62, 67, 76`). | subscription e-bike discount 20 % → 1 %: test green | yes, AI #7 |
| 7 | Count-only assertion | `app/test/unit/tariff.test.js:64` › `a bike kept over a day and left outside the zone pays both fees` | Line 66 checks `fees.length === 2`. Neither the fee codes nor the amounts (15000 and 200000, `docs/spec/tariffs.md:112, 120`) are checked. | `UNRETURNED_FEE = 2000` (1 % of the fee): test green | yes, AI #9 |
| 8 | Magic numbers, order-dependent index | `app/test/unit/tariff.test.js:49` › `reduced fare for a ride returned outside the zone` | Lines 51–52 assert 17500 and `fees[0].amount === 15000` with no source for either number, and `fees[0]` assumes the fee order without checking the fee code. These expected values were wrong in `main` (7500 and 10000) and were changed in Task B, commit `3234a10` (`docs/bugs/README.md:157-163`). | `git diff main -- app/test/unit/tariff.test.js` | no: AI #14 flags this test as a Mystery Guest, not for its numbers |
| 9 | Weak assertion | `app/test/unit/day-cap.test.js:5` › `charges recorded for a day reduce what is left of the cap` | Line 8 checks `remaining < DAY_CAP`. Any recorded amount above zero passes; the exact remainder is 30000 − 12000 = 18000. | `record` adds `amount / 2`: test green | yes, AI #5 |
| 10 | Test data that cannot tell the cases apart | `app/test/unit/day-cap.test.js:11` › `the day of a ride is the date of its pickup` | `2026-09-16T08:00:00Z` is 11:00 in Kyiv, the same date in UTC and in Kyiv. The code in `main` used the UTC date (`git show main:app/src/day-cap.js`, line 7), BUG-5, and this test was green before and after the fix. The spec books a ride on its Kyiv date (`docs/spec/tariffs.md:101-102`); `2026-09-16T21:30:00Z` is 00:30 on 17.09 in Kyiv. | `dayKey` returns the UTC date: test green | yes, AI #6 |
| 11 | Partial assertion | `app/test/unit/receipt-format.test.js:11` › `a receipt has a line for every item` | Lines 19–20 check the number of lines and that the last one contains `185,00`. The labels, the minus sign of the discount line and the fee line are not checked (`docs/spec/tariffs.md:133-135`). | fee line printed as `? … -150,00 грн`: test green | yes, AI #10 |
| 12 | Hidden cases in a loop; boundary not tested | `app/test/unit/tariff.test.js:36` › `subscribers ride the first 45 minutes free on a classic bike, an e-bike gets 20 % off` | Two cases run in one `for` loop, and a failure does not say which bike failed. The name states the 45-minute boundary, but the ride is 40 min, so 45 and 46 min are never tested (`docs/spec/tariffs.md:74-75`). | mutant M005 `45 → 46` survives the unit-only run (section 1, last row) | yes, AI #11 |
| 13 | Eager test | `app/test/unit/server.test.js:29` › `GET / serves the page and GET /api/health answers` | Two endpoints in one test: if `GET /` fails, `GET /api/health` is not checked at all. The status code of the health answer is not checked. | `app/test/unit/server.test.js:29-36` | yes, AI #12 |

The AI's answer (`ai-runs/c-smells.md`) lists 14 smells. It found 12 of the 13 above, with the
same reasons and the same exact expected values (6000, 1750, 12800, 18000). It missed #8: it
flags that test for another reason. Two of its additions are kept as true but minor:
`includes("185,00")` in `receipt-format.test.js:20` also matches `1 185,00` and `-185,00`
(its #10), and `server.test.js:49` does not check the error text.

What the AI called a smell and the participant disagrees with:

| AI # | What the AI says | Why the participant disagrees |
|---|---|---|
| 14 | Mystery Guest: `tariff.test.js:49` relies on the real station table, where `X01` is out of the zone | A Mystery Guest is a hidden external resource, such as a file or a database row. `X01` and its zone are product data defined by the spec (`docs/spec/tariffs.md:174`), and the test checks T7 against the station table that production uses. A fake table passed through `zones` would no longer check that data. |
| 13 | Assertion Roulette: three `formatUah` cases in `receipt-format.test.js:5` | `node:assert/strict` reports the failing line with the actual and the expected value, so it is always clear which case failed. All three cases check one function and one rule (T9), so they are one behaviour. |
| 8 (second half) | Magic data: without a comment about Kyiv it is not clear why the ride in `tariff.test.js:55` is a night ride | The comment is there: `tariff.test.js:56`, `// 01:10–01:40 in Kyiv`. The AI quotes it in the same sentence. |

## 3. The AI strengthens the tests

Pending.

## 4. Surviving mutants

Pending.

## 5. Testing rules for the agent

Pending.

## 6. Re-run with the rules

Pending.
