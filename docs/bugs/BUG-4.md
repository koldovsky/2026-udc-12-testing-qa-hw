# BUG-4: Concession discounts incorrectly reduce fixed fees

| Field | Value |
|---|---|
| Specification rule | T5, "Пільга не поширюється на збори"; docs/spec/tariffs.md:86-87 |
| Environment | Original main 4606c72; Node v25.8.0; Windows; fixed commit 2a8e875 |
| Severity | High: incorrect customer billing including the 200000 unreturned fee |
| Frequency | Always for the input below |
| Found | app/test/spec/tariffs.test.js, TC-22, TC-23; original eight-failure run in ai-runs/shared-context/b2-run.txt; canonical B2 evaluated separately |
| Fix | 2a8e875; isolated source fix commit |

## Reproduction steps

1. Extract unchanged main into a separate directory: `git archive main app | tar -x -C <temporary-directory>`.
2. Run the command below from that extracted root.
3. Run the same command from the homework branch for the fixed result.

## Expected result (specification)

T3 5000 minus 2500 concession plus full 15000 fee = 17500.

## Actual result before fix

```json
{"minutes":40,"timeCharge":5000,"discounts":[{"code":"reduced","amount":2500}],"fees":[{"code":"out-of-zone","amount":7500}],"total":10000}
```

## Evidence

```bash
node --input-type=module -e 'import {quote} from "./app/src/tariff.js";const ride={pickupAt:"2026-09-16T07:00:00Z",returnAt:"2026-09-16T07:30:01Z",bike:"classic",returnStation:"S01"};ride.returnAt="2026-09-16T07:40:00Z";ride.returnStation="X01";console.log(JSON.stringify(quote(ride,{type:"reduced"})));'
```

Original main output is above; fixed branch output:

```json
{"minutes":40,"timeCharge":5000,"discounts":[{"code":"reduced","amount":2500}],"fees":[{"code":"out-of-zone","amount":15000}],"total":17500}
```

## Minimal input

The command contains all required inputs; no network, shared state or system clock is used. Standard riders already pay the full fee; concession time remains discounted.

## Additional context

Existing tests asserted incorrect behavior for BUG-1, BUG-3 and BUG-4; corrections are listed in docs/bugs/README.md. No change was made to the immutable inputs.
