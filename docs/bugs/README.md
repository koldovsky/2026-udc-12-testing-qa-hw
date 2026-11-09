# Red tests and defects

Classes: **code defect** (the code differs from the spec), **false test** (the test expects
something the spec does not require, or checks it wrongly), **spec gap** (the spec gives no
single answer, so this is a question and not a defect).

Each red test was tied to its defect by measurement: the fixes were applied one at a time and
`npm test` was run after each. The "Green after" commit is the first one on which the test
passes.

The red tests of both runs can be counted again per commit, from the repo root:

```bash
for c in main 4f9d5b8 69e9c31 5744f8c 3234a10 2c45deb; do
  rm -rf ../ws12-check && mkdir -p ../ws12-check/ai-runs
  git archive "$c" app package.json | tar -x -C ../ws12-check
  cp -r app/test/spec ../ws12-check/app/test/
  cp -r ai-runs/b1-from-code ../ws12-check/ai-runs/
  spec=$(cd ../ws12-check/app && node --test "test/spec/*.test.js" | grep '^ℹ fail')
  code=$(cd ../ws12-check && node --test "ai-runs/b1-from-code/*.test.js" | grep '^ℹ fail')
  echo "$c | spec: $spec | code run: $code"
done
```

```text
main | spec: ℹ fail 19 | code run: ℹ fail 0
4f9d5b8 | spec: ℹ fail 15 | code run: ℹ fail 4
69e9c31 | spec: ℹ fail 13 | code run: ℹ fail 5
5744f8c | spec: ℹ fail 6 | code run: ℹ fail 7
3234a10 | spec: ℹ fail 2 | code run: ℹ fail 10
2c45deb | spec: ℹ fail 0 | code run: ℹ fail 15
```

With `grep '^✖ T' | sort -u` in place of `grep '^ℹ fail'` the `spec` part prints the names of the red tests.

The loop copies the current `app/test/spec/`, so its `spec` count includes `T5: TC-99` and
`T8: TC-100`. They were added after `ai-runs/b2-run.txt` was saved, see "Run notes". Both are red
on BUG-4, up to `5744f8c`, and green from `3234a10`. Without them the counts are 17, 13, 11, 4, 2
and 0, and 17 is the count of the saved run.

## Classification of red tests

`ai-runs/b1-run.txt` (code run): 122 of 122 green, no red tests to classify.

`ai-runs/b2-run.txt` (spec run): 130 tests, 113 green, 17 red. All 17 are code defects. No false
tests and no spec gaps: every expected value below comes from a line of the spec, and nothing
that depends on an open question (Q-1 to Q-12 in `docs/test-cases.md`) is asserted. Such points
have no test case, and TC-78 is automated without its receipt lines that depend on Q-1.

`time` is `total` minus `fees`, as defined in `docs/test-cases.md`. "Got" values are the ones
printed in `ai-runs/b2-run.txt`.

