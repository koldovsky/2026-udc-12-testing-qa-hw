# Flaky test and CI triage

Task D. Evidence commands run from the repo root. `node docs/evidence/task-d-check.mjs <mode>`
works on copies of `app/` in temporary folders and never touches the repo's files; its header
says what each mode does.

## 1. The flaky test on the local machine

- **Test:** `app/test/integration/receipt.test.js` › `every receipt of a week of rides ends with the
  amount due` (`ai-runs/d-repeat-before.txt:5-6`).
- **How often it failed:** 6 of 30 runs at commit `95db090` (`ai-runs/d-repeat-before.txt:2`). The
  other 136 tests were green in every run (`:11`).
- **Failure messages (verbatim):**
  - `ebike, 30 min from 2026-09-21T14:43:00.000Z: got "До сплати .......................... 40,00 грн", expected 80,00 грн` (`ai-runs/d-repeat-before.txt:7`)
  - `classic, 30 min from 2026-09-21T06:03:00.000Z: got "До сплати .......................... 25,00 грн", expected 50,00 грн` (`:9`)
- **Cause:** the test's expected value was wrong for two durations, and its rides were random. It
  expected `(Math.floor(minutes / 30) + 1) * PRICE[ride.bike]`
  (`app/test/integration/receipt.test.js:15` at `95db090`). A block is each started 30 minutes
  (`docs/spec/tariffs.md:29, 62`): a ride of exactly 30 min is 1 block and of 60 min is 2 blocks,
  where the formula gives 2 and 3. For every other duration the test could draw, the formula is
  right. The test drew 10 rides of 5 to 89 whole minutes from `Math.random()` with no seed
  (`app/test/helpers/factory.js:10, 15`; `receipt.test.js:13`, both at `95db090`). A run went red
  only when one of the 10 rides was 30 or 60 min long: 2 of 85 durations, 21.2 % of runs. The code
  was right every time.
- **Evidence:**

| # | Claim | Source (file:line, command and its output) |
|---|---|---|
| 1 | Only this test fails, and only in some runs | `ai-runs/d-repeat-before.txt:2-11`: 6 of 30 runs red, 136 tests green in all 30 |
| 2 | The test expects one block more than the code charges, at 30 min | `ai-runs/d-repeat-before.txt:7-9`: three distinct messages, all 30-minute rides, got 1 block (25,00 / 40,00 UAH), expected 2. At 60 min in other runs: `ci/runs/run-1144.log:187` (`classic, 60 min … got … 50,00 грн, expected 75,00 грн`), and in the `main` block of `repro` below |
| 3 | The spec gives 1 block for 30 min and 2 for 60 min, and the code agrees | `docs/spec/tariffs.md:29, 62, 66-67`. `T3: TC-19 classic, 60 min is 2 blocks` and `T3: TC-21 e-bike, 30 min is 1 block` (`app/test/spec/t3-time-charge.test.js:8, 10`) are green in all 30 runs (`ai-runs/d-repeat-before.txt:11`) |
| 4 | Of the durations the test could draw, the formula is wrong at 30 and 60 min only | `node docs/evidence/task-d-check.mjs odds`: `old oracle differs from the started blocks at: 30, 60 min (2 of 85)`. The started blocks are counted one by one there, not with the code's formula |
| 5 | Nothing but the random draw changes between runs | `git grep -nE "Math\.random\|Date\.now\|new Date\(\)\|performance\.now\|process\.env" 95db090 -- app/src app/test`: `Math.random()` only in `app/test/helpers/factory.js:10-11`; `process.env` only for `PORT` in `src/server.js:73` and `TZ` in a child process of `tariff-time-zone.test.js:26`. Pickups are 09:00-19:00 in Kyiv (`factory.js:7, 14`), so T10 never applies; stations are in the zone (`factory.js:4, 20`); the rider is `standard` (`:30`) and no day-cap ledger is passed (`receipt.test.js:17` at `95db090`) |
| 6 | The odds match the count | `odds`: `1 - (1 - 2/85)^10 = 21.2 %`, `expected red runs: 6.4 of 30; observed: 6 of 30` |
| 7 | The fixed test still catches the defect the old expectation described | `node docs/evidence/task-d-check.mjs sabotage`: with `blocks()` changed to `Math.floor(minutes / BLOCK_MINUTES) + 1`, exactly the four rows at 30 and 60 min turn red; all eleven tests are green on the unchanged code |

