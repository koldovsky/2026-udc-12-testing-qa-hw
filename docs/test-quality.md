# Test quality: coverage versus mutations

Task C. Every number comes from `ai-runs/c-before.txt` and `ai-runs/c-after.txt` unless a
row names another command. The commands in `docs/evidence/task-c-check.mjs` work on a
temporary copy of `app/` and never touch the repo's files.

## 1. Before: line coverage and mutation score

| Measure | Value | Source |
|---|---|---|
| Line coverage of `src/` (`npm run coverage`, `app/test/unit/` only) | 96.36 % (branches 81.91 %) | `ai-runs/c-before.txt`, row `all files` |
| Mutation score (`npm run mutate`, `app/test/unit/` + `app/test/spec/`) | 91.6 % | `ai-runs/c-before.txt`, row `разом` |
| Mutants: killed / survived / timeout | 76 / 7 / 0 of 83 | `ai-runs/c-before.txt`, row `разом` |
| Tests / assert calls | 131 / 45 | `ai-runs/c-before.txt`, header `тести:` |
| Mutation score of `app/test/unit/` alone | 61.4 % (51 killed, 32 survived of 83; 18 tests, 37 assert calls) | `node docs/evidence/task-c-check.mjs unit-mutants`, output below |

`node docs/evidence/task-c-check.mjs unit-mutants` runs `tools/mutate.mjs` on `app/` from commit
`6c85f02` with the same targets and only `test/unit` as the suite. The lines this section uses:

```text
  тести:  app/test/unit — файлів: 4, тестів: 18, пропущено: 0, todo: 0, викликів assert: 37
app/src/tariff.js         76        49        27         0    64.5 %
app/src/day-cap.js         7         2         5         0    28.6 %
разом                     83        51        32         0    61.4 %
  M005  app/src/tariff.js:21:42     45 → 46                     export const SUBSCRIPTION_FREE_MINUTES = 45;
```

The assert count is a static count of `assert` calls in `*.test.js` files
(`tools/mutate.mjs:348`). The three calls in `app/test/spec/support.js`, which every spec test
goes through, are not counted, so 8 of the 45 calls belong to `app/test/spec/`.

What the difference means. Line coverage counts the lines that the unit tests executed, not
what they checked. The 96.36 % covers all six files of `src/`; on the two files that are mutated
the gap is wider. The unit tests execute 96.67 % of the lines of `day-cap.js` and notice 2 of its
7 mutants (28.6 %), and 98.53 % of `tariff.js` while noticing 49 of its 76 mutants (64.5 %). The
91.6 % of the configured run comes mostly from the 113 tests in `app/test/spec/`, written from the
specification in Task B with exact expected amounts. A line that a test executes without
checking its result counts as covered and still lets a mutant survive.

## 2. Test smells in `app/test/unit/`

The participant's list first. The evidence column is a sabotage check: the source file is
changed in a temporary copy of `app/` from commit `6c85f02`, the named test is run on its own,
and it stays green. `node docs/evidence/task-c-check.mjs sabotage` repeats all eleven checks
and ends with `every result as in docs/test-quality.md`.

Line numbers in this section and in the rule table of section 5 are those of commit `6c85f02`,
the state the smells were found on (`git show 6c85f02:app/test/unit/tariff.test.js`). Task C
moved them. In the submitted `app/test/unit/tariff.test.js` the tests on lines 30, 43, 49, 55, 64,
69 and 79 start on lines 44, 66, 74, 80, 90, 102 and 115. The test on line 9 is now three tests, on
lines 12-36, and the test on line 36 is now two, on lines 51-64 (section 5). Their checks changed in
section 3 and again in section 5. In `app/test/unit/day-cap.test.js`
both tests are still on lines 5 and 11. `receipt-format.test.js` and `server.test.js` did not
change.