| # | Test (file › name) | Run | Class | Evidence (spec line, got and expected) | What was done |
|---|---|---|---|---|---|
| 1 | `app/test/spec/t1-duration.test.js` › `T1: TC-05 30 min 01 s is 31 min, 2 blocks` | spec | code defect | `docs/spec/tariffs.md:46-47, 62`. Got `minutes: 30, time: 2500`, expected `minutes: 31, time: 5000`. Green after `4f9d5b8` | BUG-1 |
| 2 | `app/test/spec/t1-duration.test.js` › `T1: TC-06 12 min 00.001 s is 13 min` | spec | code defect | `docs/spec/tariffs.md:46-47`. Got `minutes: 12`, expected `minutes: 13`. Green after `4f9d5b8` | BUG-1 |
| 3 | `app/test/spec/t2-false-start.test.js` › `T2: TC-12 2 min 00 s, no time charge` | spec | code defect | `docs/spec/tariffs.md:54`. Got `time: 2500`, expected `time: 0`. Green after `69e9c31` | BUG-2 |
| 4 | `app/test/spec/t2-false-start.test.js` › `T2: TC-13 2 min 01 s is 3 min, 1 block` | spec | code defect | `docs/spec/tariffs.md:46-47, 54`. Got `minutes: 2`, expected `minutes: 3`. Green after `4f9d5b8` | BUG-1 |
| 5 | `app/test/spec/t2-false-start.test.js` › `T2: TC-15 e-bike, 2 min, no time charge` | spec | code defect | `docs/spec/tariffs.md:54`. Got `time: 4000`, expected `time: 0`. Green after `69e9c31` | BUG-2 |
| 6 | `app/test/spec/t4-subscription.test.js` › `T4: TC-30 subscriber, e-bike, 30 min is 4000 less 20 %` | spec | code defect | `docs/spec/tariffs.md:76-77`. Got `time: 0`, expected `time: 3200`. Green after `5744f8c` | BUG-3 |
| 7 | `app/test/spec/t4-subscription.test.js` › `T4: TC-31 subscriber, e-bike, 40 min has no free minutes: 8000 less 20 %` | spec | code defect | `docs/spec/tariffs.md:76-77`. Got `time: 0`, expected `time: 6400`. Green after `5744f8c` | BUG-3 |
| 8 | `app/test/spec/t4-subscription.test.js` › `T4: TC-32 subscriber, e-bike, 75 min is 12000 less 20 %` | spec | code defect | `docs/spec/tariffs.md:76-77`. Got `time: 3200`, expected `time: 9600`. Green after `5744f8c` | BUG-3 |
| 9 | `app/test/spec/t5-concession.test.js` › `T5: TC-42 subscriber with concession, e-bike, 30 min: concession is lower` | spec | code defect | `docs/spec/tariffs.md:76-77, 89-90`. Got `time: 0, concessionApplied: false`, expected `time: 2000, concessionApplied: true`. Green after `5744f8c` | BUG-3 |
| 10 | `app/test/spec/t5-concession.test.js` › `T5: TC-43 concession, 20 min, return X01: no discount on the fee` | spec | code defect | `docs/spec/tariffs.md:87, 112`. Got `fees: 7500, total: 8750`, expected `fees: 15000, total: 16250`. Green after `3234a10` | BUG-4 |
| 11 | `app/test/spec/t6-day-cap.test.js` › `T6: TC-51 at cap on 16.09, pickup 00:30 on 17.09: the Kyiv date decides, not the UTC date` | spec | code defect | `docs/spec/tariffs.md:34, 101-102`. Got `time: 0`, expected `time: 1750`. Green after `2c45deb` | BUG-5 |
| 12 | `app/test/spec/t6-day-cap.test.js` › `T6: TC-97 at cap on 16.09, pickup 00:00:00 on 17.09: the first moment of a new day` | spec | code defect | `docs/spec/tariffs.md:34, 101-102`. Got `time: 0`, expected `time: 1750`. Green after `2c45deb` | BUG-5 |
| 13 | `app/test/spec/t6-day-cap.test.js` › `T6: TC-94 subscriber, e-bike, 300 min: the cap applies after 20 % off` | spec | code defect | `docs/spec/tariffs.md:76-77, 100-101`. Got `time: 28800, capReduction: 0`, expected `time: 30000, capReduction: 2000`. Green after `5744f8c` | BUG-3 |
| 14 | `app/test/spec/t7-out-of-zone.test.js` › `T7: TC-62 subscriber, e-bike, 30 min, return X01: no discount on the fee` | spec | code defect | `docs/spec/tariffs.md:76-77, 112`. Got `time: 0, total: 15000`, expected `time: 3200, total: 18200`. Green after `5744f8c` | BUG-3 |
| 15 | `app/test/spec/t8-unreturned.test.js` › `T8: TC-67 24 h 00 min 01 s is 1441 min: the fee applies` | spec | code defect | `docs/spec/tariffs.md:46-47, 119-120`. Got `minutes: 1440, fees: 0, total: 30000`, expected `minutes: 1441, fees: 200000, total: 230000`. Green after `4f9d5b8` | BUG-1 |
| 16 | `app/test/spec/t8-unreturned.test.js` › `T8: TC-69 concession, e-bike, 25 h: capped after the discount, no discount on the fee` | spec | code defect | `docs/spec/tariffs.md:87, 119-120`. Got `fees: 100000, total: 130000`, expected `fees: 200000, total: 230000`. Green after `3234a10` | BUG-4 |
| 17 | `app/test/spec/t9-amounts-receipt.test.js` › `T9: TC-96 receipt, subscriber, e-bike, 30 min: T3 and discount lines` | spec | code defect | `docs/spec/tariffs.md:76-77, 133-135`. `До сплати` got `0,00 грн`, expected `32,00 грн`. Green after `5744f8c` | BUG-3 |