```text
$ node docs/evidence/task-d-check.mjs odds
durations on main: 5..89 min, whole minutes, 10 rides per test
old oracle differs from the started blocks at: 30, 60 min (2 of 85)
odds of a red run: 1 - (1 - 2/85)^10 = 21.2 %
expected red runs: 6.4 of 30; observed: 6 of 30 (ai-runs/d-repeat-before.txt:2)
expected red runs with the old test: 10.6 of 50
```

```text
$ node docs/evidence/task-d-check.mjs sabotage
receipt.test.js of 9126021; change in src/tariff.js: return Math.ceil(minutes / BLOCK_MINUTES); → Math.floor(minutes / BLOCK_MINUTES) + 1

code as is | changed | test
green      | green   | T3, T9: every receipt ends with the amount due, classic, 5 min is 1 block
green      | red     | T3, T9: every receipt ends with the amount due, classic, 30 min is 1 block
green      | green   | T3, T9: every receipt ends with the amount due, classic, 31 min is 2 blocks
green      | red     | T3, T9: every receipt ends with the amount due, classic, 60 min is 2 blocks
green      | green   | T3, T9: every receipt ends with the amount due, classic, 61 min is 3 blocks
green      | red     | T3, T9: every receipt ends with the amount due, e-bike, 30 min is 1 block
green      | green   | T3, T9: every receipt ends with the amount due, e-bike, 31 min is 2 blocks
green      | red     | T3, T9: every receipt ends with the amount due, e-bike, 60 min is 2 blocks
green      | green   | T3, T9: every receipt ends with the amount due, e-bike, 61 min is 3 blocks
green      | green   | T3, T9: every receipt ends with the amount due, e-bike, 89 min is 3 blocks
green      | green   | a receipt lists the fee for a return outside the zone
```

- **Fix:** commit `9126021`, `app/test/integration/receipt.test.js` only. The 10 random rides are
  replaced by a table of 10 fixed rides: classic and e-bike at 30 / 31 and 60 / 61 min, both sides
  of each block boundary, plus 5 min (classic) and 89 min (e-bike), the two ends of the old range.
  The expected amounts are literals from T3 (`docs/spec/tariffs.md:62, 66-67`), not a formula. The
  two 30-minute pickups are those of the failures in `ai-runs/d-repeat-before.txt:7, 9`. Each row
  is its own test with the rule IDs and the case in its name, for example `T3, T9: every receipt
  ends with the amount due, classic, 30 min is 1 block`, so a red row names its input. The check
  itself is unchanged: the last receipt line starts with `До сплати ` and ends with the amount.
  This removes the cause rather than the symptom: the wrong expectation is gone, and the input no
  longer changes between runs, so the boundary cases run in every run instead of in 21 % of them
  and a failure reproduces with the same input. No retry, wait, skip or weaker check was added.
  The suite goes from 137 to 146 tests: one test became ten rows, and its old name no longer
  exists. In `9126021` the second test of the file still took its rider from `randomRider()`; only
  the `id` was random there, and `quote` reads `rider.id` only with a day-cap ledger
  (`app/src/tariff.js:56, 61`), which that test does not pass. After `9126021` that test takes the
  same fixed rider as the table, and `app/test/helpers/factory.js`, which no test imports any more,
  is removed, so no test draws a random value: `git grep -n "Math.random" -- app` prints nothing.
- **After the fix:** 0 of 50 runs red, 146 tests, at `9126021` (`ai-runs/d-repeat-after.txt:1-2`).
  With the old test, 10.6 red runs of 50 were expected (`odds`). On the submitted state, with the
  fixed rider, without `factory.js` and with the unit tests changed and added after Task D
  (`docs/test-quality.md`, sections 3-5), the same command again:

