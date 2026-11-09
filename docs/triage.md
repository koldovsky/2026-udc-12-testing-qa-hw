# Flaky test and CI triage

## 1. Local flaky test

- Test: app/test/integration/receipt.test.js / every receipt of a week of rides ends with the amount due.
- Frequency before: 11 failures in 30 runs; all other 82 tests passed every time (ai-runs/d-repeat-before.txt).
- Example: classic,30 min: actual 25,00 грн, expected 50,00 грн; ebike,60 min: actual 80,00 грн, expected 120,00 грн.
- Cause: the test used unseeded random 5..89-minute rides and an incorrect oracle (floor(minutes/30)+1). Exactly 30/60 minutes should use 1/2 blocks by T3:62-67, but the test expected 2/3.
- Source evidence before: main app/test/integration/receipt.test.js:12-15 and app/test/helpers/factory.js:10-15; deterministic 60-minute reproduction is saved in ai-runs/d-ci-reproductions.txt run-1144.
- For each generated ride there are 85 equally likely integer durations; 2 are bad boundaries. A ten-ride sample has approximate failure probability 1-(83/85)^10 = 21.2%; the observed 11/30 is a finite sample, not a required rate.
- Fix: retain the original receipt prefix and exact amount-suffix assertions; use 16 literal rows covering both bikes at 5,29,30,31,59,60,61,89 minutes, with fixed daytime pickup instants across a week and a fixed standard rider.
- The second receipt fixture also uses the fixed rider; no app pricing source change is needed.
- After: 0 failures in 50 runs, all 83 tests (ai-runs/d-repeat-after.txt); no retry,sleep,skip or lowered monetary tolerance.
- First AI response: corrected the oracle and replaced random data with fixed cases; retries/sleep/skip/weakened assertion: no (ai-runs/d-flaky-first.md and .diff).
- The first AI patch remained in its snapshot; the participant branch fix was independently authored and retains the original test name, extends deterministic rows and preserves exact receipt checks.
- Setup deviation: the first-response snapshot captured the current working tree rather than HEAD because root commit approval was pending; it excluded participant rules/docs and had its own clean app/tools/package git baseline.
- Participant sign-off: still required before submission; the evidence and classifications here were prepared by the agent.

## 2. CI triage

### Summary

| Run | Class | Primary evidence | Action | AI class |
|---|---|---|---|---|
| 1141 | Test defect | run-1141.log:194-195 actual 180, expected 120; offset changes add a real hour | Correct elapsed-duration expectation; retain DST regression | Test defect |
| 1144 | Flaky test | run-1144.log:187 classic 60 min, 5000 actual vs 7500 expected; Math.random plus bad boundary oracle | Deterministic boundary table and corrected oracle | Flaky test |
| 1147 | Environment | run-1147.log:195 EADDRINUSE on 3000 after tests pass | Isolate smoke port and clean only owned process | Environment |
| 1152 | Code defect | run-1152.log:200-201 fees 1 vs 2; diff early return | docs/bugs/CI-1152.md | Code defect |

These classifications agree with ai-runs/d-ci-first.md, but are independently checked against the approved specification and patched main copies.
There is one code-defect run: 1152; no CI diffs were applied to the participant branch.
Correctness of classification remains for mentor review.

### run-1141

- Failing step: unit tests; clock-change.test.js, log:150,181-195.
- First error: log:183 AssertionError, actual 180/expected 120 at 194-195; yes, this is the blocking cause, not a warning.
- Changed: ci/changes/run-1141.diff:8-18 adds a DST test that uses wall-clock difference.
- Class: test defect; spec:45-47 explicitly requires actual elapsed time.
- Evidence: 02:30+03:00 = 23:30Z previous date; 04:30+02:00 = 02:30Z; elapsed 180 min, base 6*2500=15000.
- Reproduction: ai-runs/d-ci-reproductions.txt run-1141; git apply succeeded, focused suite exits 1 with 180 != 120.
- Rejected: pricing arithmetic defect; two explicit offsets establish actual elapsed time independently of tariff implementation.
- Fix: expect minutes 180 and timeCharge 15000; rename test; avoid asserting night total across an unresolved boundary.
- AI: test defect, agrees; its code-oriented analysis did not have the specification, while this review cites T1.

### run-1144

- Failing step: receipt integration test, log:154,185-197.
- First error: log:137 ENOAUDIT/EAI_AGAIN and step exit:142; no, audit is explicitly continue-on-error at 143.
- Blocking error: log:187 expects 75 UAH for exactly 60 classic minutes; T3:62-66 gives two blocks = 50 UAH; test-step exit:200.
- Changed: ci/changes/run-1144.diff:8-22 changes HTML/CSS accessibility hint only; pricing/test oracle unchanged.
- Class: flaky test; app/test/helpers/factory.js:10-15 chooses unseeded random minutes 5..89; receipt.test.js:15 adds a block at exact 30/60-minute boundaries.
- Evidence: ci/README.md:30 reports retry of same commit passes; exact boundary mechanism explains the varying outcome, rather than inferring it from retry alone.
- Reproduction: patched main, deterministic 60-min classic quote prints actual 5000 and badOracle 7500 in ai-runs/d-ci-reproductions.txt.
- Rejected: audit/network as blocking root cause because tests ran; UI hint as pricing regression because it touches no pricing code.
- Fix: replace random coverage with literal boundary rows for both bikes; retain exact receipt assertion and correct expected block rule.
- AI: flaky test, agrees.

### run-1147

- Failing step: smoke after all 20 tests pass, log:168-175.
- First error: log:195 listen EADDRINUSE on :::3000; yes, server cannot bind, and this explains subsequent 404s at 214-218.
- Changed: ci/changes/run-1147.diff:9-13 changes PORT parsing and launch message; log:185-187 environment shows CI=true and no PORT override.
- Class: environment; both before and after choose 3000 when PORT is unset.
- Evidence: ai-runs/d-ci-reproductions.txt run-1147 gives before=3000,after=3000 on the applied main snapshot; health route remains present in app/src/server.js:28-29.
- Inference: a different listener returned the 404s after this process failed to bind; the log cannot establish that listener's identity.
- Rejected: missing route; tests pass and diff does not change routing. PORT=0 does change behavior with the new expression, but no evidence shows that value in this run.
- Fix: allocate an isolated port, pass the same port to launch and curl, verify the owned process bound successfully, clean up that PID; do not kill arbitrary listeners.
- AI: environment, agrees.

### run-1152

- Failing step: unit test for simultaneous fees, log:170,185-201.
- First error: log:137 ENOAUDIT/ETIMEDOUT, step exit:142; no, continue-on-error:143 explicitly lets tests run.
- Blocking error: assertion fees.length=1 instead of 2, log:200-201; test-step exit:205.
- Changed: ci/changes/run-1152.diff:15-17 uses early returns, so an outside-zone ride never reaches unreturned check.
- Class: code defect; T8:121-122 requires independent fees; T7:111-112 and T8:119-120 set 15000 and 200000.
- Reproduction: ai-runs/d-ci-reproductions.txt run-1152 applies the diff to original main and reproduces 1 != 2; ai-runs/d-ci-1152-quote.txt shows total 45000 vs approved 245000.
- Rejected: audit timeout as cause because tests ran; equivalent refactor because two conditions can be true simultaneously.
- Fix: accumulate both fees independently; proposed only, see docs/bugs/CI-1152.md.
- AI: code defect, agrees.