Red tests per defect: BUG-1: 4, BUG-2: 2, BUG-3: 7, BUG-4: 2, BUG-5: 2. Total 17. A test's rule ID
names the case it automates, not always the rule that is broken: TC-94 is a T6 case, and it was
red because of the T4 defect.

## Unstable test

`app/test/integration/receipt.test.js` › `every receipt of a week of rides ends with the amount
due` fails on some runs with no change in the code. It is not in the 17: it passed in the run
saved in `ai-runs/b2-run.txt`. The test was not changed and is left for Task D, which saves its own
run in `ai-runs/d-repeat-before.txt`.

Task D: a test defect, not a code defect. The test expected one block too many at exactly 30 and
60 min and drew its rides at random, so it failed only when a ride of 30 or 60 min came up. It was
replaced by fixed rows in `9126021`; 0 of 50 runs red after that (`ai-runs/d-repeat-after.txt`).
Cause, evidence and fix: `docs/triage.md`, section 1. The runs below are from before the fix.

The count changes from one set of runs to the next, and in both sets below only this test failed.
Both commands run from the repo root. `2>/dev/null` drops the progress lines.

On the fixed code, 3 failures in 20 runs:

```bash
node tools/repeat.mjs 20 2>/dev/null
```

```text
Прогонів: 20 (app: файлів 15, тестів 133)
Червоних прогонів: 3 з 20 (№ 3, 14, 17)

файл / тест                                                  падінь
test/integration/receipt.test.js
  every receipt of a week of rides ends with the amount due  3/20
      ↳ classic, 30 min from 2026-09-21T08:33:00.000Z: got "До сплати .......................... 25,00 грн", expected 50,00 грн
      ↳ ebike, 30 min from 2026-09-21T10:49:00.000Z: got "До сплати .......................... 40,00 грн", expected 80,00 грн
      ↳ classic, 30 min from 2026-09-21T10:31:00.000Z: got "До сплати .......................... 25,00 грн", expected 50,00 грн

Решта тестів (132) — зелені в усіх прогонах.

Час: 13.0 с
```

On the copy of `main` from step 1 of `docs/bugs/BUG-1.md`, with no spec tests and no fixes, 8
failures in 20 runs:

```bash
node tools/repeat.mjs 20 --app ../ws12-main/app 2>/dev/null
```

```text
Прогонів: 20 (../ws12-main/app: файлів 5, тестів 20)
Червоних прогонів: 8 з 20 (№ 4, 7, 8, 10, 12, 15, 16, 19)

файл / тест                                                  падінь
test/integration/receipt.test.js
  every receipt of a week of rides ends with the amount due  8/20
      ↳ classic, 30 min from 2026-09-21T07:14:00.000Z: got "До сплати .......................... 25,00 грн", expected 50,00 грн
      ↳ classic, 60 min from 2026-09-21T12:19:00.000Z: got "До сплати .......................... 50,00 грн", expected 75,00 грн
      ↳ ebike, 30 min from 2026-09-21T08:50:00.000Z: got "До сплати .......................... 40,00 грн", expected 80,00 грн

Решта тестів (19) — зелені в усіх прогонах.

Час: 5.2 с
```

## Defects

| ID | Rule | Summary | Found by the code run? | Found by the spec run? | Fix commit |
|---|---|---|---|---|---|
| BUG-1 | T1 | Duration rounded to the nearest minute, not up | no | yes | `4f9d5b8` |
| BUG-2 | T2 | A ride of exactly 2 min is charged | no | yes | `69e9c31` |
| BUG-3 | T4 | Subscribers get 45 free minutes on e-bikes | no | yes | `5744f8c` |
| BUG-4 | T5 | The reduced fare halves the fees | no | yes | `3234a10` |
| BUG-5 | T6 | The daily cap uses the UTC date, not the Kyiv date | no | yes | `2c45deb` |

The report on each defect is in `docs/bugs/BUG-<N>.md`.