```text
$ node tools/repeat.mjs 50
Прогонів: 50 (app: файлів 17, тестів 152)
Червоних прогонів: 0 з 50

Решта тестів (152) — зелені в усіх прогонах.

Час: 27.9 с
```
- **First AI answer** (`ai-runs/d-flaky-first.md`): the agent found the same cause and fixed the
  test. It replaced the formula with `Math.ceil(minutes / 30) * PRICE[ride.bike]` and added two
  fixed classic rides of 30 and 60 min in front of the 10 random ones (`ai-runs/d-flaky-first.diff`).
  Retry, sleep, skip or weakened check: **no**. What its fix leaves: the 10 random rides with no
  seed, so a later failure in that part would still not reproduce; an expected value computed with
  the code's own formula (`Math.ceil(minutes / BLOCK_MINUTES)`, `app/src/tariff.js:73`), which
  `app/AGENTS.md` rule 2 forbids (the run had no rules file, as step 2 asks); the boundary cases
  for the classic bike only and without 31 and 61 min; and all cases inside one test, so a red run
  does not name the case (rule 5). It checked its change with one run of 30 (`0 з 30`,
  `ai-runs/d-flaky-first.md:5`).

## 2. CI triage

Classes as in the template: **code** (a defect in the application code), **test** (a defect in a
test), **environment** (runner, network, other services) and **flaky** (the same code passes and
fails). Each change was reproduced on a fresh copy of `main`, as in `docs/walkthrough.md` (Task
D, step 4). `repro` runs the whole app suite 20 times on `main` and on `main` with each change,
to tell a failure that comes every time from the flaky test of section 1, which is still on
`main`:

```text
$ node docs/evidence/task-d-check.mjs repro      (abridged: counts only)
== main                              red runs  5 of 20   receipt.test.js › every receipt of a week of rides … 5/20
== main + ci/changes/run-1141.diff   red runs 20 of 20   clock-change.test.js › a ride on the night the clocks go back … 20/20 (180 !== 120); receipt.test.js 5/20
== main + ci/changes/run-1144.diff   red runs  3 of 20   receipt.test.js › every receipt of a week of rides … 3/20
== main + ci/changes/run-1147.diff   red runs  4 of 20   receipt.test.js › every receipt of a week of rides … 4/20
== main + ci/changes/run-1152.diff   red runs 20 of 20   tariff.test.js › a bike kept over a day and left outside the zone pays both fees 20/20 (1 !== 2); receipt.test.js 4/20
```

The counts of the receipt test differ from one call to the next; the 20 of 20 do not.

### Summary

| Run | Class | Main evidence | What to do |
|---|---|---|---|
| run-1141 | test | `ci/runs/run-1141.log:181-185`: `tariff.quote() miscounts the ride across the DST change`, `180 !== 120`. The test's ride, `02:30+03:00 → 04:30+02:00`, lasts 180 min (`dst`); T1 counts the time that actually elapsed (`docs/spec/tariffs.md:45-46`) | Fix the test in PR #231: 180 min and `timeCharge` 15000 |
| run-1144 | flaky | `ci/runs/run-1144.log:185-187`: the receipt test of section 1, `classic, 60 min … got … 50,00 грн, expected 75,00 грн`. The change touches only `app/public/index.html`; the re-run of the same commit passed (`ci/README.md:30`) | The fix of section 1 (`9126021`); nothing to change in PR #233 |
| run-1147 | environment | Tests 20 of 20 green (`ci/runs/run-1147.log:168-171`); the smoke step's server died with `EADDRINUSE: address already in use :::3000` (`:195`) and `curl` got 404 five times from another process (`:214-218`). The same happens with the code of `main` on a port that is taken (`smoke`) | Change the smoke step of the pipeline: its own port, fail when the server dies; find what holds port 3000 on the runner. Nothing to change in PR #236 |
| run-1152 | code | `ci/runs/run-1152.log:185-189`: `a bike kept over a day and left outside the zone pays both fees`, `1 !== 2`. T7 and T8 apply independently (`docs/spec/tariffs.md:121-122`); red in 20 of 20 runs (`repro`); a 48 h ride returned at X03 pays 450 UAH instead of 2 450 UAH (`fees`) | Fix `feesFor` in PR #238: `docs/bugs/CI-1152.md` |

The AI's answer is `ai-runs/d-ci-first.md`. It gives the same class for all four runs:
test, flaky, environment, code (`ai-runs/d-ci-first.md:22-25`). It applied no diff and ran no test
on a changed copy (8 of its commands were denied, `ai-runs/d-ci-first.md:5`), so every
reproduction in this section is the participant's. Where the details differ, the run's section
says so under «AI answer».

