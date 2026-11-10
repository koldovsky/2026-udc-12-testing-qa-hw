- Інструмент і модель: Claude Code 2.1.321, Claude Opus 5.5 (`claude-opus-5-5`, effort high)
- Дата: 2026-11-10
- Що бачила сесія: тимчасова тека `../ws12-c-smells/` — копія поточного `app/` (`mkdir -p ../ws12-c-smells && cp -r app ../ws12-c-smells/`, код після виправлень Task B, разом з `app/test/spec/` і `app/test/unit/` з коментарями-посиланнями на рядки специфікації); без `docs/` і без інших `ai-runs/`. Агент сам записав відповідь у `../ws12-c-smells/ai-runs/c-smells.md`; файл скопійовано без змін (`cmp` — однакові), шапку додано над його текстом
- Що було ввімкнено з пам'яті й глобальних правил: пам'ять проєкту порожня, глобального `CLAUDE.md` немає; у `~/.claude/settings.json` — мова інтерфейсу (`"language": "english"`), модель і effort (`opus`, `effortLevel: high`), режим дозволів, налаштування інтерфейсу та hooks статус-бару iTerm2; жодне з них не додає вмісту в контекст (у транскрипті сесії немає контексту від hooks)
- Промпт (дослівно):

  > У цій теці — застосунок (app/): код у app/src/ і тести в app/test/.
  > Знайди тестові «запахи» (test smells) у тестах app/test/unit/. Для кожного: файл:рядок,
  > назва тесту, назва запаху і чому це проблема. Нічого не змінюй.
  > Запиши відповідь у файл ai-runs/c-smells.md.
  > Уточнювальних питань не став; працюй з тим, що є.

---

# Test smells in `app/test/unit/`

Scope: `app/test/unit/*.test.js` (4 files, 18 tests, all passing). Nothing in `app/` was changed.
To check each claim, I ran the real `quote()` against the test inputs. The "actual value" notes below come from those runs.

Severity: **High** means the test can pass while the behaviour it names is broken. **Medium** means the oracle is weak or the test is hard to diagnose. **Low** is style or maintainability.

## Summary

| # | File:line | Test | Smell | Severity |
|---|-----------|------|-------|----------|
| 1 | `tariff.test.js:84` | a 45-minute classic ride costs 50 UAH | Mocking the SUT / testing the mock | High |
| 2 | `tariff.test.js:74` | the daily cap limits the time charge | Assertion that cannot fail (ineffective oracle) + loop | High |
| 3 | `tariff.test.js:9` | quote returns an itemised price | No oracle (shape-only assertions) + conditional logic (loop) + vague name | High |
| 4 | `tariff.test.js:31` | e-bikes are billed at the e-bike rate | Logic in test / expected value re-computed from production code | High |
| 5 | `tariff.test.js:60` | night rides get 30 % off | Weak assertion; the name promises more than the test checks | Medium |
| 6 | `tariff.test.js:46` | subscription on a long e-bike ride | Weak assertion + name that states no expectation | Medium |
| 7 | `tariff.test.js:69` | a bike kept over a day and left outside the zone pays both fees | Weak assertion (count only) | Medium |
| 8 | `day-cap.test.js:5` | charges recorded for a day reduce what is left of the cap | Weak assertion (`<` instead of exact value) | Medium |
| 9 | `day-cap.test.js:11` | the day of a ride is the date of its pickup | Non-discriminating test data (misses the Kyiv-vs-UTC rule) | Medium |
| 10 | `receipt-format.test.js:11` | a receipt has a line for every item | Magic number + weak/partial assertion | Medium |
| 11 | `tariff.test.js:39` | subscribers ride the first 45 minutes … free, not of an e-bike | Loop in test / two cases in one test | Low |
| 12 | `server.test.js:29` | GET / serves the page and GET /api/health answers | Eager test ("and" in the name) + missing checks | Low |
| 13 | `receipt-format.test.js:5` | amounts are shown in hryvnias | Eager test / assertion roulette | Low |
| 14 | `server.test.js:46` / `receipt-format.test.js:20` | (see below) | Over-loose string matching (`endsWith` / `includes`) | Low |

---

## Details

### 1. `app/test/unit/tariff.test.js:84`: "a 45-minute classic ride costs 50 UAH"
**Smell:** Mocking the System Under Test, also called "testing the mock" or *The Liar*.

