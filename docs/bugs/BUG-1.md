# BUG-1: A ride of 30 min 1 s is billed as 30 min, one block too few

| Field | Value |
|---|---|
| **Spec rule** | T1: «Неповна хвилина рахується як повна: тривалість округлюється вгору до цілих хвилин.» `docs/spec/tariffs.md:46-47` |
| **Environment** | Commit `4606c72` (`main`), Node v24.21.0, macOS 26.6.2 |
| **Severity** | High. Every ride whose last minute is under 30 s long is one minute short. The receipt shows the wrong duration. On a block boundary the rider pays one block too few (25 or 40 UAH). A ride of 24 h 00 min 01 s to 29 s escapes the 2 000 UAH fee of T8 |
| **Frequency** | On condition: always when the duration is a whole number of minutes plus 0.001 s to 29.999 s |
| **Found by** | `app/test/spec/t1-duration.test.js` › `T1: TC-05 30 min 01 s is 31 min, 2 blocks`, `T1: TC-06 12 min 00.001 s is 13 min`; `app/test/spec/t2-false-start.test.js` › `T2: TC-13 2 min 01 s is 3 min, 1 block`; `app/test/spec/t8-unreturned.test.js` › `T8: TC-67 24 h 00 min 01 s is 1441 min: the fee applies`. Saved in `ai-runs/b2-run.txt` |
| **Fix** | `4f9d5b8` fix(T1): round ride duration up to whole minutes |

## Steps to reproduce

1. Make a copy of the original code: `mkdir -p ../ws12-main && git archive main app | tar -x -C ../ws12-main`.
2. In `../ws12-main`, call `quote` for a standard rider on a classic bike, pickup
   `2026-09-16T07:00:00Z`, return `2026-09-16T07:30:01Z`, station `S03`.
3. Read `minutes` and `total` in the result.

## Expected result (per spec)

The ride lasts 30 min 1 s. A started minute counts as a full one, so the duration is 31 min
(`docs/spec/tariffs.md:46-47`). 31 min is 2 started blocks of 30 min (`docs/spec/tariffs.md:62`),
2 × 2500 = 5000 kopecks.

## Actual result

`minutes` is 30, `timeCharge` and `total` are 2500: the duration is rounded to the nearest minute,
which gives 1 block.

## Evidence

```bash
CHECK='import("./app/src/tariff.js").then(({ quote }) => console.log(JSON.stringify(quote(
  { pickupAt: "2026-09-16T07:00:00Z", returnAt: "2026-09-16T07:30:01Z", bike: "classic", returnStation: "S03" },
  { type: "standard" }))))'
(cd ../ws12-main && node -e "$CHECK")
node -e "$CHECK"
```

Before the fix (the first `node` line, on the copy of `main` from step 1):

```text
{"minutes":30,"timeCharge":2500,"discounts":[],"fees":[],"total":2500}
```

After the fix (the second `node` line, in the repo root):

```text
{"minutes":31,"timeCharge":5000,"discounts":[],"fees":[],"total":5000}
```

## Minimal input

Standard rider, classic bike, in-zone station, duration 30 min 1 s. With a duration of exactly
30 min 00 s the defect is not visible. With 30 min 30 s it is not visible either: rounding to the
nearest minute then gives the same 31 min.

## Additional

- Location: `Math.round` in `rideMinutes`, `app/src/tariff.js:71` on `main`. It was replaced with
  `Math.ceil`.
- Existing test that asserted the defect: `app/test/unit/tariff.test.js` › `a ride of 30 min 20 s
  is billed as one block`. It was updated by the spec, see `docs/bugs/README.md`.
- Tests from code that pinned the defect: 4, listed in `docs/bugs/README.md`.

---

Reviewed and approved by Yurii Slynko, 2026-11-07.