### run-1141

- **What fails:** step `npm test` (`ci/runs/run-1141.log:138`), test `test/unit/clock-change.test.js:8`
  › `a ride on the night the clocks go back is billed by the station clock`: `AssertionError:
  tariff.quote() miscounts the ride across the DST change`, `180 !== 120` (`:181-185`). The run of
  PR #231, branch `tests/clock-change-night`, commit `2618d88` (`ci/README.md:29`).
- **First error in the log:** `✖ a ride on the night the clocks go back is billed by the station
  clock` (`:150`). **Is it the cause?** Yes. The only line before it with a level is a warning,
  `npm warn Unknown project config "always-auth"` (`:126`), and `npm ci` and `npm audit` finished
  with `found 0 vulnerabilities` (`:130, :137`). `##[error]Process completed with exit code 1.`
  (`:199`) is the exit code of `npm test`.
- **What changed:** a new test file only, `app/test/unit/clock-change.test.js`
  (`ci/changes/run-1141.diff`, `new file mode 100644`). No application code changed. The failing
  test is the change itself.
- **Class:** test.
- **Evidence:**

| # | Claim | Source (log line, diff hunk, command) | Result |
|---|---|---|---|
| 1 | The test expects 120 min for the ride `2026-10-25T02:30:00+03:00 → 2026-10-25T04:30:00+02:00` and `timeCharge` 4 × 2500 | `ci/changes/run-1141.diff`, hunk `@@ -0,0 +1,19 @@`, lines `+10` to `+12` of the new file | confirmed |
| 2 | The ride lasts 180 min: 23:30Z to 02:30Z | `node docs/evidence/task-d-check.mjs dst`: `elapsed: 180 min` | confirmed |
| 3 | That night the Kyiv clock goes from 03:59:59 EEST back to 03:00:00 EET, so 02:30 → 04:30 on the station clock is 3 hours, not 2 | `dst`: `2026-10-25T00:59:59Z in Kyiv: 25/10/2026, 03:59:59 EEST`, `2026-10-25T01:00:00Z in Kyiv: 25/10/2026, 03:00:00 EET` | confirmed |
| 4 | The spec bills the time that actually elapsed, not the clock on the wall | T1: «Тривалість поїздки — фактичний час, що минув від моменту взяття до моменту повернення» (`docs/spec/tariffs.md:45-46`) | confirmed |
| 5 | The code returns what the spec asks: 180 min, 6 blocks, 15000 | `dst`: `quote() on main: minutes 180, timeCharge 15000`; 6 × 25 UAH (`docs/spec/tariffs.md:62, 66`) | confirmed |
| 6 | The failure is not random | `repro`: `20/20` with `180 !== 120` in every run | confirmed |

```text
$ node docs/evidence/task-d-check.mjs dst
pickup 2026-10-25T02:30:00+03:00 = 2026-10-24T23:30:00.000Z
return 2026-10-25T04:30:00+02:00 = 2026-10-25T02:30:00.000Z
elapsed: 180 min
2026-10-25T00:59:59Z in Kyiv: 25/10/2026, 03:59:59 EEST
2026-10-25T01:00:00Z in Kyiv: 25/10/2026, 03:00:00 EET
quote() on main: minutes 180, timeCharge 15000
```

- **What was rejected and why:**
  - A code defect, as the test's own message says («tariff.quote() miscounts the ride»): the code
    returns the elapsed time that T1 asks for (rows 2, 4, 5).
  - Flaky: red in 20 of 20 runs (row 6).
  - The runner's time zone: the instants carry their offsets, so the result does not depend on
    `TZ`. CI (`:185`) and the local run in the Kyiv time zone (row 5) give the same 180.
  - The AI's caveat that a spec asking for the station clock would make it a code defect
    (`ai-runs/d-ci-first.md:73-76`): its folder had no spec. T1 settles it (row 4).
- **Fix:** in the test of PR #231, expect `minutes` 180 and `timeCharge` 15000 (6 blocks,
  `docs/spec/tariffs.md:62, 66`) for this ride, and say in the test name and message that the ride
  is billed by the elapsed time. The second test of the file (`a ride the evening before the change
  is not affected`) passed (`:151`) and needs no change. No change to `app/src/`.
