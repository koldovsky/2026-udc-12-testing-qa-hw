# Червоні тести і дефекти

## Класифікація червоних тестів

| # | Тест (файл › назва) | Прогін | Клас | Доказ (рядок специфікації, команда і вивід) | Що зроблено |
|---|---|---|---|---|---|
| 1 | `app/test/spec/tariff.test.js` › `T1: 30 min 20 sec → 31 minutes (rounded up)` | зі специфікації | дефект коду | `docs/spec/tariffs.md:46`: «округлюється вгору»; код `Math.round(30.33) = 30`, а `Math.ceil = 31` | BUG-1 |
| 2 | `app/test/spec/tariff.test.js` › `T2: exactly 2 min → free (≤2)` | зі специфікації | дефект коду | `docs/spec/tariffs.md:54`: «не більше 2 хвилин»; код `< 2` → 2 хв платне | BUG-2 |
| 3 | `app/test/spec/tariff.test.js` › `T2: 2 min 1 sec → 3 min (ceil) → 1 block = 2500` | зі специфікації | дефект коду | каскад BUG-1: `Math.round(2.017) = 2`, а `Math.ceil = 3`; тест перевіряє `minutes=3` | BUG-1 (каскад) |
| 4 | `app/test/spec/tariff.test.js` › `T4: subscriber ebike 40 min → … 6400 (no free minutes)` | зі специфікації | дефект коду | `docs/spec/tariffs.md:76-77`: «безкоштовних хвилин на e-bike немає»; код дає 0 | BUG-3 |
| 5 | `app/test/spec/tariff.test.js` › `T4: subscriber ebike 75 min → … 9600` | зі специфікації | дефект коду | `docs/spec/tariffs.md:76`: «знижка 20%»; код дає 3200 (45 free min + 20% на решту) | BUG-3 |
| 6 | `app/test/spec/tariff.test.js` › `T5: reduced fare does NOT apply to out-of-zone fee` | зі специфікації | дефект коду | `docs/spec/tariffs.md:87`: «Пільга не поширюється на збори»; код дає fee=7500 | BUG-4 |
| 7 | `app/test/integration/receipt.test.js` › `every receipt of a week of rides ends with the amount due` | зі специфікації | нестабільний тест | падає інколи: `Math.floor(x/30)+1 ≠ Math.ceil(x/30)` коли x кратне 30 (рандомні дані) | Task D |

## Дефекти

| ID | Правило | Коротко | Знайшов прогін з коду? | Знайшов прогін зі специфікації? | Коміт виправлення |
|---|---|---|---|---|---|
| BUG-1 | T1 | Math.round замість Math.ceil для тривалості | ні (очікував ту ж хибну поведінку) | так | `e604ebc` |
| BUG-2 | T2 | `<` замість `<=` для хибного старту ≤ 2 хв | ні (очікував ту ж хибну поведінку) | так | `c55b738` |
| BUG-3 | T4 | ebike абонемент: 45 free min замість 20% знижки | ні (очікував ту ж хибну поведінку) | так | `c3c50a1` |
| BUG-4 | T5 | Пільгова знижка 50% застосовувалася до зборів | ні (очікував ту ж хибну поведінку) | так | `6aabec8` |
| BUG-5 | T6 | dayKey повертав UTC-дату, а не київську | ні (очікував ту ж хибну поведінку) | так (unit-тест) | `4ee27ab` |

Звіт про кожен дефект — у `docs/bugs/BUG-<N>.md`.

## Наявні тести, що почервоніли після виправлення (якщо є)

| Тест (файл › назва) | Що стверджував | Що каже специфікація (рядок) | Що змінили |
|---|---|---|---|
| `app/test/unit/tariff.test.js` › `a ride of 30 min 20 s is billed as one block` | minutes=30, timeCharge=2500 (1 блок через Math.round) | T1 `docs/spec/tariffs.md:46`: ceil → minutes=31, 2 блоки = 5000 | Змінено expected: minutes=31, timeCharge=5000 |
| `app/test/unit/tariff.test.js` › `subscribers ride the first 45 minutes free` | Тестував і classic, і ebike в циклі — обидва free | T4 `docs/spec/tariffs.md:76-77`: безкоштовних хвилин на e-bike немає | Залишено тільки classic; ebike окремо в `subscription on a long e-bike ride` |
| `app/test/unit/tariff.test.js` › `reduced fare for a ride returned outside the zone` | Очікував fee зі знижкою | T5 `docs/spec/tariffs.md:87`: «не поширюється на збори» | Змінено expected: fee=15000, total=17500 |
| `app/test/unit/day-cap.test.js` › `the day of a ride is the Kyiv date of its pickup` | Перевіряв лише денний час (обидва — одна дата UTC і Kyiv) | T6 `docs/spec/tariffs.md:101`: «за київським часом» | Додано assert для нічного часу (22:00Z → 2026-09-17 Kyiv) |

Коміт виправлення наявних тестів: `8fe1d20`.

## Тести з коду після виправлення (`ai-runs/b1-rerun.txt`)

Тести з прогону «з коду», які були зелені на початковому коді й почервоніли на виправленому: вони стверджували саме ту поведінку, яку ви виправили.

| Тест (файл › назва) | Що стверджував | Який дефект зафіксував |
|---|---|---|
| `ai-runs/b1-from-code/tariff.test.js` › `duration: 30 min 20 sec rounds to 30 min` | minutes=30 (Math.round) | BUG-1 |
| `ai-runs/b1-from-code/tariff.test.js` › `false start: 2 min ride is charged` | 2 хв = 2500 (платне) | BUG-2 |
| `ai-runs/b1-from-code/tariff.test.js` › `subscriber ebike 40 min → free (45 min free)` | total=0 (45 free min для ebike) | BUG-3 |
| `ai-runs/b1-from-code/tariff.test.js` › `reduced with out-of-zone → fee also discounted` | fee=7500 (знижка на збір) | BUG-4 |
| `ai-runs/b1-from-code/tariff.test.js` › `dayKey uses UTC date` | дата за UTC | BUG-5 |

## Числа

- Дефектів, які знайшли тести з коду: 0
- Дефектів, які знайшли тести зі специфікації: 5
- Тестів з коду, що зафіксували дефект: 5
