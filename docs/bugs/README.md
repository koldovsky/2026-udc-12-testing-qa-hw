# Червоні тести і дефекти — Task B

Перший прогін тестів з коду — [`ai-runs/b1-run.txt`](../../ai-runs/b1-run.txt): **12/12 зелених, 0 червоних** (`ai-runs/b1-run.txt:13-16`). Перший прогін тестів зі специфікації — [`ai-runs/b2-run.txt`](../../ai-runs/b2-run.txt): **9 червоних із 57** (`ai-runs/b2-run.txt:66-69`). Нижче є рядок **для кожного** з цих дев'яти падінь. Усі дев'ять — прояви п'яти дефектів коду; серед червоних немає хибного тесту або прогалини специфікації. Відомий нестабільний інтеграційний тест у цих двох збережених прогонах не падав; причину залишено для Task D.

## Класифікація червоних тестів

| # | Тест (файл › назва) | Прогін | Клас | Доказ | Що зроблено |
|---|---|---|---|---|---|
| 1 | `app/test/spec/tariffs.test.js` › `T1, T3: TC-02 30 minutes and one second` | зі специфікації | дефект коду | `ai-runs/b2-run.txt:78-93`: 30 хв/2500 замість 31 хв/5000; T1 `docs/spec/tariffs.md:45-47`. | [BUG-1](BUG-1.md), `afe457c` |
| 2 | `app/test/spec/tariffs.test.js` › `T2: TC-04 exactly two minutes` | зі специфікації | дефект коду | `ai-runs/b2-run.txt:109-124`: 2500 замість 0; T2 `docs/spec/tariffs.md:54-55`. | [BUG-2](BUG-2.md), `c48860e` |
| 3 | `app/test/spec/tariffs.test.js` › `T2, T1, T3: TC-05 two minutes and one second` | зі специфікації | дефект коду | `ai-runs/b2-run.txt:139-153`: тривалість 2 замість 3 хв після округлення; T1 `docs/spec/tariffs.md:45-47`. | BUG-1, `afe457c` |
| 4 | `app/test/spec/tariffs.test.js` › `T4, T1: TC-09 45 minutes and one second` | зі специфікації | дефект коду | `ai-runs/b2-run.txt:168-190`: 45 хв/0 замість 46 хв/2500; T1 і T4 `docs/spec/tariffs.md:45-47`, `docs/spec/tariffs.md:74-75`. | BUG-1, `afe457c` |
| 5 | `app/test/spec/tariffs.test.js` › `T4: TC-11 electric subscription has no free minutes` | зі специфікації | дефект коду | `ai-runs/b2-run.txt:204-225`: 0 замість 3200; T4 `docs/spec/tariffs.md:76-77`. | [BUG-3](BUG-3.md), `0eb9ef3` |
| 6 | `app/test/spec/tariffs.test.js` › `T5, T7: TC-16 student pays the full zone fee` | зі специфікації | дефект коду | `ai-runs/b2-run.txt:239-263`: збір 7500 і підсумок 8750 замість 15000/16250; T5 `docs/spec/tariffs.md:86-87`. | [BUG-4](BUG-4.md), `41178a8` |
| 7 | `app/test/spec/tariffs.test.js` › `T7, T2: TC-24 false start still pays zone fee` | зі специфікації | дефект коду | `ai-runs/b2-run.txt:278-298`: 17500 замість 15000 через зайву плату T3 за рівно 2 хв; T2 `docs/spec/tariffs.md:54-55`. | BUG-2, `c48860e` |
| 8 | `app/test/spec/tariffs.test.js` › `T6, T10: TC-36 daily ledger by rider and Kyiv pickup date` | зі специфікації | дефект коду | `ai-runs/b2-run.txt:312-325`: 1750 замість 0; T6 вимагає київську дату взяття, `docs/spec/tariffs.md:100-103`. | [BUG-5](BUG-5.md), `40bbb3e` |
| 9 | `app/test/spec/tariffs.test.js` › `T6, T10: TC-37 daily ledger by rider and Kyiv pickup date` | зі специфікації | дефект коду | `ai-runs/b2-run.txt:333-346`: 0 замість 1750; T6 вимагає новий ліміт на нову київську дату, `docs/spec/tariffs.md:100-103`. | BUG-5, `40bbb3e` |

## Дефекти

| ID | Правило | Коротко | Знайшов прогін з коду? | Знайшов прогін зі специфікації? | Коміт виправлення |
|---|---|---|---|---|---|
| [BUG-1](BUG-1.md) | T1 | Неповна хвилина не округлена вгору | ні | так: TC-02/05/09 | `afe457c` |
| [BUG-2](BUG-2.md) | T2 | Рівно 2 хв оплачуються | ні | так: TC-04/24 | `c48860e` |
| [BUG-3](BUG-3.md) | T4 | 45 безкоштовних хвилин помилково на електро | ні | так: TC-11 | `0eb9ef3` |
| [BUG-4](BUG-4.md) | T5 | Пільга зменшує збори | ні | так: TC-16 | `41178a8` |
| [BUG-5](BUG-5.md) | T6 | UTC-дата замість київської | ні | так: TC-36/37 | `40bbb3e` |