- **AI answer:** test defect, the same class (`ai-runs/d-ci-first.md:36-76`). Same arithmetic and
  the same fix; it also offers a return at `03:30+02:00` that does last 2 hours. It did not run the
  test or `quote()` (its `node` probe was denied, `ai-runs/d-ci-first.md:5`), and it hedged on the
  spec it did not have.

### run-1144

- **What fails:** step `npm test` (`ci/runs/run-1144.log:144`), test
  `test/integration/receipt.test.js:11` › `every receipt of a week of rides ends with the amount
  due`: `classic, 60 min from 2026-09-21T08:14:00.000Z: got "До сплати .......................... 50,00 грн", expected 75,00 грн`
  (`:185-187`). The run of PR #233, branch `ui/return-hint`, commit `e3dc84e` (`ci/README.md:30`).
- **First error in the log:** `npm error code ENOAUDIT` (`:137`), after three `getaddrinfo
  EAI_AGAIN npm-mirror.example.net` (`:132-136`), followed by the first `##[error]Process completed
  with exit code 1.` (`:142`). **Is it the cause?** No. That step is `npm audit`, which has
  `continue-on-error: true` (`ci/README.md:20`); the log says `npm audit failed, continue-on-error
  is set: the job continues` (`:143`) and `npm test` ran next (`:144`). The failure that stopped
  the job is the test above; its `##[error]` is `:200`.
- **What changed:** `app/public/index.html` only: a CSS class `.hint` and a paragraph
  `<p id="return-hint">` tied to the return field (`ci/changes/run-1144.diff`, hunks
  `@@ -16,6 +16,7 @@` and `@@ -47,8 +48,9 @@`). Not related: the failing test imports
  `src/receipt.js` and `src/tariff.js` (`app/test/integration/receipt.test.js:4-5` on `main`) and
  never reads the page.
- **Class:** flaky.
- **Evidence:**

| # | Claim | Source (log line, diff hunk, command) | Result |
|---|---|---|---|
| 1 | The failing test is the flaky test of section 1, at its 60-minute case | `:185-187`; section 1, rows 2-4 | confirmed |
| 2 | The same commit passed when re-run | `ci/README.md:30`: «1 — помилка; 2 (перезапуск того самого коміту) — успішно» | confirmed |
| 3 | The change does not reach the failing test; the page test passed | the diff touches `app/public/index.html` only; `✔ GET / serves the page and GET /api/health answers` (`:160`) | confirmed |
| 4 | `main` fails the same way without the change, and the change adds no failure | `repro`: `main` 5 of 20, `main + run-1144.diff` 3 of 20, the receipt test only in both | confirmed |

- **What was rejected and why:**
  - The first error, `npm audit` (`EAI_AGAIN`, `ENOAUDIT`): environment noise, the job went on
    (`:143`).
  - A defect in PR #233: it changes only the page, and the failure appears on `main` without it
    (rows 3, 4).
  - A code defect in the receipt: 60 min is 2 blocks, 50 UAH, as printed (`docs/spec/tariffs.md:62, 66`).
  - Environment: the failure reproduces on a local machine (row 4).
- **Fix:** the fix of section 1, commit `9126021`. Nothing to change in PR #233. The re-run that
  passed did not fix anything: it drew other durations.
- **AI answer:** flaky, the same class (`ai-runs/d-ci-first.md:80-119`), with the same mechanism
  and the same 21 %. It proposes a seeded generator or fixed boundary cases; section 1 takes fixed
  cases with literal amounts from the spec. It also says to handle the false start of «`< 2 хв`»
  in the formula (`:114-115`): the spec says not more than 2 minutes (`docs/spec/tariffs.md:54`),
  and the test never draws less than 5 min, so it does not apply here.

### run-1147

- **What fails:** step 6, smoke: `npm start &` and `curl -fsS http://127.0.0.1:3000/api/health`,
  five tries (`ci/runs/run-1147.log:176-182`). The server process stops with `Error: listen
  EADDRINUSE: address already in use :::3000` at `app/src/server.js:74:33` (`:195-199`); every
  `curl` gets `curl: (22) The requested URL returned error: 404` (`:214-218`). The run of PR #236,
  branch `chore/port-parsing`, commit `40a6678` (`ci/README.md:31`).
