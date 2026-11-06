# BUG-3: A subscriber rides an e-bike free for 45 minutes

| Field | Value |
|---|---|
| **Spec rule** | T4: «**Електровелосипед:** знижка 20 % на погодинне нарахування за T3. Безкоштовних хвилин на електровелосипеді немає.» `docs/spec/tariffs.md:76-77` |
| **Environment** | Commit `4606c72` (`main`), Node v24.21.0, macOS 26.6.2 |
| **Severity** | High. It affects most e-bike rides of subscribers, see Frequency. A 30 min ride pays 0 instead of 32 UAH, a 40 min ride 0 instead of 64 UAH, a 75 min ride 32 UAH instead of 96 UAH |
| **Frequency** | On condition: a subscriber on an e-bike, with a day pickup and no earlier charges that day. Without a concession the total is wrong on every ride of 3 to 315 min. From 316 min the wrong and the right amount both reach the daily cap: the total is the same and only the discount lines differ. With a concession the reduced fare hides the defect at 76-90 min, 106-120 min and from 136 min. These ranges were measured up to 840 min, see Additional |
| **Found by** | `app/test/spec/t4-subscription.test.js` › `T4: TC-30 subscriber, e-bike, 30 min is 4000 less 20 %`, `T4: TC-31 subscriber, e-bike, 40 min has no free minutes: 8000 less 20 %`, `T4: TC-32 subscriber, e-bike, 75 min is 12000 less 20 %`; `app/test/spec/t5-concession.test.js` › `T5: TC-42 subscriber with concession, e-bike, 30 min: concession is lower`; `app/test/spec/t6-day-cap.test.js` › `T6: TC-94 subscriber, e-bike, 300 min: the cap applies after 20 % off`; `app/test/spec/t7-out-of-zone.test.js` › `T7: TC-62 subscriber, e-bike, 30 min, return X01: no discount on the fee`; `app/test/spec/t9-amounts-receipt.test.js` › `T9: TC-96 receipt, subscriber, e-bike, 30 min: T3 and discount lines`. Saved in `ai-runs/b2-run.txt` |
| **Fix** | `5744f8c` fix(T4): give subscribers no free minutes on e-bikes |

## Steps to reproduce

1. Make a copy of the original code: `mkdir -p ../ws12-main && git archive main app | tar -x -C ../ws12-main`.
2. In `../ws12-main`, call `quote` for a subscriber on an e-bike, pickup `2026-09-16T07:00:00Z`,
   return `2026-09-16T07:40:00Z`, station `S03`.
3. Read `discounts` and `total` in the result.

## Expected result (per spec)

40 min is 2 blocks, 2 × 4000 = 8000 kopecks (`docs/spec/tariffs.md:62, 67`). A subscriber on an
e-bike has no free minutes and gets 20 % off (`docs/spec/tariffs.md:76-77`): the discount is 1600,
`total` is 6400.

## Actual result

The `subscription` discount is 8000 and `total` is 0: the 45 free minutes of the classic bike are
applied to the e-bike too.

## Evidence

```bash
CHECK='import("./app/src/tariff.js").then(({ quote }) => console.log(JSON.stringify(quote(
  { pickupAt: "2026-09-16T07:00:00Z", returnAt: "2026-09-16T07:40:00Z", bike: "ebike", returnStation: "S03" },
  { type: "subscriber" }))))'
(cd ../ws12-main && node -e "$CHECK")
node -e "$CHECK"
```

Before the fix (the first `node` line, on the copy of `main` from step 1):

```text
{"minutes":40,"timeCharge":8000,"discounts":[{"code":"subscription","amount":8000}],"fees":[],"total":0}
```

After the fix (the second `node` line, in the repo root):

```text
{"minutes":40,"timeCharge":8000,"discounts":[{"code":"subscription","amount":1600}],"fees":[],"total":6400}
```

## Minimal input

Subscriber, e-bike, in-zone station, 40 min. With a classic bike the defect is not visible: the
45 free minutes are correct there.

## Additional

- Location: `subscriptionCharge`, `app/src/tariff.js:83-86` on `main`. It subtracted the free
  minutes before it looked at the bike type. The e-bike branch now takes 20 % off the full T3
  charge.
- One defect made 7 tests red under five rule IDs: T4, T5, T6, T7 and T9.
- Existing test that asserted the defect: `app/test/unit/tariff.test.js` › `subscribers ride the
  first 45 minutes free`. It was updated by the spec, see `docs/bugs/README.md`.
- Tests from code that pinned the defect: 2, listed in `docs/bugs/README.md`.
- The ranges under Frequency come from comparing `total` on `main` and after the fixes for every
  whole minute, pickup `2026-09-16T07:00:00Z`, with the copy from step 1:

  ```bash
  node docs/evidence/task-b-check.mjs ../ws12-main/app/src
  ```

  ```text
  subscriber, 0-840 min: totals differ at 3-315; match at 0-2, 316-840
  subscriber with concession, 0-840 min: totals differ at 3-75, 91-105, 121-135; match at 0-2, 76-90, 106-120, 136-840
  subscriber with concession, 0-2000 min: totals differ at 3-75, 91-105, 121-135, 1441-2000; match at 0-2, 76-90, 106-120, 136-1440
  subscriber with concession, 1441 min: total 130000 on the base, 230000 on the other
  ```

  Two points of that comparison, with the check above:
  - Return `2026-09-16T12:16:00Z` (316 min): `total` 30000 on both. On `main` `subscription` is
    12000 and `day-cap` 2000, after the fixes 8800 and 5200.
  - Rider `{ type: "subscriber", concession: true }`, return `2026-09-16T08:16:00Z` (76 min):
    `reduced` 6000 and `total` 6000 on both.
- The comparison up to 2000 min shows that the totals of a subscriber with a concession differ
  again from 1441 min. That is BUG-4, not this defect: the T8 fee is halved on `main`. With rider
  `{ type: "subscriber", concession: true }` and return `2026-09-17T07:01:00Z` (1441 min), `total`
  is 130000 on `main` and with only `5744f8c` applied to it, and 230000 after all the fixes:

  ```bash
  rm -rf ../ws12-check && mkdir -p ../ws12-check
  git archive main app | tar -x -C ../ws12-check
  git show 5744f8c -- app/src > ../ws12-check/fix.diff
  (cd ../ws12-check && git init -q && git apply fix.diff)
  node docs/evidence/task-b-check.mjs ../ws12-main/app/src ../ws12-check/app/src | tail -1
  ```

  ```text
  subscriber with concession, 1441 min: total 130000 on the base, 130000 on the other
  ```
