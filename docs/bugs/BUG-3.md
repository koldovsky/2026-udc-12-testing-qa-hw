# BUG-3: Electric subscribers incorrectly receive free minutes

| Field | Value |
|---|---|
| Specification rule | T4, "Безкоштовних хвилин на електровелосипеді немає"; docs/spec/tariffs.md:76-77 |
| Environment | Original main 4606c72; Node v25.8.0; Windows; fixed commit 8d46577 |
| Severity | High: incorrect customer billing  |
| Frequency | Always for the input below |
| Found | app/test/spec/tariffs.test.js, TC-16; original eight-failure run in ai-runs/shared-context/b2-run.txt; canonical B2 evaluated separately |
| Fix | 8d46577; isolated source fix commit |

## Reproduction steps

1. Extract unchanged main into a separate directory: `git archive main app | tar -x -C <temporary-directory>`.
2. Run the command below from that extracted root.
3. Run the same command from the homework branch for the fixed result.

## Expected result (specification)

40 minutes, T3 8000 minus 20% (1600), total 6400.

## Actual result before fix

```json
{"minutes":40,"timeCharge":8000,"discounts":[{"code":"subscription","amount":8000}],"fees":[],"total":0}
```

## Evidence

```bash
node --input-type=module -e 'import {quote} from "./app/src/tariff.js";const ride={pickupAt:"2026-09-16T07:00:00Z",returnAt:"2026-09-16T07:30:01Z",bike:"classic",returnStation:"S01"};ride.returnAt="2026-09-16T07:40:00Z";ride.bike="ebike";console.log(JSON.stringify(quote(ride,{type:"subscriber"})));'
```

Original main output is above; fixed branch output:

```json
{"minutes":40,"timeCharge":8000,"discounts":[{"code":"subscription","amount":1600}],"fees":[],"total":6400}
```

## Minimal input

The command contains all required inputs; no network, shared state or system clock is used. Classic subscription retains its 45 free minutes.

## Additional context

Existing tests asserted incorrect behavior for BUG-1, BUG-3 and BUG-4; corrections are listed in docs/bugs/README.md. No change was made to the immutable inputs.
