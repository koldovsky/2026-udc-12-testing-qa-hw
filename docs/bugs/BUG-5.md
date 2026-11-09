# BUG-5: Daily cap resets at UTC rather than Kyiv midnight

| Field | Value |
|---|---|
| Specification rule | T6, "взяття за київським часом"; docs/spec/tariffs.md:100-103 |
| Environment | Original main 4606c72; Node v25.8.0; Windows; fixed commit 89398f0 |
| Severity | High: incorrect customer billing  |
| Frequency | Always for the input below |
| Found | app/test/spec/tariffs.test.js, TC-26; original eight-failure run in ai-runs/shared-context/b2-run.txt; canonical B2 evaluated separately |
| Fix | 89398f0; isolated source fix commit |

## Reproduction steps

1. Extract unchanged main into a separate directory: `git archive main app | tar -x -C <temporary-directory>`.
2. Run the command below from that extracted root.
3. Run the same command from the homework branch for the fixed result.

## Expected result (specification)

Day 2026-09-17; remaining 30000 (00:10 Kyiv starts a new day).

## Actual result before fix

```json
{"day":"2026-09-16","remaining":1000}
```

## Evidence

```bash
node --input-type=module -e 'import {dayKey,createDayCap} from "./app/src/day-cap.js";const ledger=createDayCap();ledger.record("r1","2026-09-16T20:00:00Z",29000);console.log(JSON.stringify({day:dayKey("2026-09-16T21:10:00Z"),remaining:ledger.remaining("r1","2026-09-16T21:10:00Z")}));'
```

Original main output is above; fixed branch output:

```json
{"day":"2026-09-17","remaining":30000}
```

## Minimal input

The command contains all required inputs; no network, shared state or system clock is used. Two pickups on the same Kyiv calendar date must share their allowance.

## Additional context

Existing tests asserted incorrect behavior for BUG-1, BUG-3 and BUG-4; corrections are listed in docs/bugs/README.md. No change was made to the immutable inputs.
