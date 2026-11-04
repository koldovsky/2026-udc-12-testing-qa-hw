# Червоні тести і дефекти

> Task B. Класи: **дефект коду** (код розходиться зі специфікацією) · **хибний тест** (тест
> очікує те, чого специфікація не вимагає, або перевіряє неправильно) · **прогалина в
> специфікації** (специфікація не дає однозначної відповіді).

## Класифікація червоних тестів

`ai-runs/b1-run.txt` (тести з коду, початковий код): **0 червоних** з 46 — класифікувати нічого.

`ai-runs/b2-run.txt` (`npm test` з `app/test/spec/`, початковий код): **14 червоних** з 83.
Команди-докази і їхній вивід — у `docs/bugs/BUG-<N>.md`, розділ «Доказ».

| # | Тест (файл › назва) | Прогін | Клас | Доказ (рядок специфікації, команда і вивід) | Що зроблено |
|---|---|---|---|---|---|
| 1 | `app/test/spec/t1-t3-duration-blocks.test.js` › `T1: TC-03 classic, 10:00:00 → 10:30:01 → 31 хв, 5000` | зі специфікації | дефект коду | `tariffs.md:46-47` — округлення вгору; `ai-runs/b2-run.txt:72-73` expected 31, actual 30 | BUG-1 |
| 2 | `…/t1-t3-duration-blocks.test.js` › `T1: TC-04 classic, 10:00:00 → 10:30:29 → 31 хв, 5000` | зі специфікації | дефект коду | `tariffs.md:46-47`; `b2-run.txt:98-99` expected 31, actual 30; команда BUG-1 → `"minutes":30` | BUG-1 |
| 3 | `…/t1-t3-duration-blocks.test.js` › `T1: TC-05 classic, 10:00:00 → 10:01:30 → 2 хв, 0` | зі специфікації | дефект коду | `tariffs.md:54` — ≤ 2 хв без нарахування; `b2-run.txt:124-125` expected 0, actual 2500 | BUG-2 |
| 4 | `…/t1-t3-duration-blocks.test.js` › `T2: TC-07 classic, 10:00:00 → 10:02:00 → 2 хв, 0` | зі специфікації | дефект коду | `tariffs.md:54`; `b2-run.txt:156-157` expected 0, actual 2500; команда BUG-2 → `"total":2500` | BUG-2 |
| 5 | `…/t1-t3-duration-blocks.test.js` › `T2: TC-08 classic, 10:00:00 → 10:02:01 → 3 хв, 2500` | зі специфікації | дефект коду | `tariffs.md:46` — 2:01 → 3 хв; `b2-run.txt:182-183` expected 3, actual 2 (хвилини) | BUG-1 |
| 6 | `…/t4-t5-subscription-reduced.test.js` › `T4: TC-22 subscriber, ebike, 10:00 → 10:10 → 3200` | зі специфікації | дефект коду | `tariffs.md:76-77` — без безкоштовних хв, −20 %; `b2-run.txt:328-329` expected 3200, actual 0 | BUG-3 |
| 7 | `…/t4-t5-subscription-reduced.test.js` › `T4: TC-23 subscriber, ebike, 10:00 → 10:46 → 6400` | зі специфікації | дефект коду | `tariffs.md:76-77`; `b2-run.txt:354-355` expected 6400, actual 3200 | BUG-3 |
| 8 | `…/t4-t5-subscription-reduced.test.js` › `T5: TC-29 subscriberConcession, ebike, 10:00 → 10:30 → 2000` | зі специфікації | дефект коду | `tariffs.md:76`, `:89-90` — абонемент 3 200 vs пільга 2 000; `b2-run.txt:410-411` expected 2000, actual 0 (через 45 «безкоштовних» хв ebike) | BUG-3 |
| 9 | `…/t4-t5-subscription-reduced.test.js` › `T5, T7: TC-30 reduced, classic, 10:00 → 10:20, X02 → 16250` | зі специфікації | дефект коду | `tariffs.md:87` — пільга не на збори; `b2-run.txt:436-437` expected 16250, actual 8750 | BUG-4 |
| 10 | `…/t4-t5-subscription-reduced.test.js` › `T5, T7: TC-31 subscriberConcession, classic, 10:00 → 12:00, X01 → 20000` | зі специфікації | дефект коду | `tariffs.md:87`; `b2-run.txt:462-463` expected 20000, actual 12500 | BUG-4 |
| 11 | `app/test/spec/t6-day-cap.test.js` › `T6, T10: TC-38 2026-09-16T21:30:00Z → …; нараховано: той самий 2026-09-16=30000 → 1750` | зі специфікації | дефект коду | `tariffs.md:34`, `:101-102` — доба за Києвом; `b2-run.txt:518-519` expected 1750, actual 0 | BUG-5 |
| 12 | `app/test/spec/t7-t8-fees.test.js` › `T8: TC-44 classic, 10:00:00 → 17.09 10:00:01 → 230000` | зі специфікації | дефект коду | `tariffs.md:46`, `:119` — 24 год 1 с → 1 441 хв > 24 год; `b2-run.txt:580-581` expected 230000, actual 30000 (`Math.round` → 1 440 хв, збору немає) | BUG-1 |
| 13 | `…/t7-t8-fees.test.js` › `T8, T5: TC-47 classic, 10:00 → 17.09 11:00, reduced → 230000` | зі специфікації | дефект коду | `tariffs.md:87`, `:120`; `b2-run.txt:618-619` expected 230000, actual 130000 (збір T8 ×50 %) | BUG-4 |
| 14 | `app/test/spec/t9-amounts-receipt.test.js` › `T9: TC-51 чек для TC-30 → …; До сплати 162,50 грн` | зі специфікації | дефект коду | `tariffs.md:87`, `:133-135`; `b2-run.txt:655` — «До сплати … 87,50 грн» | BUG-4 |

