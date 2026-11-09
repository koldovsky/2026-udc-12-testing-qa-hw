# BUG-4: The reduced fare halves the out-of-zone and unreturned bike fees

| Field | Value |
|---|---|
| **Spec rule** | T5: «Пільга не поширюється на збори (T7, T8).» `docs/spec/tariffs.md:87` |
| **Environment** | Commit `4606c72` (`main`), Node v24.21.0, macOS 26.6.2 |
| **Severity** | High. Every fee is halved when the reduced fare is the applied plan: 75 UAH less on the T7 fee, 1 000 UAH less on the T8 fee, 1 075 UAH on a ride with both. A false start has no applied plan, so its fee stays full |
| **Frequency** | On condition: always when the reduced fare is the applied plan and the ride has a fee |
| **Found by** | `app/test/spec/t5-concession.test.js` › `T5: TC-43 concession, 20 min, return X01: no discount on the fee`; `app/test/spec/t8-unreturned.test.js` › `T8: TC-69 concession, e-bike, 25 h: capped after the discount, no discount on the fee`. Saved in `ai-runs/b2-run.txt` |
| **Fix** | `3234a10` fix(T5): keep the reduced fare off the fees |

## Steps to reproduce

1. Make a copy of the original code: `mkdir -p ../ws12-main && git archive main app | tar -x -C ../ws12-main`.
2. In `../ws12-main`, call `quote` for a rider of type `reduced` on a classic bike, pickup
   `2026-09-16T07:00:00Z`, return `2026-09-16T07:20:00Z`, station `X01`.
3. Read `fees` and `total` in the result.

## Expected result (per spec)

20 min is 1 block, 2500 less 50 % is 1250. The reduced fare does not apply to fees
(`docs/spec/tariffs.md:87`), so the T7 fee stays 15000 (`docs/spec/tariffs.md:112`).
`total` is 1250 + 15000 = 16250.

## Actual result

The `out-of-zone` fee is 7500 and `total` is 8750.

## Evidence

```bash
CHECK='import("./app/src/tariff.js").then(({ quote }) => console.log(JSON.stringify(quote(
  { pickupAt: "2026-09-16T07:00:00Z", returnAt: "2026-09-16T07:20:00Z", bike: "classic", returnStation: "X01" },
  { type: "reduced" }))))'
(cd ../ws12-main && node -e "$CHECK")
node -e "$CHECK"
```

Before the fix (the first `node` line, on the copy of `main` from step 1):

```text
{"minutes":20,"timeCharge":2500,"discounts":[{"code":"reduced","amount":1250}],"fees":[{"code":"out-of-zone","amount":7500}],"total":8750}
```

After the fix (the second `node` line, in the repo root):

```text
{"minutes":20,"timeCharge":2500,"discounts":[{"code":"reduced","amount":1250}],"fees":[{"code":"out-of-zone","amount":15000}],"total":16250}
```

## Minimal input

Rider of type `reduced`, classic bike, 20 min, return at `X01`. With an in-zone station the defect
is not visible, there is no fee to halve. With a standard rider it is not visible either.

## Additional

- Location: the `.map` over `feesFor(...)` in `quote`, `app/src/tariff.js:63-65` on `main`. It was
  removed, fees now go to the total unchanged.
- Existing test that asserted the defect: `app/test/unit/tariff.test.js` › `reduced fare for a ride
  returned outside the zone`. It was updated by the spec, see `docs/bugs/README.md`.
- Tests from code that pinned the defect: 3, listed in `docs/bugs/README.md`.
- On `main` a false start keeps the full fee: rider `reduced`, return `2026-09-16T07:01:00Z` at
  `X01` gives `fees` 15000 and `total` 15000, because no plan is applied to a charge of 0.
- Three test cases added after the fix cover the combinations around this defect: `T5: TC-99`
  (a subscriber with a concession), `T8: TC-100` (both fees) and `T5: TC-101` (the false start
  above). TC-99 and TC-100 are red on `main` and green from `3234a10`. TC-101 is green on `main` too.
- The final answer of the code run noticed the halving but listed the rides with a full fee as the
  suspicious ones (`ai-runs/b1-from-code.md`). By the spec the full fee is the correct one.

---

Reviewed and approved by Yurii Slynko, 2026-11-07.
