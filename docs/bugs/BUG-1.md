# BUG-1: Fractional ride minutes undercharged

| Field | Value |
|---|---|
| Specification rule | T1, "тривалість округлюється вгору"; docs/spec/tariffs.md:45-47 |
| Environment | Original main 4606c72; Node v25.8.0; Windows; fixed commit ae765e1 |
| Severity | High: incorrect customer billing  |
| Frequency | Always for the input below |
| Found | app/test/spec/tariffs.test.js, TC-01, TC-06; original eight-failure run in ai-runs/shared-context/b2-run.txt; canonical B2 evaluated separately |
| Fix | ae765e1; isolated source fix commit |

## Reproduction steps

1. Extract unchanged main into a separate directory: `git archive main app | tar -x -C <temporary-directory>`.
2. Run the command below from that extracted root.
3. Run the same command from the homework branch for the fixed result.

## Expected result (specification)

31 minutes, base/total 5000; every started minute rounds up.

## Actual result before fix

```json
{"minutes":30,"timeCharge":2500,"discounts":[],"fees":[],"total":2500}
```

## Evidence

```bash
node --input-type=module -e 'import {quote} from "./app/src/tariff.js";const ride={pickupAt:"2026-09-16T07:00:00Z",returnAt:"2026-09-16T07:30:01Z",bike:"classic",returnStation:"S01"};console.log(JSON.stringify(quote(ride,{type:"standard"})));'
```

Original main output is above; fixed branch output:

```json
{"minutes":31,"timeCharge":5000,"discounts":[],"fees":[],"total":5000}
```

## Minimal input

The command contains all required inputs; no network, shared state or system clock is used. Removing the extra second gives one block.

## Additional context

Existing tests asserted incorrect behavior for BUG-1, BUG-3 and BUG-4; corrections are listed in docs/bugs/README.md. No change was made to the immutable inputs.
