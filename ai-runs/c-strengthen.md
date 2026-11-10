- Інструмент і модель: Claude Code, Claude Opus 5.5 (claude-opus-5-5)
- Дата: 2026-11-10
- Що бачила сесія: репо (гілка `ws12/Whereuare`, коміт `13ba25a`); `CLAUDE.md` → `AGENTS.md` репо
- Що було ввімкнено з пам'яті й глобальних правил: файлова пам'ять Claude Code (каталог
  `~/.claude/projects/…/memory/`) — увімкнена, але жодних спогадів у контекст не підвантажено;
  глобального `~/.claude/CLAUDE.md` у контексті сесії не було. Агент запускав
  `node tools/mutate.mjs`, бо цього вимагав промпт.
- Промпт (дослівно):

  > npm run mutate рахує мутаційний бал тестів app/test/unit/ і app/test/spec/ для
  > app/src/tariff.js і app/src/day-cap.js. Посиль тести, щоб мутаційний бал виріс.
  > Запусти npm run mutate до і після змін і покажи обидва підсумки.

---

The mutation score went from **92.8% to 97.6%**. Four of the six surviving mutants are now killed, and the other two can't be killed by any test.

**Before**
```
файл                мутантів     вбито    вижило   таймаут     score
app/src/tariff.js         76        71         5         0    93.4 %
app/src/day-cap.js         7         6         1         0    85.7 %
разом                     83        77         6         0    92.8 %
  M016  tariff.js:47   plan.amount > 0  →  > 1
  M018  tariff.js:50   due > 0          →  due >= 0
  M019  tariff.js:50   due > 0          →  due > 1
  M064  tariff.js:115  !ride || typeof ride !== "object"  →  &&
  M075  tariff.js:131  typeof value !== "string" || !ISO.test(value)  →  &&
  M083  day-cap.js:27  chargedOn(...) ?? 0  →  ?? 1
```

**After** (unit + spec tests: 109 → 120, `assert` calls: 45 → 65)
```
файл                мутантів     вбито    вижило   таймаут     score
app/src/tariff.js         76        74         2         0    97.4 %
app/src/day-cap.js         7         7         0         0   100.0 %
разом                     83        81         2         0    97.6 %
  M016, M019 — still alive
```

**What I changed** (only test files: `app/test/unit/tariff.test.js` and `app/test/unit/day-cap.test.js`; nothing is committed)

- **M018:** night rides with nothing to pay now check the whole `discounts` list with `deepEqual`. One is a subscriber's 30-minute classic ride at night, the other a false start at night. With the mutant, an extra `{ code: "night", amount: 0 }` line appeared.
- **M064:** `quote(null)` and `quote(undefined)` must throw a `QuoteError` with the message "ride is required". With the mutant, a plain `TypeError` came from deeper in the code.
- **M075:** two new checks:
  - A date-time with no `Z` or offset is refused. The mutant accepted it and read it in the server's local time.
  - A value that isn't a string is refused, even when it converts to a valid date-time string (for example `["2026-09-16T10:00:00Z"]`).
- **M083:** `chargedOn` returns 0 for a rider or day with no rides.
- **Weak checks in `day-cap.test.js`:**
  - `remaining < DAY_CAP` is replaced with exact values: 18000 left, 0 when over the cap, and 30000 for the default cap.
  - New tests cover a custom limit, keeping charges separate per rider and per day, and using the Kyiv date rather than the UTC date (23:40Z is already the next day in Kyiv).

**Why M016 and M019 survive:** they don't change the result for any real input, so no test can catch them. The smallest non-zero `plan.amount` is 800 kopecks (20% off one e-bike block), and the smallest non-zero `due` is 1250 (half of one classic block). Because prices come in whole blocks, neither value can ever be exactly 1, so `> 0` and `> 1` always give the same answer.

**A failure you'll see that my changes didn't cause:** `npm test` fails now and then on "every receipt of a week of rides ends with the amount due" in `app/test/integration/receipt.test.js`. That test uses random data, and it failed in about 1 of 6 runs even with my changes stashed. The mutation tool doesn't run integration tests, so it doesn't affect the score. The new unit and spec tests passed 5 out of 5 runs.
