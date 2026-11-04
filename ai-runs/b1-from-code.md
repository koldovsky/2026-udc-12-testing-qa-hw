- Інструмент і модель: GitHub Copilot CLI 1.0.96, окремий sub-agent `general-purpose` (модель sub-agent'а — за замовчуванням harness; головна сесія — Claude Opus 5.5), запущений головним агентом як нова сесія без історії
- Дата: 2026-11-04
- Що бачила сесія: тимчасова тека `../ws12-b1` — `app/src/` з `main` (`git archive main app/src`) + `package.json` з `{ "type": "module" }`
- Що було ввімкнено з пам'яті й глобальних правил: не вимикалося. Sub-agent стартував із CLI, відкритого в репо, тож у його системному контексті могли бути `AGENTS.md` / `CLAUDE.md` репо й пам'ять Copilot. Вмісту `docs/`, `app/test/` та інших файлів поза тимчасовою текою він не отримував. До промпта додано одне службове речення (англійською) з робочою текою — див. нижче.
- Тести агент поклав туди, куди просили: `../ws12-b1/ai-runs/b1-from-code/` (`tariff.test.js`, `day-cap.test.js`) — скопійовано в `ai-runs/b1-from-code/` без змін.
- Промпт (дослівно):

  > Your working directory for this task is /Users/sergii.osadchyi-external/IdeaProjects/udc-worksop/ws12-b1 (all relative paths and commands below are relative to it; run commands from there). Do not read or access anything outside that directory.
  >
  > У цій теці — код сервісу, який рахує вартість поїздок велопрокату громади (app/src/).
  > Читай лише файли в app/src/ і package.json у корені теки.
  > Напиши unit-тести для app/src/tariff.js і app/src/day-cap.js на вбудованому раннері Node
  > (node:test і node:assert/strict), без npm-залежностей. Поклади їх у теку
  > ai-runs/b1-from-code/ у файли *.test.js; модулі імпортуй шляхом ../../app/src/<файл>.js.
  > Запусти тести командою node --test "ai-runs/b1-from-code/*.test.js" і покажи результат.
  > Не змінюй app/src/. Уточнювальних питань не став; працюй з тим, що є.

---

I added two test files in `ai-runs/b1-from-code/`. All 46 tests pass with `node --test "ai-runs/b1-from-code/*.test.js"`; I didn't change `app/src/`.

```
# tests 46
# suites 10
# pass 46
# fail 0
```

On the first run one test failed because I had worked out the expected value wrong: `discount(333, 30)` returns 100, not 101. I fixed the test, not the code.

- **`tariff.test.js`** tests `quote()` and `discount()`:
  - **Time charge:** 30-minute blocks, the first 2 minutes free, classic vs e-bike rate, and how ride time is rounded to whole minutes.
  - **Discounts:** subscription (45 free minutes, 20% off paid e-bike blocks), reduced fare, a subscriber with concession getting the cheaper plan, and the night discount (pickup before 06:00 Kyiv time).
  - **Fees:** out-of-zone and unreturned fees, halved on the reduced fare and not limited by the daily cap.
  - **Daily cap:** with and without a ledger.
  - **Input checks:** bad or missing data is rejected.
- **`day-cap.test.js`** tests `dayKey` and `createDayCap`: the default and a custom limit, charges adding up, remaining never below zero, and separate totals per rider and per day.

These tests only describe what the code does now, since I read only `app/src/`, not the specification. One example: `dayKey` uses the UTC date, not the Kyiv date. A ride picked up at 01:30 Kyiv time is counted on the previous day. The test records this as current behaviour; checking it against the spec would show whether it's a bug.
