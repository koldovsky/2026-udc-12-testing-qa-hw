# Червоні тести і дефекти

> Task B. Червоні тести з `ai-runs/b1-run.txt` (тести AI «з коду», початковий код) і `ai-runs/b2-run.txt`
> (`npm test` з тестами `app/test/spec/` до виправлень). Оракул — `docs/spec/tariffs.md`.

## Класифікація червоних тестів

**`ai-runs/b1-run.txt` — червоних тестів немає:** `# tests 63`, `# pass 63`, `# fail 0`. Тести, написані з
коду, стверджують поведінку цього самого коду, тож на ньому вони зелені за побудовою.

**`ai-runs/b2-run.txt` — 10 червоних:**

| # | Тест (файл › назва) | Прогін | Клас | Доказ (рядок специфікації, команда і вивід) | Що зроблено |
|---|---|---|---|---|---|
| 1 | `app/test/spec/t01-t03-duration-and-hourly.test.js` › `T1: TC-03 30 min 20 s → 31 min, 2 blocks` | зі специфікації | дефект коду | `:46-47` «округлюється вгору»; `quote(10:00:00 → 10:30:20)` → `minutes: 30, total: 2500` (BUG-1, «Доказ») | BUG-1 |
| 2 | `…duration-and-hourly.test.js` › `T2: TC-07 exactly 2:00 → 2 min → 0` | зі специфікації | дефект коду | `:54` «не більше 2 хвилин — без погодинного»; `quote(10:00 → 10:02)` → `timeCharge: 2500` (BUG-2) | BUG-2 |
| 3 | `…duration-and-hourly.test.js` › `T2: TC-08 2:01 → 3 min → 1 block` | зі специфікації | дефект коду | `:46-47`: 2:01 → 3 хв; у виводі `b2-run.txt` `actual: 2` / `expected: 3` для `minutes`. Та сама причина, що й № 1 (`Math.round`) | BUG-1 |
| 4 | `app/test/spec/t04-t05-discounts.test.js` › `T4: TC-21 subscriber, e-bike 40 min → 8000 − 20 %` | зі специфікації | дефект коду | `:76-77` «безкоштовних хвилин на електровелосипеді немає»; `quote(абонент, ebike, 40 хв)` → `total: 0` (BUG-3) | BUG-3 |
| 5 | `…discounts.test.js` › `T4: TC-22 subscriber, e-bike 75 min → 12000 − 20 %` | зі специфікації | дефект коду | `:76-77`; очікується 9600, фактично 3200 (`b2-run.txt`) | BUG-3 |
| 6 | `…discounts.test.js` › `T5: TC-29 subscriber+concession, e-bike 40 min …` | зі специфікації | дефект коду | `:89-91` — обирається менша сума: абонемент 6400 > пільга 4000. Код дає абонемент 0, бо рахує безкоштовні хвилини для електро. Причина та сама, що в № 4 | BUG-3 |
| 7 | `…discounts.test.js` › `T5: TC-30 reduced fare does not apply to the out-of-zone fee: 2500 + 15000` | зі специфікації | дефект коду | `:87` «пільга не поширюється на збори»; `quote(пільговий, 40 хв, X01)` → `fees: 7500, total: 10000` (BUG-4) | BUG-4 |
| 8 | `…discounts.test.js` › `T5: TC-31 reduced, classic 25 h …` | зі специфікації | дефект коду | `:87`; очікується 230000, фактично 130000 — збір T8 знижено до 100000 (`b2-run.txt`) | BUG-4 |
| 9 | `app/test/spec/t06-day-cap.test.js` › `T6: TC-35 ride on 17.09 00:30–01:00 is a new day: 2500 − 30 % = 1750` | зі специфікації | дефект коду | `:34`, `:101-102` — доба за київським часом; поїздку 17.09 00:30 зараховано до вичерпаного ліміту 16.09 → `total: 0` (BUG-5) | BUG-5 |
| 10 | `app/test/spec/t07-t08-fees.test.js` › `T8: TC-43 classic 24:00:01 → fee 200000` | зі специфікації | дефект коду | `:119-120` «понад 24 години»; 24:00:01 за T1 → 1441 хв > 1440, але `Math.round` дає 1440 → збору немає, 30000 замість 230000. Причина та сама, що в № 1 | BUG-1 |