| # | Smell | Test (file:line › name) | Why it is a problem | Evidence | AI found? |
|---|---|---|---|---|---|
| 1 | Weak assertions (type and sign checks only) | `app/test/unit/tariff.test.js:9` › `quote returns an itemised price` | Lines 17–20 check `total >= 0`, two `Array.isArray` and `typeof minutes`. No amount is checked, so any price passes. The test executes most of `quote` and raises coverage without checking it. | `return { …, total: timeCharge }` (all discounts and fees ignored): test green | yes, AI #4 |
| 2 | Tautological expected value (the oracle repeats the code) | `app/test/unit/tariff.test.js:30` › `e-bikes are billed at the e-bike rate` | Line 32 computes the expected value with the code's own formula and constants, `Math.ceil(result.minutes / BLOCK_MINUTES) * RATES.ebike`, and takes `minutes` from the result under test. A wrong block length or a wrong T1 rounding changes both sides. The spec gives 75 min → 3 blocks → 12000 (`docs/spec/tariffs.md:70`). | `BLOCK_MINUTES = 20`: test green. `Math.ceil` → `Math.floor` in `rideMinutes`: test green | yes, AI #3 |
| 3 | Testing the mock, not the code | `app/test/unit/tariff.test.js:79` › `a 45-minute classic ride costs 50 UAH` | `quote` is never called. The test calls `priceRide`, a `mock.fn` that returns a hard-coded 5000, and asserts that it returned 5000 and was called once. It cannot fail whatever `src/` does. | `RATES.classic = 5000` (double price): test green, while 3 other tests in the file go red | yes, AI #1 |
| 4 | Assertion that cannot fail | `app/test/unit/tariff.test.js:69` › `the daily cap limits the time charge` | Line 76 checks `last.total <= DAY_CAP`. The third 80-min e-bike ride costs 12000 without any cap, and 12000 ≤ 30000, so the assertion holds with the cap removed. The spec example says the third ride costs 6000 (`docs/spec/tariffs.md:105-106`). Only the last of three results is checked. | `if (due > allowance)` → `if (false)` (no cap at all): test green | yes, AI #2 |
| 5 | Weak assertion (direction instead of amount) | `app/test/unit/tariff.test.js:55` › `night rides get 30 % off` | Line 61 checks `total < timeCharge`. Any discount passes, although the name promises 30 %. The spec gives 1750 for this exact ride (`docs/spec/tariffs.md:143`). | `NIGHT_PERCENT = 10`: test green | yes, AI #8 |
| 6 | Weak assertions, name without an expected result | `app/test/unit/tariff.test.js:43` › `subscription on a long e-bike ride` | Lines 45–46 check that a `subscription` discount exists and that `total < timeCharge`. The name says what is set up, not what should happen. 100 min on an e-bike is 4 blocks = 16000, 20 % off → 12800 (`docs/spec/tariffs.md:62, 67, 76`). | subscription e-bike discount 20 % → 1 %: test green | yes, AI #7 |
| 7 | Count-only assertion | `app/test/unit/tariff.test.js:64` › `a bike kept over a day and left outside the zone pays both fees` | Line 66 checks `fees.length === 2`. Neither the fee codes nor the amounts (15000 and 200000, `docs/spec/tariffs.md:112, 120`) are checked. | `UNRETURNED_FEE = 2000` (1 % of the fee): test green | yes, AI #9 |
| 8 | Magic numbers, order-dependent index | `app/test/unit/tariff.test.js:49` › `reduced fare for a ride returned outside the zone` | Lines 51–52 assert 17500 and `fees[0].amount === 15000` with no source for either number, and `fees[0]` assumes the fee order without checking the fee code. These expected values were wrong in `main` (total 10000, fee 7500) and were changed in Task B, commit `3234a10` (`docs/bugs/README.md:166-172`). | `git diff main -- app/test/unit/tariff.test.js` | no: AI #14 flags this test as a Mystery Guest, not for its numbers |
| 9 | Weak assertion | `app/test/unit/day-cap.test.js:5` › `charges recorded for a day reduce what is left of the cap` | Line 8 checks `remaining < DAY_CAP`. Any recorded amount above zero passes; the exact remainder is 30000 − 12000 = 18000. | `record` adds `amount / 2`: test green | yes, AI #5 |
| 10 | Test data that cannot tell the cases apart | `app/test/unit/day-cap.test.js:11` › `the day of a ride is the date of its pickup` | `2026-09-16T08:00:00Z` is 11:00 in Kyiv, the same date in UTC and in Kyiv. The code in `main` used the UTC date (`git show main:app/src/day-cap.js`, line 7), BUG-5, and this test was green before and after the fix. The spec books a ride on its Kyiv date (`docs/spec/tariffs.md:101-102`); `2026-09-16T21:30:00Z` is 00:30 on 17.09 in Kyiv. | `dayKey` returns the UTC date: test green | yes, AI #6 |
| 11 | Partial assertion | `app/test/unit/receipt-format.test.js:11` › `a receipt has a line for every item` | Lines 19–20 check the number of lines and that the last one contains `185,00`. The labels, the minus sign of the discount line and the fee line are not checked (`docs/spec/tariffs.md:133-135`). | fee line printed as `? … -150,00 грн`: test green | yes, AI #10 |
| 12 | Hidden cases in a loop; boundary not tested | `app/test/unit/tariff.test.js:36` › `subscribers ride the first 45 minutes free on a classic bike, an e-bike gets 20 % off` | Two cases share one assertion on line 39, and the first failure ends the loop: when the classic case fails, the e-bike case does not run at all. The name states the 45-minute boundary, but the ride is 40 min, so 45 and 46 min are never tested (`docs/spec/tariffs.md:74-75`). | mutant M005 `45 → 46` survives the unit-only run (the `M005` line in the output in section 1) | yes, AI #11 |
| 13 | Eager test | `app/test/unit/server.test.js:29` › `GET / serves the page and GET /api/health answers` | Two endpoints in one test: if `GET /` fails, `GET /api/health` is not checked at all. The status code of the health answer is not checked. | `app/test/unit/server.test.js:29-36` | yes, AI #12 |