`docs/bugs/CI-1152.md` (Task D) is a defect of CI run 1152: it is in pull request #238
(`ci/changes/run-1152.diff`), not in `main` or in this branch, so it has no fix commit here. The
triage of all four CI runs is in `docs/triage.md`, section 2.

"Found" means a test went red. The tests of the code run were all green on the defective code,
so they found none. The final answer of that run (`ai-runs/b1-from-code.md`) did raise suspicions
in text, with no spec to check them against:

- BUG-5: named as a likely defect, and 5 tests were placed in `unconfirmed:` blocks.
- BUG-1: asked whether rounding should go up, while plain tests kept pinning the rounding.
- BUG-4: noticed the fee halving, but treated the rides with a full fee as the odd ones. The spec
  says the opposite: the full fee is correct.
- BUG-2: the strict comparison of the false start was not named. The answer only asked to check
  the 89/90 s boundary of the free start as part of the rounding question
  (`ai-runs/b1-from-code.md:51`).
- BUG-3: not mentioned.

## Existing tests that went red after the fixes

| Test (file › name) | What it asserted | What the spec says (line) | What was changed |
|---|---|---|---|
| `app/test/unit/tariff.test.js` › `a ride of 30 min 20 s is billed as one block` | 30 min 20 s is 30 min and 2500 | A started minute counts as a full one, so 31 min, 2 blocks (`docs/spec/tariffs.md:46-47, 62`) | Expected values are now 31 and 5000. Renamed to `a ride of 30 min 20 s is billed as two blocks`. Commit `4f9d5b8` |
| `app/test/unit/tariff.test.js` › `subscribers ride the first 45 minutes free` | A 40 min ride costs 0 on both bike types | No free minutes on an e-bike, 20 % off: 8000 less 20 % is 6400 (`docs/spec/tariffs.md:76-77`) | The test still checks both bikes: classic 0, e-bike 6400. Renamed to `subscribers ride the first 45 minutes free on a classic bike, an e-bike gets 20 % off`. Commit `5744f8c` |
| `app/test/unit/tariff.test.js` › `reduced fare for a ride returned outside the zone` | Fee 7500, total 10000 | The reduced fare does not apply to fees: 2500 + 15000 (`docs/spec/tariffs.md:87, 112`) | Expected values are now fee 15000, total 17500. Commit `3234a10` |

No test was deleted, skipped or weakened. Each change is in the commit of the fix that exposed it.
In Task C the second test was split into one test per bike, with the same expected values, 0 and
6400: `T4: subscribers ride the first 45 minutes free on a classic bike, an e-bike gets 20 % off:
classic, 40 min is free` and `…: e-bike, 40 min is 8000 less 20 %` (`docs/test-quality.md`,
section 5).

## Tests from the code run after the fixes (`ai-runs/b1-rerun.txt`)

122 tests, 107 green, 15 red. These 15 were green on the original code and red on the fixed code.
Each was tied to its defect by running the suite on a copy of the code at each fix commit (the
loop at the top of this file) and on a copy of `main` with that fix applied alone (the loop below
the table).

