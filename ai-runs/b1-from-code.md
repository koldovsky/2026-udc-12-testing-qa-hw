- Інструмент і модель: Claude Code 2.1.321, Claude Opus 5.5 (`claude-opus-5-5`, effort high)
- Дата: 2026-11-10
- Що бачила сесія: тимчасова тека `../ws12-b1/` — лише `app/src/` з `main` і `package.json` з одним рядком `{ "type": "module" }`; без `docs/`, без `app/test/` і без інших `ai-runs/`. Агент поклав тести туди, куди просили (`../ws12-b1/ai-runs/b1-from-code/`); у репо вони скопійовані без змін (`diff -r` — без відмінностей)
- Що було ввімкнено з пам'яті й глобальних правил: пам'ять проєкту порожня, глобального `CLAUDE.md` немає; у `~/.claude/settings.json` — мова інтерфейсу (`"language": "english"`), модель і effort (`opus`, `effortLevel: high`), режим дозволів, налаштування інтерфейсу та hooks статус-бару iTerm2; жодне з них не додає вмісту в контекст (у транскрипті сесії немає контексту від hooks)
- Відповідь узято дослівно з транскрипту сесії Claude Code (`~/.claude/projects/-Users-vlad-Projects-rbi-ai-training-hw-ws12-b1/0cca238e-7036-4941-bd9a-d2e25c025414.jsonl`, повідомлення агента 2026-11-09T22:14:43Z) — це єдина текстова відповідь агента в сесії
- Промпт (дослівно):

  > У цій теці — код сервісу, який рахує вартість поїздок велопрокату громади (app/src/).
  > Читай лише файли в app/src/ і package.json у корені теки.
  > Напиши unit-тести для app/src/tariff.js і app/src/day-cap.js на вбудованому раннері Node
  > (node:test і node:assert/strict), без npm-залежностей. Поклади їх у теку
  > ai-runs/b1-from-code/ у файли *.test.js; модулі імпортуй шляхом ../../app/src/<файл>.js.
  > Запусти тести командою node --test "ai-runs/b1-from-code/*.test.js" і покажи результат.
  > Не змінюй app/src/. Уточнювальних питань не став; працюй з тим, що є.

---

I wrote 86 unit tests for `tariff.js` and `day-cap.js`, and all of them pass. Some of them lock in code behaviour that looks like a bug (listed below).

Result of `node --test "ai-runs/b1-from-code/*.test.js"`:

```
ℹ tests 86
ℹ suites 15
ℹ pass 86
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
```

**Files** (`app/src/` was not changed, and no npm packages were used):
- `ai-runs/b1-from-code/day-cap.test.js` (21 tests): how `dayKey` builds the day key, the default and custom limits in `createDayCap`, how charges add up, that the amount left never goes below zero, and that riders, days and ledgers are kept separate.
- `ai-runs/b1-from-code/tariff.test.js` (65 tests):
  - the tariff constants, and how `discount()` rounds;
  - the free first minute, 30-minute blocks rounded up, and ride length rounded to the nearest minute;
  - the subscription (45 free minutes, 20% off e-bikes), the reduced fare, and which plan a subscriber with a concession gets, including ties;
  - the night discount, checked at the 06:00 Kyiv boundary in both winter and summer time;
  - the daily cap, with and without a ledger, and the order the discounts are applied in;
  - the out-of-zone and unreturned fees, and halving them on the reduced fare;
  - input validation;
  - a check across many rider, length, bike, station and time combinations that the total equals the time charge minus discounts plus fees.

**Tests that lock in behaviour that may be a bug.** I only had the code, not the spec, so these tests record what the code does now. Each is marked "current behaviour" with a `NOTE` comment, so you can flip the expected value if the spec says otherwise:
1. **The daily cap uses the UTC date, not the Kyiv date.** `dayKey` uses `toISOString()`, while the night discount uses Kyiv time. A ride picked up at 01:30 Kyiv time is counted toward the previous day, so a rider can be charged the full cap twice in one Kyiv day.
2. **A reduced-fare rider can pay the full out-of-zone fee.** If the ride is under 2 minutes, there is no time charge, so the "reduced" plan is never chosen and the fee isn't halved. The rider pays 150 UAH instead of 75.

**Not tested:** dates like `2026-02-30T…Z` pass validation. Node's date parser rolls them over to 2 March instead of rejecting them.