**Тест, що червоніє то так, то ні.**
- У збереженому `ai-runs/b2-run.txt` він зелений (`ok 1`).
- Але він червонів у прогоні агента B2 (агент написав про це у відповіді) і в моєму проміжному `npm test` після
  виправлення T5.
- Тому він теж у таблиці, окремим рядком:

| # | Тест (файл › назва) | Прогін | Клас | Доказ (рядок специфікації, команда і вивід) | Що зроблено |
|---|---|---|---|---|---|
| 11 | `app/test/integration/receipt.test.js` › `every receipt of a week of rides ends with the amount due` (до Task D) | наявний тест; червонів у прогоні агента B2 і в моєму проміжному `npm test` | хибний тест, що червоніє то так, то ні (не дефект коду) | Оракул `(Math.floor(minutes / 30) + 1) * PRICE` (`main:app/test/integration/receipt.test.js:15`) суперечить T3 «за кожні розпочаті 30 хвилин» (`docs/spec/tariffs.md:62`) рівно на 30 і 60 хв, а тривалості випадкові (`app/test/helpers/factory.js:10`, `:15`). `node tools/repeat.mjs 30` → «4 з 30», «classic, 60 min … got 50,00 грн, expected 75,00 грн» (`ai-runs/d-repeat-before.txt:2`, `:8`). Код правий: 60 хв = 2 блоки (`T3: TC-13` зелений) | Виправлено в Task D (коміт `7187722`): фіксовані поїздки з очікуваннями за T3. 0 з 50 — `ai-runs/d-repeat-after.txt:2`. Розбір — `docs/triage.md`, розділ 1 |

## Дефекти

| ID | Правило | Коротко | Знайшов прогін з коду? | Знайшов прогін зі специфікації? | Коміт виправлення |
|---|---|---|---|---|---|
| BUG-1 | T1 | тривалість округлюється до найближчої хвилини, а не вгору | ні | так (TC-03, TC-08, TC-43) | `a9527fd` |
| BUG-2 | T2 | поїздка рівно 2 хв платна | ні | так (TC-07) | `59d5b52` |
| BUG-3 | T4 | абонент на електровелосипеді має 45 безкоштовних хвилин | ні | так (TC-21, TC-22, TC-29) | `f9bb9b1` |
| BUG-4 | T5 | пільга знижує збори T7 і T8 | ні | так (TC-30, TC-31) | `c7fcec5` |
| BUG-5 | T6 | доба денного ліміту — за UTC, а не за Києвом | ні | так (TC-35) | `d51cd03` |

Звіт про кожен дефект — `docs/bugs/BUG-<N>.md`.

## Наявні тести, що почервоніли після виправлення

| Тест (файл › назва) | Що стверджував | Що каже специфікація (рядок) | Що змінили |
|---|---|---|---|
| `app/test/unit/tariff.test.js` › `a ride of 30 min 20 s is billed as one block` | 30 хв 20 с = 30 хв, 1 блок, 2500 | T1 `:46-47`: 31 хв → 2 блоки → 5000 | Очікування `minutes` 30 → 31, `timeCharge` 2500 → 5000. Назва `… as one block` → `… as two blocks`, коментар з рядком специфікації. Перевірок не прибирав. Коміт `a9527fd` |
| `app/test/unit/tariff.test.js` › `subscribers ride the first 45 minutes free` | абонент, 40 хв: 0 і для класичного, і для електровелосипеда | T4 `:74-77`: класичний — 0; електро — 2 блоки 8000 − 20 % = 6400 | Очікування для електро 0 → 6400 (таблиця `expected` за типом велосипеда). Цикл по обох велосипедах лишився, коментар з рядком специфікації. Коміт `f9bb9b1` |
| `app/test/unit/tariff.test.js` › `reduced fare for a ride returned outside the zone` | пільговий, 40 хв, X01: `total` 10000, збір 7500 | T5 `:87`: збір без пільги → 2500 + 15000 = 17500, збір 15000 | Очікування 10000 → 17500, 7500 → 15000, коментар з рядком специфікації. Коміт `c7fcec5` |