```js
const priceRide = mock.fn(() => ({ minutes: 45, timeCharge: 5000, discounts: [], fees: [], total: 5000 }));
const result = priceRide(ride(...), standard);
assert.equal(result.total, 5000);
assert.equal(priceRide.mock.callCount(), 1);
```
**Why it's a problem:** `quote()` is never called. The test checks that a stub returns the value it was told to return and that the test called it once. No production code runs. If 45 minutes were priced at 1 block or at 3, the test would stay green. The test name makes a claim about the tariff that the test never checks, so it gives false confidence and false coverage.
The real `quote()` returns 5000 for this ride, so the fix is to call `quote` and drop the mock.

### 2. `app/test/unit/tariff.test.js:74`: "the daily cap limits the time charge"
**Smell:** An assertion that cannot fail (ineffective or tautological oracle), plus loop logic in the test.

```js
for (...) last = quote(..., rider, { dayCap });
assert.ok(last.total <= DAY_CAP);
```
**Why it's a problem:** Each ride is an 80-minute e-bike ride, so it costs 3 × 4000 = 12000 without any cap. 12000 ≤ 30000 is always true. The assertion holds even if the cap is not applied at all: without a ledger the third ride costs 12000, which passes. The test also never checks the cumulative effect, which is the point of a *daily* cap. Actual totals are `[12000, 12000, 6000]`, so the third ride should be exactly 6000 and include a `day-cap` discount of 6000. The test checks neither.
The `for` loop with `let last` also hides the first two results and makes failures harder to read.

### 3. `app/test/unit/tariff.test.js:9`: "quote returns an itemised price"
**Smells:** Missing oracle (shape-only assertions), conditional test logic (a loop over inputs), and a vague name.

**Why it's a problem:**
- The assertions only check types and that `total >= 0`. A `quote` that always returned `{ minutes: 0, discounts: [], fees: [], total: 0 }` would pass.
- The three inputs are useful edge cases: a 1-minute free start (T2), 50 minutes giving 2 blocks, and a 130-minute e-bike ride. Their expected prices are never checked, so the test spends good data on nothing.
- Because of the loop, a failure does not say which ride broke. No assertion carries a message.
- The name says "itemised price" but no item is checked.

### 4. `app/test/unit/tariff.test.js:31`: "e-bikes are billed at the e-bike rate"
**Smell:** Logic in the test, where the expected value mirrors the implementation (tautological test).

```js
assert.equal(result.timeCharge, Math.ceil(result.minutes / BLOCK_MINUTES) * RATES.ebike);
```
**Why it's a problem:** The expected value is computed with the same formula and the same constants (`BLOCK_MINUTES`, `RATES.ebike`) as `src/tariff.js`. It also takes `result.minutes` from the output under test. If `RATES.ebike` were wrong against the spec (say 4500 instead of 4000), or `BLOCK_MINUTES` were wrong, or minutes were miscounted, the test would still pass. It only proves the code agrees with itself.
The expected value should be a literal taken from the spec: 75 min gives 3 blocks, which is 12000.

### 5. `app/test/unit/tariff.test.js:60`: "night rides get 30 % off"
**Smell:** Weak assertion. The name claims a specific percentage that is never checked.

**Why it's a problem:** The test checks `timeCharge === 2500`, that there is one discount with code `night`, and `total < timeCharge`. A night discount of 1 % or 99 % would pass. The 30 % from the name is never checked.
The actual value is `discounts[0].amount === 750` and `total === 1750`, and those exact values should be asserted.

### 6. `app/test/unit/tariff.test.js:46`: "subscription on a long e-bike ride"
**Smells:** Weak assertion, and a name that says nothing about the expected behaviour.

**Why it's a problem:** The name names a scenario but not an outcome, so a reader cannot tell what is supposed to happen. The assertions (`some(code === "subscription")` and `total < timeCharge`) accept any non-zero discount. The rule is T4: 20 % off the e-bike price, with no free minutes. A wrong percentage, or 45 free minutes wrongly applied to e-bikes, would still pass.
The actual result is timeCharge 16000, discount 3200 and total 12800.

### 7. `app/test/unit/tariff.test.js:69`: "a bike kept over a day and left outside the zone pays both fees"
**Smell:** Weak assertion that checks only the count.

**Why it's a problem:** `assert.equal(result.fees.length, 2)` passes for any two fees: wrong codes, wrong amounts, or the same fee twice. The test does not check that the fees are `out-of-zone` (15000) and `unreturned` (200000). It also does not check `total`, which here combines the day cap with both fees and is the interesting interaction. The actual total is 245000.

### 8. `app/test/unit/day-cap.test.js:5`: "charges recorded for a day reduce what is left of the cap"
**Smell:** Weak assertion, an inequality instead of the exact expected value.