The AI's answer (`ai-runs/c-smells.md`) lists 14 smells. It found 12 of the 13 above, with the
same reasons and the same exact expected values (6000, 1750, 12800, 18000). It missed #8: it
flags that test for another reason. Four of its additions are kept as true but minor:
`includes("185,00")` in `receipt-format.test.js:20` also matches `1 185,00` and `-185,00`
(its #10); the `5` in `lines.length === 5` on `receipt-format.test.js:19` has no comment that
says where it comes from, the duration, the T3 line, one discount, one fee and the total
(`docs/spec/tariffs.md:133-135`; its #10, the count-only check itself is #11 above);
`server.test.js:49` does not check the error text; and the night ride in
`tariff.test.js:57` is given in UTC, so its Kyiv time is readable only through the comment on
line 56 (its #8, second half). An instant with the Kyiv offset, `2026-09-16T01:10:00+03:00`,
would carry that time in the data itself: the code accepts offsets (`app/src/tariff.js:31`) and
the repo conventions allow them (`AGENTS.md:57`).

What the AI called a smell and the participant disagrees with:

| AI # | What the AI says | Why the participant disagrees |
|---|---|---|
| 14 | Mystery Guest: `tariff.test.js:49` relies on the real station table, where `X01` is out of the zone | A Mystery Guest is a hidden external resource, such as a file or a database row. `X01` and its zone are product data defined by the spec (`docs/spec/tariffs.md:174`), and the test checks T7 against the station table that production uses. A fake table passed through `zones` would no longer check that data. |
| 13 | Assertion Roulette: three `formatUah` cases in `receipt-format.test.js:5` | Each case has its own assertion line (6, 7, 8), and `node:assert/strict` reports the failing line with the actual and the expected value, so it is always clear which case failed. All three cases check one function and one rule (T9), so they are one behaviour. |
| — (its list of tests without findings) | `server.test.js:38` runs the real `quote` and `formatReceipt`, so it is rather an integration test in `unit/` | The unit under test is the HTTP handler from `createHandler`, and its job is to pass the request to `quote` and the result to `formatReceipt` (`app/src/server.js:33-34`). Fakes for both would leave the test checking its own fakes, smell #3 above. The test opens no port, as the repo conventions ask for `server.js` (`AGENTS.md:18-19`). |

## 3. The AI strengthens the tests

The agent's answer is `ai-runs/c-strengthen.md`, its changes are `ai-runs/c-strengthen.diff`.
`ai-runs/c-after.txt` was taken on the agent's changes as they were. The last column is the
submitted state: the participant's corrections listed below, the participant's two new test files
of section 4, `app/test/unit/tariff-time-zone.test.js` and
`app/test/unit/receipt-minus-sign.test.js`, and the review of the weak checks in section 5. It was
measured with `node tools/mutate.mjs` and `npm run -s coverage` and is not in `ai-runs/`.

| Measure | Before (`c-before.txt`) | After the agent (`c-after.txt`) | Submitted |
|---|---|---|---|
| Mutation score | 91.6 % | 97.6 % | 97.6 % |
| Mutants survived | 7 | 2 | 2 |
| Test files (mutate header) | 14 | 14 | 16 |
| Tests (mutate header: `unit` + `spec`) | 131 | 137 | 144 |
| Assert calls (mutate header) | 45 | 73 | 64 |
| Line coverage of `src/` (`unit` only) | 96.36 % | 97.27 % | 97.27 % |
| Branch coverage of `src/` (`unit` only) | 81.91 % | 85.00 % | 85.86 % |
| Unit tests in the coverage run | 18 | 24 | 31 |

The steps in between, each measured the same way:

| Step | Mutation score | Survived | Tests | Assert calls | Lines / branches (`unit`) | Unit tests |
|---|---|---|---|---|---|---|
| The corrections of this section alone | 94.0 % | 5 | 133 | 63 | 96.67 % / 83.67 % | 20 |
| + `tariff-time-zone.test.js` (kills M075) | 95.2 % | 4 | 135 | 65 | 97.27 % / 84.85 % | 22 |
| + `receipt-minus-sign.test.js` (kills M018, M023) and section 5 | 97.6 % | 2 | 141 | 59 | 97.27 % / 85.86 % | 28 |
| + the two loops split into one test per case, exact `discounts`, the `До сплати` check (section 5) | 97.6 % | 2 | 144 | 64 | 97.27 % / 85.86 % | 31 |

`tariff-time-zone.test.js` starts child processes that run `quote`, and Node's coverage counts
them: `app/src/tariff.js:131-132`, the rejection of a moment without an offset, is uncovered
without it. The assert count goes down in the third step: section 5 removes seven checks that an
exact check in the same test already implies or that checked a mock, and replaces six with exact
values; the new file adds one `assert` call, run once per row. It goes up by five in the last step:
the first loop of `tariff.test.js` becomes a test of its own for the false start and a table for
the two other rides, which adds three call sites, and the check of the `До сплати` line in
`receipt-minus-sign.test.js` adds two. The two survivors are the equivalent mutants of section 4.

### What the agent deleted, skipped or weakened

Nothing. What was checked:

- `git diff --cached --stat -- app tools package.json`: 2 files, `app/test/unit/day-cap.test.js`
  and `app/test/unit/tariff.test.js`, 68 lines added and 2 removed. No change in `app/src/`,
  `tools/` or `package.json`.
- `grep -nE '^-[^-]' ai-runs/c-strengthen.diff`: the two removed lines are `:34` and `:91`, both
  replaced (rows 1 and 2 below). No assertion and no `test(` was removed.
- `grep -nE 'skip|todo' ai-runs/c-strengthen.diff`: nothing. `grep -c '^+test(' …`: 6 new tests.
- Every old assertion is still in place; the agent added exact values next to them.
- The agent knew what is counted here. It read `docs/walkthrough.md` lines 290-350, which name a
  deleted, skipped or weakened test as a finding, and the first 60 lines of `ai-runs/c-smells.md`
  (`ai-runs/c-strengthen.md:3`); its answer refers to both (`ai-runs/c-strengthen.md:60, 65`). The
  0 above was measured on an agent that had read the criterion, and the exact values it added follow
  the AI's list of smells.

### Changes to existing tests and new expected values

| # | What changed | Line from the diff | Verdict |
|---|---|---|---|
| 1 | `a 45-minute classic ride costs 50 UAH`: the mock no longer returns a hard-coded answer, it wraps the real `quote` | `:91` `-  const priceRide = mock.fn(() => ({ minutes: 45, timeCharge: 5000, … }));`, `:92` `+  const priceRide = mock.fn(quote);` | Kept. The expected 5000 is unchanged and agrees with the spec (45 min → 2 blocks × 25 UAH, `docs/spec/tariffs.md:62, 66`), and the test now runs the code. The `callCount` assertion still checks the mock, not the code; section 5 removes it together with the mock. |
| 2 | `quote returns an itemised price`: the loop gets exact totals | `:34` `-  for (const r of rides) {`, `:36` `+  const totals = [0, 5000, 20000];` | Kept. 1 min is a false start (`docs/spec/tariffs.md:54, 57`), 50 min classic is 5000 (`:69`), 130 min e-bike is 5 blocks × 40 UAH = 20000 (`:62, 67`). The three cases were still one loop without a label; section 5 splits them into one test per ride. |
| 3 | Expected values computed from the code constant `DAY_CAP` | `:9` `DAY_CAP - 12000`, `:76` `DAY_CAP + 15000 + 200000`, `:87` `chargedOn(…), DAY_CAP)` | Corrected: the oracle is the code again (smell #2). The values are right, but a wrong `DAY_CAP`, for example the 250 UAH of version 2 (`docs/spec/tariffs.md:154`), would pass. Now literals with the spec line: 18000, 245000, 30000. |
| 4 | Both fees compared as an ordered array | `:72` `+  assert.deepEqual(result.fees, [` | Corrected: the spec fixes no order of fees (`docs/spec/tariffs.md:121-122, 133-135`; `docs/test-cases.md:268` lists "the order of `fees`" as a code detail). Now compared by fee code, in any order; since section 5 as the whole array sorted by code. |
| 5 | New test `a night ride within the free start has no discounts` (kills M018) | `:101`–`:106`, `:105` `+  assert.deepEqual(result.discounts, []);` | Reverted. Whether a T2 false start shows a discount line is open question Q-4 (`docs/test-cases.md:162`), and `docs/test-cases.md:268` lists "no lines with a zero amount" as a code detail. Its time charge of 0 is already checked by `app/test/spec/t2-false-start.test.js` and, for a night ride, by TC-88 (`app/test/spec/t10-night.test.js:59-62`). |
| 6 | New tests `a time charge equal to the daily cap gets no day-cap discount` and `… equal to what is left of the cap …` (kill M023) | `:108`–`:124`, `:112` and `:121` `+  assert.deepEqual(result.discounts, []);` | Reverted. They assert that no day-cap line of 0 exists; the spec does not say: open question Q-12 (`docs/test-cases.md:170`), and `docs/test-cases.md:268` lists "no lines with a zero amount" as a code detail. TC-47 (`app/test/spec/t6-day-cap.test.js:34-37`) already checks the amount, 30000, and no reduction. |
| 7 | New test `a date-time without an offset is rejected` (kills M075) | `:132`–`:135` | Reverted. Section 4 of the spec (`docs/spec/tariffs.md:147-149`) does not list a missing or unreadable moment: open question Q-8 (`docs/test-cases.md:166`). M075 is killed instead by the participant's test, which asserts no answer to Q-8 (section 4). |
| 8 | New test `a missing ride is rejected with a QuoteError` (kills M064) | `:126`–`:130` | Kept. A missing ride has no known bike type, and the spec rejects such a request with an explanation (`docs/spec/tariffs.md:147-149`). In this code a rejection is a `QuoteError`: the API answers 400 with its message (`app/src/server.js:38`), any other error is a 500 `internal error` (`:39`); `app/test/spec/support.js:56-61` uses the same convention. |
| 9 | New test `a rider with no rides that day has been charged nothing` (kills M083) | `:18`–`:25` | Kept. T6 sums the time charges per rider and per day (`docs/spec/tariffs.md:100-101`); with no ride the sum is 0. Its reach is narrow: `chargedOn` has no caller in `app/src/` other than its definition (`app/src/day-cap.js:26`), so the test checks the ledger's reporting function, not a pricing path, and the `"2026-09-16"` day key it passes is a code detail (the rules run asks about its format, `ai-runs/c-with-rules/OPEN-QUESTIONS.md:29-30`). |
| 10 | Exact values added to existing tests | `:15` `dayKey("2026-09-16T22:30:00Z"), "2026-09-17"`, `:47` `12000`, `:56`–`:57` `3200` / `12800`, `:65`–`:66` `750` / `1750`, `:85`–`:86` `6000` | Kept. Each agrees with the spec: `docs/spec/tariffs.md:101-102`, `:70`, `:62, 67, 76`, `:143`, `:105-106`; these spec lines are now in comments next to the values. They close smells #10, #6, #5 and #4. Smell #2 is neutralised here: the literal 12000 is checked next to the assertion built from the code's formula, so a wrong block length or rounding turns the test red. Section 5 replaces that assertion with the spec's 75 min (`app/test/unit/tariff.test.js:35`). |

The corrections are a separate change on top of the agent's: the agent's version is the one in
`ai-runs/c-strengthen.diff`.

Numbers for the PR: line coverage 96.36 % → 97.27 %; mutation score 91.6 % → 97.6 %; tests
131 → 137; assert calls 45 → 73; tests the AI deleted, skipped or weakened: 0. Submitted state,
after the participant's corrections, the two new test files of section 4 and section 5: 97.6 %,
2 survivors (both equivalent), 144 tests, 64 assert calls, 97.27 % line coverage.

## 4. Surviving mutants

`ai-runs/c-after.txt` lists two survivors, M016 and M019. The table also covers the five
mutants of `ai-runs/c-before.txt` that the agent killed, because four of its six killing tests,
those for three of the five mutants, were reverted (section 3). After the corrections alone
`node tools/mutate.mjs` listed five survivors: M016, M018, M019, M023 and M075. With the
participant's `app/test/unit/tariff-time-zone.test.js` it listed four: M016, M018, M019 and M023.
The run on the submitted state, with the participant's `app/test/unit/receipt-minus-sign.test.js`
and the changes of section 5, `node tools/mutate.mjs`:

```text
  тести:  app/test/unit, app/test/spec — файлів: 16, тестів: 144, пропущено: 0, todo: 0, викликів assert: 64

разом                     83        81         2         0    97.6 %

Вижили (2) — тести не помітили цієї зміни:
  M016  app/src/tariff.js:47:21     0 → 1                       if (plan.amount > 0) discounts.push({ code: plan.code, amount: plan...
  M019  app/src/tariff.js:50:13     0 → 1                       if (due > 0 && kyivTime(pickup).hour < NIGHT_UNTIL_HOUR) {
```

| Mutant | File:line | Change | Verdict |
|---|---|---|---|
| M016 | `app/src/tariff.js:47:21` | `plan.amount > 0` → `> 1` | **Equivalent.** The two differ only for a fare discount of exactly 1 kopeck. The discount is 0 or at least 800, never 1: subscription on a classic bike is a whole number of 2500 blocks (`tariff.js:86`), on an e-bike 20 % of 4000 × blocks = 800 × blocks (`:84`, `:103`), the reduced fare 50 % of the time charge = 1250 or 2000 × blocks (`:96`). The rates are constants and `quote` takes no others (`:18`). `node docs/evidence/task-c-check.mjs equivalence` over 24 008 rides: `exactly 1 kopeck never occurs; smallest above 0: 800`. |
| M019 | `app/src/tariff.js:50:13` | `due > 0` → `due > 1` | **Equivalent.** Before T10, `due` is the time charge minus that discount: on a classic bike 2500 × blocks minus 0, 2500 × k or 1250 × blocks, a multiple of 1250; on an e-bike 4000, 3200 or 2000 × blocks. It is never 1. The same command: `exactly 1 kopeck never occurs; smallest above 0: 1250`. The agent's argument (`ai-runs/c-strengthen.md`) says "a multiple of 1250 or 800", which misses part of the e-bike reduced fare: 2000 × blocks is a multiple of 800 only for an even number of blocks and a multiple of 1250 only for a multiple of 5 blocks, so 2000, 6000 or 14000 is a multiple of neither. The conclusion holds. |
| M064 | `app/src/tariff.js:114:13` | `\|\|` → `&&` | **Killed** by `app/test/unit/tariff.test.js` › `a missing ride is rejected with a QuoteError` (the agent's test, kept, section 3 row 8). Not in the list after the corrections. |
| M083 | `app/src/day-cap.js:27:50` | `?? 0` → `?? 1` | **Killed** by `app/test/unit/day-cap.test.js` › `a rider with no rides that day has been charged nothing` (the agent's test, kept, row 9). Not in the list after the corrections. The kill raises the score, but `chargedOn` is called only by tests (`app/src/day-cap.js:26` is its only occurrence in `app/src/`), so it protects no pricing path. |
| M018 | `app/src/tariff.js:50:11` | `due > 0` → `due >= 0` | **Killed** by the participant's `app/test/unit/receipt-minus-sign.test.js` › `T9: every discount and cap line of the receipt has a minus sign, classic, 01:10, 1 min: false start at night`. Not in the list above. 1 min at 01:00 in Kyiv: the code gives `discounts: []`, the mutant `[{ code: "night", amount: 0 }]`, which adds the receipt line `Знижка: нічна ....................... 0,00 грн`, with no minus sign. T9 requires the minus sign on every discount line (`docs/spec/tariffs.md:134-135`). The test does not say whether that line belongs on the receipt, which is Q-4: it fails only because the line has no minus sign. The agent's test for M018 (row 5 of section 3) asserted that no such line exists and was reverted. |
| M023 | `app/src/tariff.js:57:11` | `due > allowance` → `>=` | **Killed** by the participant's `app/test/unit/receipt-minus-sign.test.js` › `T9: every discount and cap line of the receipt has a minus sign, classic, 360 min: exactly the cap`. Not in the list above. 360 min on a classic bike, exactly the cap: the code gives `discounts: []`, the mutant `[{ code: "day-cap", amount: 0 }]`, which adds the receipt line `Денний ліміт ........................ 0,00 грн`, with no minus sign. Whether a cap that reduces nothing gets a line is Q-12 (`docs/test-cases.md:170`), and the test does not answer it; the spec does say that a cap line carries a minus sign (`docs/spec/tariffs.md:134-135`). The agent's tests for M023 (row 6 of section 3) asserted that no such line exists and were reverted. |
| M075 | `app/src/tariff.js:130:33` | `\|\|` → `&&` | **Killed** by the participant's `app/test/unit/tariff-time-zone.test.js` › `§2: the outcome does not depend on the time zone of the server: a pickup moment without an offset` and `…: a return moment without an offset`. Not in the list after it. The mutant lets through any string that `Date.parse` can read, and any other value whose text form is an ISO 8601 date-time with an offset: `"2026-09-16T07:00:00"` with no offset, `"2026-09-16"` as a date only (26250), and `["2026-09-16T07:00:00Z"]` wrapped in an array (2500); the code rejects each with a `QuoteError`. A moment with no offset is read in the server's time zone: 17500 for 200 min in Europe/Kyiv, a `QuoteError` "returnAt is before pickupAt" with `TZ=America/New_York`. Whether such a moment is rejected or priced is Q-8 (`docs/test-cases.md:166`), so the test asserts neither: it runs the same ride in two processes, America/New_York and Europe/Kyiv, and asserts the same outcome. Every time in the spec is Kyiv time (`docs/spec/tariffs.md:37-38`), so a price that changes with the server's time zone is wrong whatever the answer to Q-8. The code rejects the ride in both zones (green); the mutant prices it in one of them (red). The test also checks that the two processes run with different offsets, so a platform that ignores `TZ` turns it red instead of letting it pass. The agent's test for M075 (row 7 of section 3) was reverted because it asserted the rejection itself. |

The inputs are `node docs/evidence/task-c-check.mjs probes`, which prints the code's and the
mutant's result side by side, and for M018 and M023 the mutant's receipt; the first M075 input
also with `TZ=America/New_York` in front.

Verdicts: 2 equivalent (M016, M019), 5 killed by a test: M064 and M083 by the agent's tests, M075,
M018 and M023 by the participant's.

Step 4 (`docs/walkthrough.md:351-354`) asks for at least five mutants from the survivors list of
`ai-runs/c-after.txt`, each killed by a new test or shown equivalent. That list holds two
(`ai-runs/c-after.txt:57-59`), so the table also takes the five mutants of `ai-runs/c-before.txt`
that the agent killed. All seven have one of the two verdicts.

How M018 and M023 were killed without an answer to Q-4 or Q-12. The only difference between
either of them and the code is an extra discount line of 0, a night line or a cap line
(`node docs/evidence/task-c-check.mjs probes`). Whether such a line belongs on the receipt is Q-4
or Q-12, and walkthrough rule 2 (`docs/walkthrough.md:59-61`) forbids picking an answer silently;
the agent's tests picked one and were reverted. The spec does answer another question about that
line: every discount and cap line carries a minus sign (`docs/spec/tariffs.md:134-135`), and the
mutants print `0,00 грн` without one, because the receipt takes the sign from `kopecks < 0`
(`app/src/receipt.js:16`). `app/test/unit/receipt-minus-sign.test.js` asserts only that: one
receipt line with a minus sign per discount or cap item of the quote, for six rides on both sides
of the false start and of the cap, with either minus character (Q-5), and no minus sign on the
`До сплати` line, the one line whose wording the spec fixes (`docs/spec/tariffs.md:135`). Without
that second check a minus moved from a discount line to the summary line kept the count and passed:
on a copy of the code with that change the test of `5505694` stays green, the submitted test has 4
red rows, the four with a discount. It holds whatever the
product owner answers to Q-4 and Q-12. M075 had the same problem while its test asserted the
rejection; the participant's test asserts only what holds for either answer to Q-8.

## 5. Testing rules for the agent

- File: `app/AGENTS.md`, section `## Тести`, 8 rules.
- Test lines in the table are those of commit `6c85f02`, as in section 2; the paragraph above
  the smells table gives the lines in the submitted files.
- Where each rule comes from:

| Rule (short) | Where it comes from (finding, file) |
|---|---|
| 1. The oracle is the spec; no spec, no value: an open question | Task A: 17 of the 109 totals of the draft from the code contradict the spec (`docs/ai-test-checklist.md:12`). Task B: 15 tests from the code were green on `main` and red after the fixes, they recorded the defects (`docs/bugs/README.md:182`). Task C: three agent tests picked answers the spec leaves open (section 3, rows 5–7). |
| 2. No expected value built from the code's constants or formulas | Smell #2, `app/test/unit/tariff.test.js:32`. The agent used `DAY_CAP` in three new expected values (section 3, row 3). |
| 3. Exact values, not `<`, `>= 0`, `typeof` or `length` | Smells #1, #4, #5, #6, #7, #9, #11 (section 2). |
| 4. Test the real unit, not a mock's own answer | Smell #3, `app/test/unit/tariff.test.js:79`; the agent kept a `callCount` check on the mock (section 3, row 1). |
| 5. Both sides of every boundary, one table row each | Smell #12, `app/test/unit/tariff.test.js:36`, M005 survives the unit-only run (section 1). `docs/ai-test-checklist.md:16`: the draft from the code tested the code's boundary, not the spec's. |
| 6. Kyiv time in the test data | Smell #10, `app/test/unit/day-cap.test.js:11`: green before and after the fix of BUG-5. `docs/ai-test-checklist.md:18`. The AI's #8 in section 2. |
| 7. Do not test what the spec does not define | `docs/test-cases.md:267-268` (error texts, order of `fees`, lines with a zero amount); `docs/ai-test-checklist.md:19`; section 3, rows 4–7. |
| 8. Never make a test pass by changing it | Task B: the agent of the run from the code edited its own test after its first red run (`ai-runs/b1-from-code.md:5`); the unit tests changed in Task B each with the spec line (`docs/bugs/README.md:166-174`). |

The rules are for the tests an agent writes or changes. After Task C the submitted unit tests were
checked against them once more. Each weak or code-derived check that was still there next to the
exact values of section 3 was either replaced with the exact value of the spec it stood in for, or
removed because an exact check in the same test already implies it. One smell had been removed
before that: `fees[0].amount` in `reduced fare for a ride returned outside the zone` assumed an
order of the fees (smell #8, rule 7); line 77 compares the whole `fees` array with the one fee that
ride has, `out-of-zone` 15000 (`docs/spec/tariffs.md:87, 112`). The other changes, in
`app/test/unit/tariff.test.js` (lines as submitted):

| Test (line) | Check before | Check now | Why |
|---|---|---|---|
| `quote returns an itemised price` (9 at `6c85f02`), now three tests (12-36) | `total >= 0`, `Array.isArray(fees)`, `typeof minutes` (smell #1), `Array.isArray(discounts)`; three rides in one loop | one test per ride: `T1, T2: quote returns an itemised price: classic, 1 min is a false start` (12) and `T1, T3: quote returns an itemised price: …` for 50 and 130 min (20-36). `minutes` 1, 50 and 130, `fees` `[]` (lines 14, 16, 30, 34), `discounts` `[]` for 50 and 130 min (line 33) | The exact totals (lines 15, 31) imply `total >= 0`. T1 gives the minutes (`docs/spec/tariffs.md:45-47`); all three rides end at S01, in the zone, within 24 h, so no fee (`:112, 119, 166`). A standard rider by day with no subscription, concession, night pickup or cap has no discount (`:74-77, 86, 100, 141`), the same as TC-80, so `Array.isArray(discounts)` (rule 3) is replaced by `[]` there. What a false start shows as a discount is Q-4, so its test states no discounts (line 17). One test per ride: rule 5 |
| `e-bikes are billed at the e-bike rate` (44) | the code's formula `Math.ceil(result.minutes / BLOCK_MINUTES) * RATES.ebike` (smell #2), `total === timeCharge` | `minutes` 75 and `total` 12000 (lines 46, 48) | Rule 2. T1 and T3 give 75 min and 12000 (`:45-47, 70`); line 47 already checked the 12000 of `timeCharge` |
| `subscribers ride the first 45 minutes free on a classic bike, an e-bike gets 20 % off` (36 at `6c85f02`), now two tests (51-64) | two bikes in one loop: when the classic case fails, the e-bike case does not run (smell #12) | one test per bike, `T4: subscribers ride the first 45 minutes free on a classic bike, an e-bike gets 20 % off: classic, 40 min is free` and `…: e-bike, 40 min is 8000 less 20 %` | Rule 5. The expected values are unchanged, 0 and 6400 (`:62, 67, 74, 76-77, 81`) |
| `subscription on a long e-bike ride` (66) | `some(… "subscription")`, `total < timeCharge` (smell #6) | `timeCharge` 16000 (line 69) | The exact `discounts` on line 70 implies the first. 100 min is 4 blocks × 40 UAH (`:62, 67`) |
| `night rides get 30 % off` (80) | `total < timeCharge` (smell #5) | removed | Lines 83 and 87 assert 2500 and 1750 |
| `a bike kept over a day and left outside the zone pays both fees` (90) | `fees.length === 2` (smell #7) and the comparison by fee code of section 3 | the whole `fees` array sorted by code (line 94) | Still in any order (rule 7). The sorted array also fails on a third or a repeated fee, which the comparison by code alone let through |
| `the daily cap limits the time charge` (102) | `last.total <= DAY_CAP` (smell #4) | removed | Line 110 asserts 6000; the bound came from the code's constant (rule 2) |
| `a 45-minute classic ride costs 50 UAH` (115) | `mock.fn(quote)` and `callCount === 1` (smell #3) | a direct call of `quote` | Rule 4: the call count checked the mock, not the code. The exact 5000 on line 117 is unchanged |

In `app/test/unit/day-cap.test.js`, `remaining < DAY_CAP` (smell #9, rules 2 and 3) is removed:
line 8 asserts 18000. No expected value changed: seven checks were removed, seven replaced by exact
values, and two tests were split into one test per case. The old names of the two split tests no
longer exist; each new name starts with the rule IDs and the old name, then the case. The run of
section 4 lists no survivor that the run before these changes did not list. What is left against
the rules: the names of the other unit tests carry no rule ID (rule 1). They were left as they are,
because the same names are quoted in the CI logs (`ci/runs/run-1152.log:186`) and in the Task B
reports (`docs/bugs/README.md:166-172`). `receipt-format.test.js` and `server.test.js` did not
change, so smells #11 and #13 are as in section 2. The 45-minute boundary that smell #12 misses is
tested from both sides in `app/test/spec/t4-subscription.test.js:9-10` (TC-25, TC-26).

The participant's new tests, `app/test/unit/tariff-time-zone.test.js` and
`app/test/unit/receipt-minus-sign.test.js`, have no expected value from the code (rule 2), run the
real `quote` (rule 4) and assert nothing the spec leaves open (rule 7): not which formats are
accepted, and not whether a line of 0 belongs on the receipt. The rows of the second one sit on
both sides of the false start and of the cap, each a test of its own with the case in its name
(rule 5), and its name carries the rule ID, T9 (rule 1). The name of the time-zone test carries the
spec section, `§2`, instead of a rule ID: rule 1 asks for an ID from T1–T10, and the property comes from section 2 of the spec
(`docs/spec/tariffs.md:37-38`), which has none. The Task B spec tests mark section 4 the same way,
for example `T3: TC-23 bike type scooter is rejected (§4)`
(`app/test/spec/t3-time-charge.test.js:20`). `app/AGENTS.md` was not changed to allow this: the
rules run of section 6 used this exact file.

## 6. Re-run with the rules

The answer is `ai-runs/c-with-rules.md`; without rules, `ai-runs/b1-from-code.md` and the tests in
`ai-runs/b1-from-code/`. The same prompt, the same copy of `app/src/` from `main` and the same
tool permissions (`ai-runs/b1-from-code.md:5`, `ai-runs/c-with-rules.md:5`). The context differs
in `app/AGENTS.md`, copied as `AGENTS.md` and `CLAUDE.md`, and in one flag: the rules run had
skills off (`--disable-slash-commands`, `ai-runs/c-with-rules.md:4`), which the header of the run
without rules does not record (`ai-runs/b1-from-code.md:4`). Neither temporary folder has a
`.claude/` folder (`ls -a ../ws12-b1 ../ws12-c-rules`), so no project skill could load in either
run. The run without rules also lists `claude-haiku-5-5` usage (`ai-runs/b1-from-code.md:1`).

`ai-runs/c-with-rules/*.test.js` does not exist. The agent wrote no test file
(`ai-runs/c-with-rules.md:5, 18`), so the copy command of step 6 had nothing to copy, and
`ai-runs/c-with-rules/` holds the only file the session wrote, `OPEN-QUESTIONS.md`. A second run
until tests appear is what walkthrough rule 3 rules out (`docs/walkthrough.md:62-64`).
`ai-runs/README.md:56-58` asks for a «вирішуй сам» reply when the agent asks a question instead of
answering. This session answered: it states that it wrote no test and why, shows the
`node --test` run and names the file with its questions (`ai-runs/c-with-rules.md:18-30`). Its
last paragraph (`:34`) says what it would need to write tests, after the work was done. The prompt
had already told it to ask nothing and to work with what it had (`ai-runs/c-with-rules.md:14`),
so a «вирішуй сам» reply would only repeat the prompt.

| What is compared | Without rules | With rules |
|---|---|---|
| Test files and tests | 2 files, 122 tests (`ai-runs/b1-run.txt:157`) | None. `node --test` printed `ℹ tests 0`. `ai-runs/c-with-rules/` holds the only file the session wrote, `OPEN-QUESTIONS.md`; there is no `*.test.js` to copy |
| Where the expected values come from | "Очікувані суми я порахував вручну з логіки коду" (`ai-runs/b1-from-code.md:18`) | None was written: rule 1 forbids values from the code, and the spec is not in the folder (`ai-runs/c-with-rules/OPEN-QUESTIONS.md:3-7`) |
| Open points | Not marked; the tests assert the code's choices | 12 questions, each boundary from both sides (`OPEN-QUESTIONS.md:11-35`), and a closing list of what not to test (`:37-38`) |
| The five defects of Task B | Recorded, not found: 15 of its tests went red after the fixes (`ai-runs/b1-rerun.txt:160`) | All five raised as questions: rounding with `Math.round` (q1, BUG-1), 1 and 2 min (q1, BUG-2), free minutes on an e-bike (q3, BUG-3), fees halved for the reduced fare (q4, BUG-4), the UTC day in `dayKey` (q8, BUG-5). BUG-5 is also named a likely defect in the final answer |
| Kyiv time in the data | — | `2026-09-16T21:30:00Z` as 00:30 on 17.09 (q8), night boundary 05:59 / 06:00 in Kyiv given in UTC (q6) |

What changed: the agent stopped deriving expected values from the code. Rule 1 decided the
run: with no spec in the folder it had no oracle, so it wrote questions instead of tests. Rules
5, 6 and 7 shaped the questions: both sides of each boundary, instants chosen so that the Kyiv
and the UTC date differ, and no tests for error texts, order or zero lines. Without rules, the
same prompt gave 122 green tests that fixed the five defects in place.

What did not change, or was not tested: the run produced no executable test, so rules 3, 4 and 8
had nothing to act on. The prompt asks for tests and a run, and with these rules the answer to
that prompt is "no tests until the spec is available". That is the intended behaviour of rule 1,
and also its cost: a reader of the run gets questions, not a suite.

---

Reviewed and approved by Yurii Slynko, 2026-11-07.
