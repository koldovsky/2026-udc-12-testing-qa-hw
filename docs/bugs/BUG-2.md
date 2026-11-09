# BUG-2: Exactly two minutes billed instead of free

| Field | Value |
|---|---|
| Specification rule | T2, "не більше 2 хвилин"; docs/spec/tariffs.md:54-55 |
| Environment | Original main 4606c72; Node v25.8.0; Windows; fixed commit c7be405 |
| Severity | High: incorrect customer billing  |
| Frequency | Always for the input below |
| Found | app/test/spec/tariffs.test.js, TC-04, TC-05; original eight-failure run in ai-runs/shared-context/b2-run.txt; canonical B2 evaluated separately |
| Fix | c7be405; isolated source fix commit |

## Reproduction steps

1. Extract unchanged main into a separate directory: `git archive main app | tar -x -C <temporary-directory>`.
2. Run the command below from that extracted root.
3. Run the same command from the homework branch for the fixed result.

## Expected result (specification)

2 minutes, time charge and total 0.

## Actual result before fix

```json
{"minutes":2,"timeCharge":2500,"discounts":[],"fees":[],"total":2500}
```

## Evidence

```bash
node --input-type=module -e 'import {quote} from "./app/src/tariff.js";const ride={pickupAt:"2026-09-16T07:00:00Z",returnAt:"2026-09-16T07:30:01Z",bike:"classic",returnStation:"S01"};ride.returnAt="2026-09-16T07:02:00Z";console.log(JSON.stringify(quote(ride,{type:"standard"})));'
```

Original main output is above; fixed branch output:

```json
{"minutes":2,"timeCharge":0,"discounts":[],"fees":[],"total":0}
```

## Minimal input

The command contains all required inputs; no network, shared state or system clock is used. A three-minute ride is chargeable; one or two minutes must be free.

## Additional context

Existing tests asserted incorrect behavior for BUG-1, BUG-3 and BUG-4; corrections are listed in docs/bugs/README.md. No change was made to the immutable inputs.