## Наявні тести, що почервоніли після виправлення

| Тест (файл › назва до зміни) | Що стверджував | Що каже специфікація | Що змінили |
|---|---|---|---|
| `app/test/unit/tariff.test.js` › `a ride of 30 min 20 s is billed as one block` | 30 хв і 2500 коп. за 30 хв 20 с | T1: округлення вгору; T3: 31 хв = 2 блоки, `docs/spec/tariffs.md:45-47`, `:62-69` | Збережено тест, очікується 31 хв і 5000 коп.; `afe457c`. |
| `app/test/unit/tariff.test.js` › `subscribers ride the first 45 minutes free` | 0 коп. за 40 хв і класичним, і електро | T4: безкоштовні 45 хв лише на класичному, на електро 20 %, `docs/spec/tariffs.md:74-77` | Збережено обидва типи в одному тесті; очікується 0 та 6400 коп.; `0eb9ef3`. |
| `app/test/unit/tariff.test.js` › `reduced fare for a ride returned outside the zone` | Збір 7500 коп. за X01 при пільзі | T5: пільга не поширюється на збори, `docs/spec/tariffs.md:86-87` | Збережено тест; збір 15000, підсумок 17500 для його 40 хв; `41178a8`. |

`app/test/unit/day-cap.test.js` не почервонів: попередня перевірка використовувала час далеко від межі доби. У `40bbb3e` до неї додано Kyiv/UTC граничні приклади.

Перевірка старих очікувань: розгорнуто `git archive main app` у `/private/tmp/ws12-unit-original-tests-on-fixed`, скопійовано туди лише виправлені `app/src/tariff.js` і `app/src/day-cap.js`, виконано `node --test app/test/unit/tariff.test.js`. Вивід: **11 tests, 8 pass, 3 fail** — саме три назви в таблиці вище. Отже, ці тести справді почервоніли б від виправленого коду, а не були змінені про всяк випадок.

## Тести з коду після виправлення

Перший прогін: `ai-runs/b1-run.txt:13-16` — **12 pass, 0 fail**. Без зміни файлів `ai-runs/b1-from-code/*.test.js` повторний прогін `ai-runs/b1-rerun.txt:13-16` дав **6 pass, 6 fail**. Ці шість тестів закріпили початкову реалізацію замість нормативного оракула.

| Тест (файл › назва) | Що стверджував і доказ після виправлення | Який дефект зафіксував |
|---|---|---|
| `ai-runs/b1-from-code/day-cap.test.js` › `dayKey uses the UTC date and accepts strings, dates and timestamps` | UTC-дата 01.01 для київського 02.01; `ai-runs/b1-rerun.txt:25-44`. | BUG-5 |
| `ai-runs/b1-from-code/day-cap.test.js` › `custom limits, riders, UTC days and ledger instances are independent` | Скидання ліміту за UTC; `ai-runs/b1-rerun.txt:47-65`. | BUG-5 |
| `ai-runs/b1-from-code/tariff.test.js` › `rounds duration to minutes, then applies free start and started 30-minute blocks` | `1.49 хв` → 1 хв; `1.5 хв` і 2 хв оплачуються; `ai-runs/b1-rerun.txt:68-92`. | BUG-1, BUG-2 |
| `ai-runs/b1-from-code/tariff.test.js` › `subscription free minutes and ebike discount apply to the remaining blocks` | 45 хв на електро безкоштовні; `ai-runs/b1-rerun.txt:95-113`. | BUG-3 |
| `ai-runs/b1-from-code/tariff.test.js` › `fees are outside the cap, with reduced fees only when the reduced plan wins` | Пільга зменшує збори T7/T8; `ai-runs/b1-rerun.txt:116-146`. | BUG-4 |
| `ai-runs/b1-from-code/tariff.test.js` › `ledger books discounted time charge on pickup day and excludes fees` | Поїздку о 23:00Z обліковано попередньою датою, хоча в Києві вже наступна; `ai-runs/b1-rerun.txt:149-166`. | BUG-5 |

## Числа

- Дефектів, які знайшли тести з коду: **0** (`ai-runs/b1-run.txt:15-16`).
- Дефектів, які знайшли тести зі специфікації: **5** (`ai-runs/b2-run.txt:69`, класифікація вище).
- Тестів з коду, що зафіксували дефект: **6** (`ai-runs/b1-rerun.txt:16`, таблиця вище).
