- Інструмент і модель: GitHub Copilot CLI 1.0.96, окремий sub-agent `general-purpose` (модель sub-agent'а — за замовчуванням harness; головна сесія — Claude Opus 5.5), запущений головним агентом як нова сесія без історії
- Дата: 2026-11-04
- Що бачила сесія: тимчасова тека `../ws12-c-rules` — `app/src/` з `main` (`git archive main app/src`, 4606c72, тобто код **до** виправлень Task B) + `package.json` з `{ "type": "module" }` + файл правил `app/AGENTS.md`, скопійований як `AGENTS.md` і `CLAUDE.md`. Специфікації немає.
- Що було ввімкнено з пам'яті й глобальних правил: не вимикалося. Sub-agent стартував із CLI, відкритого в репо, тож у його системному контексті могли бути `AGENTS.md` / `CLAUDE.md` кореня репо й пам'ять Copilot. Sub-agent не підхоплює `AGENTS.md` своєї тимчасової теки автоматично, тому текст `app/AGENTS.md` дослівно вставлено перед промптом як «project instructions» (так, як IDE підвантажує файл правил), разом зі службовим реченням про робочу теку (англійською). Решта промпта — дослівно той самий, що в `ai-runs/b1-from-code.md`.
- Тести агент поклав у `../ws12-c-rules/ai-runs/b1-from-code/` (`tariff.test.js`, `day-cap.test.js`) — скопійовано в `ai-runs/c-with-rules/` без змін. `app/src/` у копії не змінено (звірено з `main`).
- Промпт (дослівно):

  > Your working directory for this task is /Users/sergii.osadchyi-external/IdeaProjects/udc-worksop/ws12-c-rules (all relative paths and commands below are relative to it; run commands from there). Do not read or access anything outside that directory. Project instructions loaded from AGENTS.md in that directory (as an IDE loads them automatically):
  >
  > <project-instructions file="AGENTS.md">
  > # app/ — правила для агента
  >
  > Сервіс розрахунку вартості поїздок велопрокату. Код — `src/`, тести — `test/`
  > (`node --test`, без npm-залежностей). Специфікація — `docs/spec/tariffs.md` (правила T1–T10, §4).
  >
  > ## Тести
  >
  > 1. **Очікувані значення — лише зі специфікації**, ніколи з поточної поведінки коду. У назві
  >    тесту — ID правила (`T4: …`), біля очікуваного числа — коментар з рядком специфікації
  >    (`// tariffs.md:76-77`). Тест, що просто фіксує «як код рахує зараз», — не тест.
  > 2. **Специфікації немає або правило не дає відповіді — не вигадуй очікування.** Не пиши
  >    тест з назвою «(current behaviour)». Оформи кейс як `test.todo("Q: <питання>")` і перелічи
  >    ці питання у відповіді окремим списком. Тест, що закріплює поведінку без джерела, гірший,
  >    ніж відсутній тест.
  > 3. **Точні перевірки:** `assert.equal` / `assert.deepEqual` з літералом у копійках. Не
  >    використовуй як єдину перевірку `assert.ok(x < y)`, `>= 0`, `typeof`, `Array.isArray`,
  >    `.length`, `.some(...)` чи `includes` — вони проходять і за неправильної суми. Для
  >    знижок і зборів порівнюй увесь масив (`code` і `amount`) і `total`.
  > 4. **Не рахуй очікуване тією самою формулою чи константами коду** (`RATES`, `BLOCK_MINUTES`,
  >    `DAY_CAP`, `Math.ceil(minutes / 30)`): помилка в коді тоді повториться в тесті. Число —
  >    літерал, порахований вручну за специфікацією.
  > 5. **Тест викликає справжній код.** Не мокай `quote`, `dayKey` чи `createDayCap` і не
  >    перевіряй значення, яке повернув твій власний мок.
  > 6. **Межі — з обох боків**, для кожного правила: 2:00 / 2:01 (T2), 30:00 / 30:01 і
  >    30:29 / 30:30 (T1, T3), 45 / 46 хв (T4), 05:59 / 06:00 за Києвом (T10), 24:00:00 /
  >    24:00:01 (T8), 299 / 300 / 301 грн за добу (T6).
  > 7. **Час у тестах — київський, зі зсувом** (`2026-09-16T01:10:00+03:00`). Для T6 і T10 обов'язково
  >    є кейс, де дата за UTC і за Києвом різна (21:00Z–23:59Z).
  > 8. **Не послаблюй тест, щоб він пройшов.** Не змінюй перевірку чи очікуване значення, не
  >    видаляй тест і не став `skip` / `todo` без пояснення з рядком специфікації, чому старе
  >    очікування хибне. Код у `src/` під час роботи над тестами не змінюй — розбіжність з
  >    специфікацією опиши як дефект.
  > 9. **Одна поведінка — один тест**, без циклів і `if` у тілі тесту. Табличні кейси — окремим
  >    `test(...)` на рядок таблиці з ID кейсу в назві.
  > 10. **Некоректні дані (§4) — кожен випадок окремо:** повернення раніше взяття, невідомий
  >     велосипед, категорія, станція, `null` замість поїздки, момент без `Z` чи зсуву — кожен
  >     очікує саме `QuoteError`, а не будь-який виняток.
  > </project-instructions>
  >
  > У цій теці — код сервісу, який рахує вартість поїздок велопрокату громади (app/src/).
  > Читай лише файли в app/src/ і package.json у корені теки.
  > Напиши unit-тести для app/src/tariff.js і app/src/day-cap.js на вбудованому раннері Node
  > (node:test і node:assert/strict), без npm-залежностей. Поклади їх у теку
  > ai-runs/b1-from-code/ у файли *.test.js; модулі імпортуй шляхом ../../app/src/<файл>.js.
  > Запусти тести командою node --test "ai-runs/b1-from-code/*.test.js" і покажи результат.
  > Не змінюй app/src/. Уточнювальних питань не став; працюй з тим, що є.

---

I added two test files: `ai-runs/b1-from-code/tariff.test.js` and `ai-runs/b1-from-code/day-cap.test.js`. The run passes: 30 tests, 7 pass, 0 fail, 23 todo.

Most cases are recorded as questions, not checks. AGENTS.md says expected values must come only from the specification (`docs/spec/tariffs.md`), but I was told to read only `app/src/` and `package.json`. I didn't want to treat the code's current output as correct, so every case that needs a price is a `test.todo("Q: …")`. That means there are no real tests for `day-cap.js` yet.

The 7 passing tests cover invalid input: each case expects `QuoteError`, as AGENTS.md rule 10 requires:
- return before pickup
- unknown bike type
- unknown rider category
- unknown return station
- `null` instead of a ride
- `pickupAt` or `returnAt` without `Z` or an offset

Questions for the specification:
- **T1/T3:** What does a 30-minute block cost for each bike type? Where are the 30:00/30:01 and 30:29/30:30 boundaries, and how are seconds rounded?
- **T2:** Is 2:00 free and 2:01 charged?
- **T4:** Are 45 minutes free for subscribers, with minute 46 charged? What is the e-bike discount?
- **T5:** What percent is the reduced fare? Does it also reduce fees? With a concession, does the cheaper plan apply or both?
- **T6:** How much is the daily cap, and what happens at 299/300/301 UAH? Is the day the Kyiv date or the UTC date? The code books by UTC date, which may be a defect. Is the cap per rider, and does it apply after discounts?
- **T7/T8:** How much are the out-of-zone and unreturned fees? Is 24:00:00 still returned and 24:00:01 not? Is time still charged on top of the fee?
- **T9:** Are discounted amounts rounded down, up or to the nearest kopeck?
- **T10:** What percent is the night discount? Is 05:59 Kyiv time night and 06:00 not? Does it go by pickup or return time? In what order are the discounts applied?