**Why it's a problem:** `remaining(...) < DAY_CAP` passes if the ledger subtracts any positive amount: 1 kopeck, double the charge, or the charge doubled by mistake. The correct result is exactly `30000 − 12000 = 18000`.
The test also does not cover the important negative cases: another day or another rider must not be affected, and `remaining` must never go below 0.

### 9. `app/test/unit/day-cap.test.js:11`: "the day of a ride is the date of its pickup"
**Smell:** Non-discriminating (insensitive) test data. Only the happy path is covered.

**Why it's a problem:** `dayKey` must return the **Kyiv** calendar date (`src/day-cap.js:7`, T6). The input `2026-09-16T08:00:00Z` is 11:00 in Kyiv, and the UTC date is the same as the Kyiv date. A naive `iso.slice(0, 10)` would pass, so the test cannot catch the bug it should guard against.
A value such as `2026-09-15T22:30:00Z` should map to `2026-09-16`, and it is missing.

### 10. `app/test/unit/receipt-format.test.js:11`: "a receipt has a line for every item"
**Smells:** Magic number, and a partial assertion that does not match the name.

**Why it's a problem:**
- The `5` is unexplained. It is duration, time charge, 1 discount, 1 fee and total, but the reader has to work that out.
- The name promises "a line for every item", but only the line count and the last line are checked. The discount and fee lines could have wrong labels ("Знижка: нічна", "Збір: повернення поза зоною"), wrong signs (the discount should be negative) or a wrong order, and the test would still pass.
- `includes("185,00")` would also match `"1 185,00 грн"`. See #14.

### 11. `app/test/unit/tariff.test.js:39`: "subscribers ride the first 45 minutes of a classic bike free, not of an e-bike"
**Smell:** A loop in the test (two cases folded into one), a mild form of conditional test logic.

**Why it's a problem:** Two independent rules (classic is free, e-bike gets 20 % off) live in one test. If the first case fails, the second never runs. The `bike` message on the assertion reduces the diagnosis cost, which is why this is Low. Two named tests, or a table-driven pattern that registers one `test` per case, would read better.

### 12. `app/test/unit/server.test.js:29`: "GET / serves the page and GET /api/health answers"
**Smells:** Eager test (two behaviours, with "and" in the name) and missing checks.

**Why it's a problem:** It checks two unrelated endpoints. If `/` fails, `/api/health` is never checked. It also leaves gaps:
- For `/`, the body is not compared with the injected page, even though it is known exactly.
- For `/api/health`, the status (200) and the content type are not checked. Only the body is.

### 13. `app/test/unit/receipt-format.test.js:5`: "amounts are shown in hryvnias"
**Smell:** Eager test, a mild assertion roulette.

**Why it's a problem:** Three different formatting rules sit in one test: a basic amount, the thousands separator and the negative sign. The first failure hides the others, and the test name does not say which rule broke. `assert/strict` prints actual and expected values, so the cost is low. Separate tests, one per rule, would document the format better. Kopecks below 10 (e.g. `5` → `"0,05 грн"`) and zero are not covered.

### 14. Over-loose string matching
- `app/test/unit/server.test.js:46`, "POST /api/quote returns the quote and the receipt": `endsWith("50,00 грн")` also accepts `"150,00 грн"` or `"2 050,00 грн"`.
- `app/test/unit/receipt-format.test.js:20` (see #10): `includes("185,00")` also accepts `"1 185,00 грн"`.

**Why it's a problem:** Substring checks on formatted money accept wrong amounts that share a suffix. The exact line, or at least the exact amount token, should be compared, for example a match on `/ 50,00 грн$/` with a preceding space.

---

## Tests without notable smells
- `tariff.test.js:25`, "a ride of 30 min 20 s is billed as two blocks": exact literal expectations, and the comment points to the spec.
- `tariff.test.js:54`, "reduced fare for a ride returned outside the zone": exact total from the spec. The fee is accessed by position (`fees[0]`), which is minor.
- `tariff.test.js:91`, "a return before the pickup is rejected".
- `server.test.js:49`, "POST /api/quote answers 400 to a body that is not JSON".

## Patterns across files
- **Weak oracles are the main problem.** Many tests use `<`, `<=`, `.length` or `some()` where the spec gives exact kopeck amounts (#2, #5, #6, #7, #8). Bugs in percentages, rates and caps survive.
- **Tests check less than their names promise** (#1, #3, #5, #10). A reader of the test list would think more is covered than really is.
- **Loops in tests** (#2, #3, #11) hide which case failed.