| Test (file › name) | What it asserted | Which defect it pinned |
|---|---|---|
| `ai-runs/b1-from-code/tariff.test.js` › `quote: time charge` › `rounds 89 s to 1 min` | 89 s is 1 min | BUG-1 |
| `ai-runs/b1-from-code/tariff.test.js` › `quote: time charge` › `rounds 1829 s to 30 min` | 30 min 29 s is 30 min | BUG-1 |
| `ai-runs/b1-from-code/tariff.test.js` › `quote: time charge` › `makes the seconds decide between free and paid` | 89 s is free, 90 s costs 2500 | BUG-1, BUG-2 |
| `ai-runs/b1-from-code/tariff.test.js` › `quote: fees` › `uses the rounded minutes for the 24-hour limit` | 24 h 00 min 29 s has no T8 fee | BUG-1 |
| `ai-runs/b1-from-code/tariff.test.js` › `quote: time charge` › `charges 2500 for 2 min on a classic bike` | A 2 min ride costs 2500 | BUG-2 |
| `ai-runs/b1-from-code/tariff.test.js` › `quote: subscription` › `takes 20 % off the blocks past 45 minutes on an e-bike` | Subscriber, e-bike, 46 min pays 3200 | BUG-3 |
| `ai-runs/b1-from-code/tariff.test.js` › `quote: night discount` › `applies after the subscription, on what is left` | Subscriber, e-bike, 46 min at night pays 2240 | BUG-3 |
| `ai-runs/b1-from-code/tariff.test.js` › `quote: reduced fare` › `halves the out-of-zone fee` | The T7 fee is 7500 | BUG-4 |
| `ai-runs/b1-from-code/tariff.test.js` › `quote: reduced fare` › `halves the unreturned fee` | The T8 fee is 100000 | BUG-4 |
| `ai-runs/b1-from-code/tariff.test.js` › `quote: subscriber with a concession` › `has its fees halved when the reduced fare wins` | The T7 fee is 7500 | BUG-4 |
| `ai-runs/b1-from-code/day-cap.test.js` › `unconfirmed: the day boundary is UTC midnight, not Kyiv midnight` › `books a pickup at 01:00 Kyiv on the previous calendar date` | 01:00 on 15.06 Kyiv is booked on 14.06 | BUG-5 |
| `ai-runs/b1-from-code/day-cap.test.js` › `unconfirmed: the day boundary is UTC midnight, not Kyiv midnight` › `changes the day at 03:00 Kyiv in summer and 02:00 in winter` | The day changes at UTC midnight | BUG-5 |
| `ai-runs/b1-from-code/tariff.test.js` › `unconfirmed: the ledger's day is the UTC day, the night hours are Kyiv time` › `books a 01:00 Kyiv pickup on the previous date` | The charge lands on 14.06 | BUG-5 |
| `ai-runs/b1-from-code/tariff.test.js` › `unconfirmed: the ledger's day is the UTC day, the night hours are Kyiv time` › `gives two separate caps within one Kyiv date` | Two rides on one Kyiv date pay 28000 and 20000 | BUG-5 |
| `ai-runs/b1-from-code/tariff.test.js` › `unconfirmed: the ledger's day is the UTC day, the night hours are Kyiv time` › `shares one cap between two Kyiv dates` | A ride on the next Kyiv date pays 0 | BUG-5 |

Tests per defect, with each fix applied alone to `main`: BUG-1: 4, BUG-2: 2, BUG-3: 2, BUG-4: 3,
BUG-5: 5. The sum is 16 for 15 tests, because `makes the seconds decide between free and paid`
counts under both BUG-1 and BUG-2. Its false assertion is that 90 s costs 2500: 90 s is 2 min under
either rounding, so this is BUG-2. With the BUG-1 fix alone it goes red too, because 89 s then
rounds up to 2 min and BUG-2 charges it. In the commit order of this branch it goes red first at
`4f9d5b8`.

Each fix alone on `main`, from the repo root:

```bash
for c in 4f9d5b8 69e9c31 5744f8c 3234a10 2c45deb; do
  rm -rf ../ws12-check && mkdir -p ../ws12-check/ai-runs
  git archive main app package.json | tar -x -C ../ws12-check
  cp -r ai-runs/b1-from-code ../ws12-check/ai-runs/
  git show "$c" -- app/src > ../ws12-check/fix.diff
  echo "$c"
  (cd ../ws12-check && git init -q && git apply fix.diff && node --test "ai-runs/b1-from-code/*.test.js" | grep -E '^ +✖' | sed 's/ (.*//')
done
```

```text
4f9d5b8
  ✖ rounds 89 s to 1 min
  ✖ rounds 1829 s to 30 min
  ✖ makes the seconds decide between free and paid
  ✖ uses the rounded minutes for the 24-hour limit
69e9c31
  ✖ charges 2500 for 2 min on a classic bike
  ✖ makes the seconds decide between free and paid
5744f8c
  ✖ takes 20 % off the blocks past 45 minutes on an e-bike
  ✖ applies after the subscription, on what is left
3234a10
  ✖ halves the out-of-zone fee
  ✖ halves the unreturned fee
  ✖ has its fees halved when the reduced fare wins
2c45deb
  ✖ books a pickup at 01:00 Kyiv on the previous calendar date
  ✖ changes the day at 03:00 Kyiv in summer and 02:00 in winter
  ✖ books a 01:00 Kyiv pickup on the previous date
  ✖ gives two separate caps within one Kyiv date
  ✖ shares one cap between two Kyiv dates
```