**Нестабільний тест.** `app/test/integration/receipt.test.js` › `every receipt of a week of
rides ends with the amount due` у `ai-runs/b2-run.txt` зелений, але під час виправлень
червонів без змін у відповідному коді (напр. 1 з 5 прогонів `npm test` після коміту
`a466d3f`). Тут не класифікую і не чіпаю — ним займаюся в Task D.

## Дефекти

| ID | Правило | Коротко | Знайшов прогін з коду? | Знайшов прогін зі специфікації? | Коміт виправлення |
|---|---|---|---|---|---|
| BUG-1 | T1 | тривалість округлюється до найближчої хвилини, а не вгору | ні — тест `minutes are rounded to the nearest minute` стверджував дефект | так — TC-03, TC-04, TC-08, TC-44 | `87c1c20` |
| BUG-2 | T2 | поїздка рівно 2 хв оплачується | ні — тест `2 minutes is one block` стверджував дефект | так — TC-05, TC-07 | `cd715b4` |
| BUG-3 | T4 | абонент на ebike отримує 45 безкоштовних хв | ні — тест `ebike: 20% off the paid blocks` стверджував дефект | так — TC-22, TC-23, TC-29 | `fffb6af` |
| BUG-4 | T5 | пільга зменшує вдвічі збори T7 / T8 | ні — тест `reduced plan halves fees` стверджував дефект | так — TC-30, TC-31, TC-47, TC-51 | `d0cda4a` |
| BUG-5 | T6 | доба ліміту — UTC, а не Київ | ні — тест `uses the UTC date (current behaviour)` стверджував дефект (агент лише згадав у відповіді, що «варто звірити»; тест зелений) | так — TC-38 | `a466d3f` |

Звіт про кожен дефект — у `docs/bugs/BUG-<N>.md`.

## Наявні тести, що почервоніли після виправлення

| Тест (файл › назва) | Що стверджував | Що каже специфікація (рядок) | Що змінили |
|---|---|---|---|
| `app/test/unit/tariff.test.js` › `a ride of 30 min 20 s is billed as one block` | 30 хв 20 с → `minutes 30`, `timeCharge 2500` | T1: округлення вгору → 31 хв → 2 блоки (`docs/spec/tariffs.md:46-47`, `:62`) | у коміті `87c1c20`: назва → `a ride of 30 min 20 s is rounded up to 31 min and billed as two blocks (T1)`, очікування → `minutes 31`, `timeCharge 5000`; вхід той самий |
| `app/test/unit/tariff.test.js` › `subscribers ride the first 45 minutes free` | абонент, 40 хв, і `classic`, і `ebike` → `total 0` | T4: для ebike безкоштовних хв немає, −20 % (`:76-77`): 2 блоки 8 000 − 20 % = 6 400 | у коміті `fffb6af`: назва → `subscribers ride the first 45 minutes free on a classic bike, e-bikes get 20 % off instead (T4)`; `classic` → `total 0` (як було), `ebike` → `total 6400`; вхід той самий |
| `app/test/unit/tariff.test.js` › `reduced fare for a ride returned outside the zone` | пільговий, 40 хв, `X01` → `total 10000`, збір `7500` | T5: «Пільга не поширюється на збори» (`:87`): 2 500 + 15 000 = 17 500 | у коміті `d0cda4a`: назва → `… : the fee is not reduced (T5)`, очікування → `total 17500`, збір `15000`; вхід той самий |

Жоден тест не видалено, не пропущено і не послаблено: кожна зміна — точне значення за
специфікацією замість точного хибного.

## Тести з коду після виправлення (`ai-runs/b1-rerun.txt`)

46 тестів: 40 зелених, 6 червоних. Усі 6 були зелені в `ai-runs/b1-run.txt`.

| Тест (файл › назва) | Що стверджував | Який дефект зафіксував |
|---|---|---|
| `ai-runs/b1-from-code/tariff.test.js` › `time charge (blocks of 30 minutes)` › `minutes are rounded to the nearest minute` | 30 хв 29 с → 30 хв | BUG-1 |
| `ai-runs/b1-from-code/tariff.test.js` › `time charge (blocks of 30 minutes)` › `2 minutes is one block` | 2 хв → 2 500 | BUG-2 |
| `ai-runs/b1-from-code/tariff.test.js` › `subscription` › `ebike: 20% off the paid blocks` | абонент, ebike 80 хв → 6 400 (45 хв безкоштовно) | BUG-3 |
| `ai-runs/b1-from-code/tariff.test.js` › `fees` › `reduced plan halves fees` | пільговий, `X02` → збір 7 500 | BUG-4 |
| `ai-runs/b1-from-code/day-cap.test.js` › `dayKey` › `uses the UTC date (current behaviour)` | `dayKey("2026-09-15T22:30:00Z")` → `2026-09-15` | BUG-5 |
| `ai-runs/b1-from-code/day-cap.test.js` › `dayKey` › `returns YYYY-MM-DD for ms and ISO input` | `dayKey("2026-09-16T23:59:59Z")` → `2026-09-16` (за Києвом це вже 17.09) | BUG-5 |

## Числа

- Дефектів, які знайшли тести з коду: 0
- Дефектів, які знайшли тести зі специфікації: 5
- Тестів з коду, що зафіксували дефект: 6 (усі 5 дефектів)