- **First error in the log:** `throw er; // Unhandled 'error' event` (`:192`) and `Error: listen
  EADDRINUSE: address already in use :::3000` (`:195`). **Is it the cause?** Yes, of the failed step:
  the server never started, so the health check had nothing of ours to reach. The 404s
  (`:214-218`) follow from it. The cause behind it is outside the code: another process already
  held port 3000 on the runner. Before it, `npm test` passed: `ℹ tests 20`, `ℹ fail 0` (`:168, :171`).
- **What changed:** `app/src/server.js`: `Number(process.env.PORT ?? 3000)` became
  `Number.parseInt(process.env.PORT ?? "", 10) || 3000`, and the start-up line changed
  (`ci/changes/run-1147.diff`, hunk `@@ -70,8 +70,8 @@`). Not related to this failure: with `PORT`
  unset, as in the step (its `env:` holds `CI: true` only, `:184-185`), both versions listen on 3000.
- **Class:** environment.
- **Evidence:**

| # | Claim | Source (log line, diff hunk, command) | Result |
|---|---|---|---|
| 1 | The tests pass; only the smoke step fails | `:168-171` (`pass 20`, `fail 0`), `:176` (`Run npm start &`), `:219` | confirmed |
| 2 | The port was taken before our server started, by a process that answers 404 | `:195` `EADDRINUSE … :::3000`; `:214-218` `curl: (22) … 404`. Our server answers `/api/health` with 200 and `{"status":"ok"}` (`app/src/server.js:5` on `main`; `smoke`, first line) | confirmed |
| 3 | The process is not our test step: the tests never open a port | `app/src/server.js:7` and `app/test/unit/server.test.js:6` on `main` (`tests never open a port`); `git grep -n "listen(" main -- app/test` prints nothing | confirmed |
| 4 | With `PORT` unset, the PR's code and the code of `main` both take port 3000 | `smoke`, first line: `Number(PORT ?? 3000) = 3000`, `Number.parseInt(PORT ?? "", 10) \|\| 3000 = 3000` | confirmed |
| 5 | On a free port the PR's server starts and answers | `smoke`: `PR #236, free port: … GET /api/health → 200 {"status":"ok"}` | confirmed |
| 6 | On a taken port the PR's server and the server of `main` fail exactly as in the log | `smoke`: both `server exit code 1, "Error: listen EADDRINUSE: address already in use :::<port>"; GET /api/health → 404 not found` | confirmed |
| 7 | The re-run of the same commit failed too | `ci/README.md:31`: «2 (перезапуск того самого коміту) — помилка». Only the first attempt's log is in `ci/` (`ci/README.md:8`), so the second attempt's error is not known | confirmed; reason of the second attempt not seen |
| 8 | The runner image changed this week: `20261013.1` in runs 1141 and 1144, `20261020.1` in runs 1147 and 1152 | line 12 of each log | confirmed; that the new image holds port 3000 is an **assumption**: run 1152 on the same image never reached the smoke step (its tests failed, and step 6 runs only after green tests, `ci/README.md:22-23`) |

```text
$ node docs/evidence/task-d-check.mjs smoke
PORT unset: main Number(PORT ?? 3000) = 3000; PR #236 Number.parseInt(PORT ?? "", 10) || 3000 = 3000

PR #236, free port: server printed "Велопрокат громади слухає порт 49820"; GET /api/health → 200 {"status":"ok"}
PR #236, port taken: server exit code 1, "Error: listen EADDRINUSE: address already in use :::49822"; GET /api/health → 404 not found
main, port taken: server exit code 1, "Error: listen EADDRINUSE: address already in use :::49822"; GET /api/health → 404 not found
```

The script passes the port in `PORT`, so it does not need port 3000 on the local machine; the ports
differ between calls. The step of the log itself, with port 3000 and `curl`, on a copy of `main`
with the change and then without it, while another process holds port 3000 and answers 404 (run
with `bash` from the repo root; `lsof` prints nothing, so port 3000 was free before the check):

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
COPY=$(mktemp -d) && git archive main app ci | tar -x -C "$COPY" && git -C "$COPY" init -q && git -C "$COPY" apply ci/changes/run-1147.diff
node -e 'require("node:http").createServer((req, res) => { res.statusCode = 404; res.end(); }).listen(3000)' & OCC=$!
sleep 1
for version in "PR #236" "main"; do
  [ "$version" = "main" ] && git -C "$COPY" apply -R ci/changes/run-1147.diff
  echo "== $version"
  npm --prefix "$COPY/app" start > "$COPY/server.out" 2>&1 & SERVER=$!
  for i in 1 2 3 4 5; do curl -fsS http://127.0.0.1:3000/api/health && break; sleep 1; done
  wait $SERVER; echo "npm start exit code: $?"
  grep -E "^Error:|^Node.js" "$COPY/server.out"
