# BUG-2: A ride of exactly 2 minutes is charged instead of being a false start

| Field | Value |
|---|---|
| **Spec rule** | T2: «Поїздка тривалістю не більше 2 хвилин (за T1) — без погодинного нарахування.» `docs/spec/tariffs.md:54` |
| **Environment** | Commit `4606c72` (`main`), Node v24.21.0, macOS 26.6.2 |
| **Severity** | Medium. The rider is overcharged 25 UAH on a classic bike or 40 UAH on an e-bike. It hits the rider the rule exists for: someone who returned a bike at once. The range of durations is narrow |
| **Frequency** | On condition: always when the real duration is 1 min 30 s to 2 min 00 s. From 1 min 00.001 s to 1 min 29.999 s the duration is also 2 min by T1, but BUG-1 rounds it down to 1 min, so the ride stays free |
| **Found by** | `app/test/spec/t2-false-start.test.js` › `T2: TC-12 2 min 00 s, no time charge`, `T2: TC-15 e-bike, 2 min, no time charge`. Saved in `ai-runs/b2-run.txt` |
| **Fix** | `69e9c31` fix(T2): treat a ride of exactly 2 minutes as a false start |

## Steps to reproduce

1. Make a copy of the original code: `mkdir -p ../ws12-main && git archive main app | tar -x -C ../ws12-main`.
2. In `../ws12-main`, call `quote` for a standard rider on a classic bike, pickup
   `2026-09-16T07:00:00Z`, return `2026-09-16T07:02:00Z`, station `S03`.
3. Read `timeCharge` and `total` in the result.

## Expected result (per spec)

The duration is 2 min, which is "not more than 2 minutes", so there is no time charge
(`docs/spec/tariffs.md:54`): `timeCharge` 0, `total` 0.

## Actual result

`timeCharge` and `total` are 2500: the code treats only durations under 2 min as a false start.

## Evidence

```bash
CHECK='import("./app/src/tariff.js").then(({ quote }) => console.log(JSON.stringify(quote(
  { pickupAt: "2026-09-16T07:00:00Z", returnAt: "2026-09-16T07:02:00Z", bike: "classic", returnStation: "S03" },
  { type: "standard" }))))'
(cd ../ws12-main && node -e "$CHECK")
node -e "$CHECK"
```

Before the fix (the first `node` line, on the copy of `main` from step 1):

```text
{"minutes":2,"timeCharge":2500,"discounts":[],"fees":[],"total":2500}
```

After the fix (the second `node` line, in the repo root):

```text
{"minutes":2,"timeCharge":0,"discounts":[],"fees":[],"total":0}
```

## Minimal input

Standard rider, classic bike, in-zone station, duration 2 min 00 s. With 1 min the defect is not
visible, the ride is free either way.

## Additional

- Location: `minutes < FREE_START_MINUTES` in `chargeFor`, `app/src/tariff.js:79` on `main`. The
  comparison is now `<=`.
- No existing test in `app/test/unit/` asserted this behaviour.
- Tests from code that pinned the defect: 2, both in `ai-runs/b1-from-code/tariff.test.js` ›
  `quote: time charge`: `charges 2500 for 2 min on a classic bike` and `makes the seconds decide
  between free and paid`. The second one also went red on the BUG-1 fix, see `docs/bugs/README.md`.
- BUG-1 hides part of this defect on `main`. With return `2026-09-16T07:01:20Z` (80 s) the check
  above prints `minutes` 1 and `total` 0, with return `2026-09-16T07:01:30Z` (90 s) it prints
  `minutes` 2 and `total` 2500. After the fixes both print `minutes` 2 and `total` 0.

---

Reviewed and approved by Yurii Slynko, 2026-11-07.