Інші зміни в `app/test/unit/` і `app/test/integration/` прийшли з інших задач, а не з виправлення дефектів Task B.
`git diff main --stat -- app/test/unit app/test/integration` показує `day-cap.test.js`, `tariff-boundaries.test.js`,
`tariff.test.js`, `receipt.test.js`:

| Файл | Що змінено | Чому |
|---|---|---|
| `app/test/unit/day-cap.test.js` | +3 тести (`remaining never goes below zero …`, `remaining is the full limit …`, `chargedOn is 0 …`); наявні 2 тести не змінено | Task C, крок 3: їх додав агент, щоб вбити мутанти M080, M083 (`ai-runs/c-strengthen.diff`, `docs/test-quality.md`, розділи 3–4). Після рев'ю PR — ID `T6` у назвах і рядки специфікації в коментарях |
| `app/test/unit/tariff-boundaries.test.js` | новий файл, 8 тестів | Task C, крок 3: додав агент (M018, M023, M024, M064, M066, M075). Після рев'ю PR — ID правила (`T1` / `T2` / `T6`) у назвах і рядки специфікації в коментарях; перевірки не змінено |
| `app/test/unit/tariff.test.js` | три тести з таблиці вище; після рев'ю PR — `T1:`, `T4:`, `T5:` у назвах. Назву тесту T4 уточнено (`… free on a classic bike, an e-bike is 20 % off`), бо після BUG-3 електровелосипед не безкоштовний | Task B + узгодження назв |
| `app/test/integration/receipt.test.js` | нестабільний тест переписано на фіксовані дані, у назвах `T3:`; другий тест — з фіксованим `rider` | Task D: рядок 11 вище, `docs/triage.md`, розділ 1 |

Жоден тест не видалено, не пропущено і не послаблено.

## Тести з коду після виправлення (`ai-runs/b1-rerun.txt`)

`# tests 63`, `# pass 57`, `# fail 6`. Усі шість були зелені в `ai-runs/b1-run.txt`.

| Тест (файл › назва) | Що стверджував | Який дефект зафіксував |
|---|---|---|
| `ai-runs/b1-from-code/tariff.test.js` › `time charge` › `seconds are rounded to the nearest minute` | 29 хв 29 с → 29 хв; 90 с → 2 хв | BUG-1 |
| `ai-runs/b1-from-code/tariff.test.js` › `time charge` › `2 minutes is already a full block` | 2 хв → `timeCharge` 2500 | BUG-2 |
| `ai-runs/b1-from-code/tariff.test.js` › `subscription` › `ebike gets an extra 20% off the billable part` | абонент, електро, 76 хв → 6400 (45 хв безкоштовно, потім −20 %) | BUG-3 |
| `ai-runs/b1-from-code/tariff.test.js` › `fees` › `reduced fare halves fees too` | пільговий, X03 → збір 7500 | BUG-4 |
| `ai-runs/b1-from-code/tariff.test.js` › `fees` › `both fees together, halved for reduced` | пільговий, 1441 хв, X01 → збори 7500 і 100000 | BUG-4 |
| `ai-runs/b1-from-code/day-cap.test.js` › `DAY_CAP / dayKey` › `dayKey gives the same key for instants on the same day` | `00:00:00Z` і `23:59:59Z` 15.01 — одна доба (тобто доба за UTC) | BUG-5 |

## Числа

- Дефектів, які знайшли тести з коду: **0** (у `ai-runs/b1-run.txt` 0 червоних)
- Дефектів, які знайшли тести зі специфікації: **5** (BUG-1…BUG-5)
- Тестів з коду, що зафіксували дефект: **6** (таблиця вище; кожен із п'яти дефектів зафіксовано хоча б одним тестом)
