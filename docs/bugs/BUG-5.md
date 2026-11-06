# BUG-5: A ride after midnight in Kyiv counts towards the previous day's cap

| Field | Value |
|---|---|
| **Spec rule** | T6: «Поїздка належить до тієї доби, на яку припадає момент її **взяття** за київським часом, навіть якщо вона завершилася наступної доби.» `docs/spec/tariffs.md:101-102`; term «Доба»: «Календарна дата за київським часом, від 00:00 до 24:00.» `docs/spec/tariffs.md:34` |
| **Environment** | Commit `4606c72` (`main`), Node v24.21.0, macOS 26.6.2 |
| **Severity** | Medium. Only pickups in the first 2 or 3 hours of the Kyiv day are affected. A rider at the cap pays 0 instead of 17.50 UAH for a ride at 00:30. In the other direction one Kyiv date gets two caps: on `main`, two rides on one Kyiv date paid 280 and 200 UAH, 480 UAH against a cap of 300 UAH (`ai-runs/b1-from-code/tariff.test.js` › `gives two separate caps within one Kyiv date`). It needs a ledger: `POST /api/quote` passes none today, which is open question Q-11 |
| **Frequency** | On condition: always when a ledger is used and the pickup is between 00:00 and 03:00 Kyiv time in summer, or between 00:00 and 02:00 in winter. The ride is then booked on the wrong date. The amount changes only when the daily cap comes into play |
| **Found by** | `app/test/spec/t6-day-cap.test.js` › `T6: TC-51 at cap on 16.09, pickup 00:30 on 17.09: the Kyiv date decides, not the UTC date`, `T6: TC-97 at cap on 16.09, pickup 00:00:00 on 17.09: the first moment of a new day`. Saved in `ai-runs/b2-run.txt` |
| **Fix** | `2c45deb` fix(T6): book rides on the Kyiv date, not the UTC date |

## Steps to reproduce

1. Make a copy of the original code: `mkdir -p ../ws12-main && git archive main app | tar -x -C ../ws12-main`.
2. In `../ws12-main`, create a ledger with `createDayCap()` and price three e-bike rides of 80 min
   for rider `R1`, pickups `2026-09-16T06:00:00Z`, `10:00:00Z` and `15:00:00Z`. The rider is now at
   the cap of 16.09.
3. With the same ledger, price a classic ride of 30 min, pickup `2026-09-16T21:30:00Z`, which is
   00:30 on 17.09 in Kyiv.
4. Read `dayKey` of that pickup and `total` in the result.

## Expected result (per spec)

The pickup falls on 17.09 by Kyiv time (`docs/spec/tariffs.md:34, 101-102`), a new day with a new
cap. The ride is 1 block of 2500 with the night discount of 30 % (`docs/spec/tariffs.md:141`), so
`total` is 1750.

## Actual result

`dayKey` returns `2026-09-16`, the UTC date. The ride counts towards the capped day, a `day-cap`
discount of 1750 is added and `total` is 0.

## Evidence

```bash
CHECK='Promise.all([import("./app/src/tariff.js"), import("./app/src/day-cap.js")]).then(([{ quote }, { createDayCap, dayKey }]) => {
  const dayCap = createDayCap();
  const rider = { id: "R1", type: "standard" };
  for (const [pickupAt, returnAt] of [["06:00", "07:20"], ["10:00", "11:20"], ["15:00", "16:20"]]) {
    quote({ pickupAt: `2026-09-16T${pickupAt}:00Z`, returnAt: `2026-09-16T${returnAt}:00Z`, bike: "ebike", returnStation: "S03" }, rider, { dayCap });
  }
  const night = { pickupAt: "2026-09-16T21:30:00Z", returnAt: "2026-09-16T22:00:00Z", bike: "classic", returnStation: "S03" };
  console.log(dayKey(night.pickupAt), JSON.stringify(quote(night, rider, { dayCap })));
})'
(cd ../ws12-main && node -e "$CHECK")
node -e "$CHECK"
```

Before the fix (the first `node` line, on the copy of `main` from step 1):

```text
2026-09-16 {"minutes":30,"timeCharge":2500,"discounts":[{"code":"night","amount":750},{"code":"day-cap","amount":1750}],"fees":[],"total":0}
```

After the fix (the second `node` line, in the repo root):

```text
2026-09-17 {"minutes":30,"timeCharge":2500,"discounts":[{"code":"night","amount":750}],"fees":[],"total":1750}
```

## Minimal input

`dayKey("2026-09-16T21:30:00Z")` alone shows it: `2026-09-16` on `main`, `2026-09-17` by the spec.
With a pickup at `2026-09-17T07:00:00Z`, 10:00 in Kyiv, the UTC and Kyiv dates match and the defect
is not visible.

## Additional

- Location: `dayKey`, `app/src/day-cap.js:7` on `main`. It took the date from `toISOString()`, which
  is always UTC. It now uses `kyivTime(pickupAt).date` from `app/src/kyiv-time.js`.
- No existing test in `app/test/unit/` asserted this behaviour: `the day of a ride is the date of
  its pickup` uses a pickup where both dates match.
- Tests from code that pinned the defect: 5, listed in `docs/bugs/README.md`. All 5 are in
  `unconfirmed:` blocks: the code run named this as a likely defect, and without the spec it could
  not settle it.
- With an empty ledger only the booked date differs. For the night ride above, `total` is 1750 on
  both. `dayCap.chargedOn("R1", day)` shows the 1750 on `2026-09-16` on `main` and on `2026-09-17`
  after the fix.