The files in `ai-runs/b1-from-code/` were not changed.

## Numbers

- Defects found by the tests from code: 0
- Defects found by the tests from the spec: 5
- Tests from code that pinned a defect: 15 distinct tests. The per-defect counts below the table of `ai-runs/b1-rerun.txt` add up to 16, because one test pinned both BUG-1 and BUG-2

## Run notes

- Code run: see the header of `ai-runs/b1-from-code.md`.
- Spec run: Claude Code 2.1.301, `claude -p` (non-interactive), Claude Opus 5.5
  (`claude-opus-5-5`), a new session in the repo, 2026-11-06, the prompt from
  `docs/walkthrough.md` verbatim. It loaded `AGENTS.md` and `CLAUDE.md`, as a run in the repo does.
  Besides the test cases, the spec and `app/src/`, it read `docs/walkthrough.md`,
  `docs/traceability.md`, `ai-runs/README.md`, the existing tests, `tools/repeat.mjs` and
  `tools/mutate.config.json`, and it searched `tools/mutate.mjs`.
  User settings, skills, MCP servers and auto-memory were off. The launch command allowed writes
  only under `app/test/spec/`. A write to `app/test/helpers/spec.js` was denied, so its shared
  helpers are in `app/test/spec/support.js`.
- The code run and the spec run were separate new sessions and ran in parallel: both started at
  12:27:44Z. The tests of the code run were copied into the repo at 12:31:08Z, and the spec run
  ended at 12:32:47Z. Its tool log shows no read of `ai-runs/b1-from-code/` or
  `ai-runs/b1-from-code.md`.
- `git diff --stat main -- app/src app/test/unit app/test/integration` was empty after the spec
  run, before `ai-runs/b2-run.txt` was saved.
- The tests in `app/test/spec/` were read against `docs/test-cases.md`: all 98 test cases of that
  time were automated in 110 tests, and no expected value needed a correction.
- Two checks were added after `ai-runs/b2-run.txt` was saved. `T8: TC-67` now also asserts
  `t3: 122500`, the 49 blocks its test case states: 49 × 2500 (`docs/spec/tariffs.md:62, 66`).
  `T8: TC-69` now also asserts `t3: 200000`, the price its test case states: 50 × 4000
  (`docs/spec/tariffs.md:62, 67`). The other expected values of these tests did not change. TC-67
  is still red on `main` and green from `4f9d5b8`, TC-69 is still red on `main` and green from
  `3234a10`.
- Three test cases were added after the fixes: TC-99, TC-100 and TC-101. They cover fee
  combinations of BUG-4 that had no case, and their expected values come from the spec lines in
  `docs/test-cases.md`. That made 101 test cases in 113 tests; at the end of Task B `npm test` ran
  133 tests, 156 after the tests added in Tasks C and D (`docs/test-quality.md`, sections 3-5, and
  `docs/triage.md`, section 1), and 160 with the e2e test of Task E (`docs/task-e-bonus.md`). They
  are not in the table of red tests, because that table classifies the saved run.
- `app/test/spec/t6-day-cap.test.js` had its own copy of the `ebike80` helper from
  `app/test/spec/support.js`. It now imports that helper. No test name or expected value changed.

## Every change to the existing unit and integration tests

The three tests changed by the Task B fixes are in the section "Existing tests that went red after
the fixes". The table below lists every other change to `app/test/unit/` and
`app/test/integration/` against `main`, made in Tasks C and D. No expected value of an existing test
changed in them: weak checks were removed or replaced by the exact value of the spec, and tests that
held several cases were split into one test per case. The reasons, with the lines of the AI's diff,
are in `docs/test-quality.md` (sections 3 and 5) and `docs/triage.md` (section 1). `a return before
the pickup is rejected`, `app/test/unit/receipt-format.test.js` and `app/test/unit/server.test.js`
did not change.