done
kill $OCC; rm -rf "$COPY"
```

```text
== PR #236
curl: (22) The requested URL returned error: 404
curl: (22) The requested URL returned error: 404
curl: (22) The requested URL returned error: 404
curl: (22) The requested URL returned error: 404
curl: (22) The requested URL returned error: 404
npm start exit code: 1
Error: listen EADDRINUSE: address already in use :::3000
Node.js v24.21.0
== main
curl: (22) The requested URL returned error: 404
curl: (22) The requested URL returned error: 404
curl: (22) The requested URL returned error: 404
curl: (22) The requested URL returned error: 404
curl: (22) The requested URL returned error: 404
npm start exit code: 1
Error: listen EADDRINUSE: address already in use :::3000
Node.js v24.21.0
```

The shell's last line, the notice that the helper on port 3000 was terminated, is left out. The
lines match the log: `Error: listen EADDRINUSE: address already in use :::3000` (`:195`) and five
`curl: (22) The requested URL returned error: 404` (`:214-218`), with the code of the PR and with
the code of `main`.

- **What was rejected and why:**
  - A code defect in PR #236: with `PORT` unset both versions take 3000 (row 4), the PR's server
    works on a free port (row 5), and the server of `main` fails the same way on a taken port
    (row 6).
  - Flaky: the failure is not in a test, and the re-run failed too (row 7).
  - A test defect: all tests passed (row 1).
- **Fix:** in the pipeline, not in PR #236. (1) Start the smoke server on a port of its own and
  check that port: `PORT=<port> npm start &` and `curl … http://127.0.0.1:<port>/api/health`.
  (2) Fail at once when the server process has exited (`kill -0 $!` in the loop) and check the body
  `{"status":"ok"}`, not only the status, so that another service on the port cannot pass or hide
  the crash. (3) Find out what holds port 3000 on image `20261020.1`, for example with
  `ss -ltnp 'sport = :3000'` before `npm start`, and raise it with whoever maintains the runners.
  Not the cause, and a question for the PR's author: the new parsing turns `PORT=0`, which used to
  give a free port, and `PORT=""` into 3000.
- **AI answer:** environment, the same class (`ai-runs/d-ci-first.md:123-165`), with the same
  evidence from the log and the same pipeline changes. It states the image regression as a finding
  and proposes to report it or pin the image (`:141-142, :159-160`); this section keeps that as an
  assumption (row 8). Its reproduction attempts were denied (`ai-runs/d-ci-first.md:5`).

### run-1152

- **What fails:** step `npm test` (`ci/runs/run-1152.log:144`), test `test/unit/tariff.test.js:64`
  › `a bike kept over a day and left outside the zone pays both fees`: `Expected values to be
  strictly equal:`, `1 !== 2` (`:185-189`). The run of PR #238, branch `refactor/fees`, commit
  `27fba14` (`ci/README.md:32`).
- **First error in the log:** `npm error code ENOAUDIT` (`:137`), after three `connect ETIMEDOUT
  192.0.2.41:443` (`:132-136`), and the first `##[error]` (`:142`). **Is it the cause?** No, for the
  same reason as in run-1144: `continue-on-error is set: the job continues` (`:143`), and the tests
  ran (`:144`). The failure that stopped the job is the test above; its `##[error]` is `:205`.
- **What changed:** `feesFor` in `app/src/tariff.js` (`ci/changes/run-1152.diff`, hunk
  `@@ -102,11 +102,15 @@`). The old version pushed each fee into one array; the new one returns at
  the first fee that applies:
  `if (zone === "out") return [fee("out-of-zone", OUT_OF_ZONE_FEE)];`. A ride that is both out of
  the zone and over 24 h never reaches the T8 line. Related: this is the cause.
- **Class:** code.
- **Evidence:**

| # | Claim | Source (log line, diff hunk, command) | Result |
|---|---|---|---|
| 1 | The spec charges T7 and T8 independently, both on one ride | T8: «Збори T7 і T8 нараховуються незалежно один від одного: до однієї поїздки можуть застосовуватися обидва.» (`docs/spec/tariffs.md:121-122`) | confirmed |
| 2 | The test asserts what the spec says: a 48 h ride returned at X03 has two fees | `app/test/unit/tariff.test.js:64-66` on `main`; X03 is outside the zone (`docs/spec/tariffs.md:176`) | confirmed |
| 3 | `main` charges both fees, the change drops the T8 fee | `fees`: on `main` `[out-of-zone 15000, unreturned 200000]`, total 245000; with the change `[out-of-zone 15000]`, total 45000 | confirmed |
| 4 | Only the combination is affected | `fees`: 24 h 01 min at S03 (230000) and 20 min at X03 (17500) give the same result on both | confirmed |
| 5 | The failure is not random | `repro`: `20/20` with `1 !== 2` in every run | confirmed |
| 6 | The spec tests of this branch catch it too | `fees`, last block: with the change on `9126021`, `T8: TC-68 25 h, return X02: both fees`, `T8: TC-100 …`, `T9: TC-78 …` and the unit test go red | confirmed |

```text
$ node docs/evidence/task-d-check.mjs fees
== main
48 h, return X03 (the test of app/test/unit/tariff.test.js:64 on main): fees [{"code":"out-of-zone","amount":15000},{"code":"unreturned","amount":200000}], total 245000
24 h 01 min, return X03: fees [{"code":"out-of-zone","amount":15000},{"code":"unreturned","amount":200000}], total 245000
24 h 01 min, return S03 (in zone): fees [{"code":"unreturned","amount":200000}], total 230000
20 min, return X03: fees [{"code":"out-of-zone","amount":15000}], total 17500
== main + ci/changes/run-1152.diff
48 h, return X03 (the test of app/test/unit/tariff.test.js:64 on main): fees [{"code":"out-of-zone","amount":15000}], total 45000
24 h 01 min, return X03: fees [{"code":"out-of-zone","amount":15000}], total 45000
24 h 01 min, return S03 (in zone): fees [{"code":"unreturned","amount":200000}], total 230000
20 min, return X03: fees [{"code":"out-of-zone","amount":15000}], total 17500
== 9126021 + ci/changes/run-1152.diff, the whole app suite: 4 red
  T8: TC-68 25 h, return X02: both fees
  T8: TC-100 concession, e-bike, 25 h, return X01: no discount on either fee
  T9: TC-78 receipt, 25 h, return X01: T3, cap, T7 and T8 lines (cap amount depends on Q-1, not asserted)
  a bike kept over a day and left outside the zone pays both fees
```

- **What was rejected and why:**
  - The first error, `npm audit` (`ETIMEDOUT`): environment noise, the job went on (`:143`).
  - A test defect: the test asserts T8 as written (rows 1, 2).
  - Flaky: 20 of 20 runs red (row 5).
- **Fix:** in PR #238, collect the fees again instead of returning at the first one; the report
  is `docs/bugs/CI-1152.md`. The diff was not applied to `main` or to this branch.
- **AI answer:** code defect, the same class (`ai-runs/d-ci-first.md:169-213`), with the same fix.
  It did not run the changed code (`ai-runs/d-ci-first.md:5`); the amounts in row 3 are from
  `fees`.

### Common to all runs, not a cause

- `npm audit` could not reach `npm-mirror.example.net` in runs 1144 and 1152 (`EAI_AGAIN`,
  `ETIMEDOUT`); the step has `continue-on-error` and only adds noise and time (about 37 s in run
  1152, `ci/runs/run-1152.log:126, 137`).
- `npm warn Unknown project config "always-auth"` in every run (`run-1141.log:126`), and
  `Node.js 20 actions are deprecated … actions/setup-node@v4` at the end of every log
  (`run-1141.log:214`).
- `Failed to save: Unable to reserve cache` in runs 1144 and 1152 (`run-1144.log:204`,
  `run-1152.log:209`), after the job had already failed.