| Test on `main` (file › name) | Task | What changed | Why (spec line) |
|---|---|---|---|
| `day-cap.test.js` › `charges recorded for a day reduce what is left of the cap` | C | `remaining < DAY_CAP` replaced by the exact 18000 | Smell #9; 300 − 120 UAH (`docs/spec/tariffs.md:100-101`) |
| `day-cap.test.js` › `the day of a ride is the date of its pickup` | C | the agent's second check added: `2026-09-16T22:30:00Z` is booked on `2026-09-17` | Smell #10: the old instant has the same date in UTC and in Kyiv; the Kyiv date decides (`:34, 101-102`) |
| `tariff.test.js` › `quote returns an itemised price` | C | now three tests, `T1, T2: quote returns an itemised price: classic, 1 min is a false start` and `T1, T3: …: classic, 50 min is 2 blocks` / `…: e-bike, 130 min is 5 blocks`, with exact minutes, totals, `discounts` and `fees` | Smell #1 (`total >= 0`, `Array.isArray`, `typeof`); one test per ride, `app/AGENTS.md` rule 5 (`:45-47, 54, 57, 62, 67, 69`) |
| `tariff.test.js` › `subscribers ride the first 45 minutes free on a classic bike, an e-bike gets 20 % off` (the Task B name) | C | now two tests, `T4: …: classic, 40 min is free` and `T4: …: e-bike, 40 min is 8000 less 20 %`, with the same values, 0 and 6400 | Smell #12: when the first case failed, the second did not run; rule 5 (`:74, 76-77, 81`) |
| `tariff.test.js` › `e-bikes are billed at the e-bike rate` | C | the code's formula `Math.ceil(result.minutes / BLOCK_MINUTES) * RATES.ebike` replaced by 75 min, `timeCharge` 12000 and `total` 12000 | Smell #2: the expected value repeated the code (`:45-47, 70`) |
| `tariff.test.js` › `subscription on a long e-bike ride` | C | `some(… "subscription")` and `total < timeCharge` replaced by `timeCharge` 16000, `discounts` `[{ subscription, 3200 }]` and `total` 12800 | Smell #6 (`:62, 67, 76`) |
| `tariff.test.js` › `reduced fare for a ride returned outside the zone` | C | besides the Task B values, `fees[0].amount` replaced by the whole `fees` array | Smell #8: the index assumed an order of the fees, which the spec does not fix (`:87, 112, 133-135`) |
| `tariff.test.js` › `night rides get 30 % off` | C | `total < timeCharge` removed; `discounts` compared as one array, `[{ night, 750 }]`; `total` 1750 | Smell #5 (`:141, 143`) |
| `tariff.test.js` › `a bike kept over a day and left outside the zone pays both fees` | C | `fees.length === 2` replaced by the whole `fees` array sorted by code, and `total` 245000 | Smell #7; both fees in any order (`:112, 120-122, 124-125`) |
| `tariff.test.js` › `the daily cap limits the time charge` | C | `last.total <= DAY_CAP` replaced by `total` 6000, the `day-cap` discount of 6000 and 30000 charged that day | Smell #4: the bound held with the cap removed (`:105-106`) |
| `tariff.test.js` › `a 45-minute classic ride costs 50 UAH` | C | the mock and its `callCount` check removed: the test calls `quote`; the expected 5000 is unchanged | Smell #3: the test checked the mock, not the code (`:62, 66`) |
| `integration/receipt.test.js` › `every receipt of a week of rides ends with the amount due` | D | now ten tests, `T3, T9: every receipt ends with the amount due, …`, with fixed rides and literal amounts (`9126021`) | The flaky test: a wrong expected value at 30 and 60 min and random rides (`:29, 62, 66-67`; `docs/triage.md`, section 1) |
| `integration/receipt.test.js` › `a receipt lists the fee for a return outside the zone` | D | the fixed rider of the file instead of `randomRider()`; `app/test/helpers/factory.js` removed, no test imports it | No test draws a random value (`docs/triage.md`, section 1) |

Tests added to `app/test/unit/` in Task C: `a rider with no rides that day has been charged nothing`
and `§4: a missing ride is rejected with a QuoteError: ride null` / `…: ride undefined` (the agent's,
kept: `docs/test-quality.md`, section 3, rows 8 and 9), `app/test/unit/tariff-time-zone.test.js` (2
tests) and `app/test/unit/receipt-minus-sign.test.js` (6 tests, both section 4). Four tests the
agent added were reverted before submission and are not in the suite (section 3, rows 5-7).

---

Reviewed and approved by Yurii Slynko, 2026-11-07, updated 2026-11-08.
