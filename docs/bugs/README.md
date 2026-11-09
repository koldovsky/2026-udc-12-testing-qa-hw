# Червоні тести і дефекти

> Task B. Кожен червоний тест з `ai-runs/b1-run.txt` (тести з коду, на початковому коді) і
> `ai-runs/b2-run.txt` (тести зі специфікації, `npm test`, на початковому коді) має клас і
> доказ. Червоний тест — це питання «хто неправий?», а не автоматично баг у коді.
> Оракул — `docs/spec/tariffs.md`.

## Класифікація червоних тестів

### Прогін «з коду» (`ai-runs/b1-run.txt`): 69 тестів, 66 зелених, 3 червоні

| # | Тест (файл › назва) | Прогін | Клас | Доказ | Що зроблено |
|---|---|---|---|---|---|
| 1 | `ai-runs/b1-from-code/tariff.test.js` › `validation › timestamps must be ISO 8601 with an offset` | з коду | хибний тест | `ai-runs/b1-run.txt:103` `RangeError: Invalid time value`: хелпер `ride()` сам кидає виняток на некоректному `pickupAt`, до виклику `quote`. Це помилка тесту, не коду; специфікація (`tariffs.md:147-149`) цієї поведінки не стосується | не переносимо: тести з `ai-runs/` не правляться; агент сам назвав причину у фінальній відповіді (`ai-runs/b1-from-code.md`) |
| 2 | `ai-runs/b1-from-code/tariff.test.js` › `validation › impossible dates are rejected` | з коду | хибний тест | `ai-runs/b1-run.txt:117`, та сама причина | те саме |
| 3 | `ai-runs/b1-from-code/tariff.test.js` › `validation › unknown rider type is rejected` | з коду | хибний тест | `ai-runs/b1-run.txt:131` `Missing expected exception (QuoteError)`: у виклику `bad(ride(30), undefined)` параметр за замовчуванням підставляє `standard`, тож виняток не виникає | те саме |

Усі три червоні тести на початковому коді — помилки самих тестів. **Жоден тест з коду не знайшов дефекту.**

### Прогін «зі специфікації» (`ai-runs/b2-run.txt`): 109 тестів, 95 зелених, 14 червоних

| # | Тест (файл › назва) | Прогін | Клас | Доказ | Що зроблено |
|---|---|---|---|---|---|
| 4 | `app/test/spec/duration-and-time-charge.test.js` › `T1: TC-03 1 s rounds up to 1 min` | зі специфікації | дефект коду | `tariffs.md:46`; `actual: 0, expected: 1` (хвилин) → `Math.round`; `BUG-1.md` | BUG-1 |
| 5 | там само › `T1: TC-05 30 min 1 s is 31 min, 2 blocks` | зі специфікації | дефект коду | `tariffs.md:46`; `actual: 30, expected: 31` | BUG-1 |
| 6 | там само › `T2: TC-08 2 min 1 s is 3 min, charged` | зі специфікації | дефект коду | `tariffs.md:46`, `:54`; `actual: 2, expected: 3` | BUG-1 |
| 7 | `app/test/spec/discounts.test.js` › `T4: TC-20 classic, 45 min 1 s is 46 min, 1 block` | зі специфікації | дефект коду | `tariffs.md:74-75`, `:46`; `actual: 45, expected: 46` | BUG-1 |
| 8 | `app/test/spec/cap-and-fees.test.js` › `T8: TC-54 24 h 1 s: unreturned fee` | зі специфікації | дефект коду | `tariffs.md:119`; `actual: 30000, expected: 230000`: 24 год 1 с округлено до 1440 хв, збір не нараховано | BUG-1 |
| 9 | `app/test/spec/duration-and-time-charge.test.js` › `T2: TC-07 exactly 2 min is free` | зі специфікації | дефект коду | `tariffs.md:54`; `actual: 2500, expected: 0` | BUG-2 |
| 10 | там само › `T2: TC-10 e-bike, 2 min is free` | зі специфікації | дефект коду | `tariffs.md:54`; `actual: 4000, expected: 0` | BUG-2 |
| 11 | `app/test/spec/discounts.test.js` › `T4: TC-24 e-bike, 75 min: 12000 - 20 %` | зі специфікації | дефект коду | `tariffs.md:76-77`; `actual: 3200, expected: 9600` | BUG-3 |
| 12 | там само › `T4: TC-25 e-bike, 3 min: no free minutes, 4000 - 20 %` | зі специфікації | дефект коду | `tariffs.md:77`; `actual: 0, expected: 3200` | BUG-3 |
| 13 | там само › `T4: TC-26 e-bike, 40 min: 8000 - 20 %` | зі специфікації | дефект коду | `tariffs.md:76-77`; `actual: 0, expected: 6400` | BUG-3 |
| 14 | там само › `T5: TC-32 subscriber with concession, e-bike, 60 min: …` | зі специфікації | дефект коду | `tariffs.md:89-91`, `:76-77`; `actual: 3200, expected: 4000` (абонемент на e-bike безкоштовно списав 45 хв, див. BUG-3) | BUG-3 |
| 15 | там само › `T5: TC-33 reduced fare does not apply to the out-of-zone fee` | зі специфікації | дефект коду | `tariffs.md:87`; `actual: 8750, expected: 16250` | BUG-4 |
| 16 | там само › `T5: TC-34 reduced fare, 25 h: cap 30000, unreturned fee without discount` | зі специфікації | дефект коду | `tariffs.md:87`, `:119-122`; `actual: 130000, expected: 230000` | BUG-4 |
| 17 | `app/test/integration/receipt.test.js` › `every receipt of a week of rides ends with the amount due` | наявний тест | нестабільний (поза трьома класами) | `ai-runs/b2-run.txt`: `ebike, 60 min from 2026-09-21T11:53:00.000Z: got "До сплати … 80,00 грн", expected 120,00 грн`; падає не завжди, тест бере випадкові поїздки (`app/test/helpers/factory.js`) | **не чіпаю до Task D**; зелений у наступних прогонах без змін коду |

Рядки 4–8 → BUG-1 (5 тестів), 9–10 → BUG-2 (2), 11–14 → BUG-3 (4), 15–16 → BUG-4 (2). Усього 13 червоних тестів «дефект коду» + 1 нестабільний = 14.

### Дефект, якого `ai-runs/b2-run.txt` не показав

`T6: TC-45` у прогоні B2 був **зелений**, хоча дефект BUG-5 (доба за UTC) існував. Причина — у хелпері, який згенерував агент: `app/test/helpers/spec.js` записував попереднє нарахування тим самим моментом, що й поїздку (`priorAt ?? from`), тож обидва записи потрапляли в одну UTC-добу. Агент сам це визнав у фінальній відповіді (`ai-runs/b2-from-spec.md`). Мій тест-кейс TC-45 теж був описаний неточно (поїздка о 00:30). Я виправив TC-45 у `docs/test-cases.md` і в `app/test/spec/cap-and-fees.test.js` (поїздка 03:30 +03:00, попереднє нарахування 00:05 +03:00 — одна київська доба, різні UTC-доби; коміт `5190e7a`). Після цього тест почервонів (`actual: 1750, expected: 500`) → **BUG-5**. Тест виправлено за специфікацією (`tariffs.md:34`, `:101-102`); `ai-runs/b2-run.txt` не змінено.

## Дефекти

| ID | Правило | Коротко | Знайшов прогін з коду? | Знайшов прогін зі специфікації? | Коміт виправлення |
|---|---|---|---|---|---|
| BUG-1 | T1 | тривалість округлюється до найближчої хвилини (`Math.round`), а не вгору | ні | так (5 тестів) | `db486f4` |
| BUG-2 | T2 | хибний старт `minutes < 2`, а не `≤ 2`: поїздка на 2 хв платна | ні | так (2 тести) | `3033521` |
| BUG-3 | T4 | e-bike абонент отримує 45 вільних хвилин замість лише −20 % | ні | так (4 тести) | `9f57ebf` |
| BUG-4 | T5 | пільга зменшує збори T7/T8 | ні | так (2 тести) | `a0d317d` |
| BUG-5 | T6 | доба денного ліміту — за UTC, а не за київським часом | ні | так, але лише після виправлення TC-45 (у `b2-run.txt` був зелений) | `24ccef0` |

Звіт про кожен дефект — у `docs/bugs/BUG-<N>.md`.

## Наявні тести, що почервоніли після виправлення

Усі три в `app/test/unit/tariff.test.js`; оновлено за специфікацією (коміт `dc91fab`), нічого не видалено, не пропущено і не послаблено — кожна перевірка точніша або рівна колишній.

| Тест (файл › назва) | Що стверджував | Що каже специфікація (рядок) | Що змінили |
|---|---|---|---|
| `a ride of 30 min 20 s is billed as one block` (перейменовано на `…is billed as two blocks`) | `minutes == 30`, `timeCharge == 2500` | неповна хвилина — вгору, `tariffs.md:46`; блоки — `:62` | `minutes == 31`, `timeCharge == 5000` |
| `subscribers ride the first 45 minutes free` (назву уточнено) | абонент: 40 хв на обох велосипедах — `total == 0` | класичний — 45 вільних хв (`:74`); електро — лише −20 %, без вільних хв (`:76-77`) | таблиця: класичний → 0, e-bike → 6400 |
| `reduced fare for a ride returned outside the zone` | `total == 10000`, збір `7500` | пільга не поширюється на збори, `tariffs.md:87`; збір 150 грн, `:111`; 5000 − 50 % + 15000 | `total == 17500`, збір `15000` |

## Тести з коду після виправлення (`ai-runs/b1-rerun.txt`): 69 тестів, 58 зелених, 11 червоних

Три червоні — ті самі хибні тести з `b1-run.txt`. Решта 8 були зелені на початковому коді й почервоніли на виправленому: вони стверджували саме ту поведінку, яку виправлено, — зафіксували дефект, а не знайшли його.

| Тест (файл › назва) | Що стверджував | Який дефект зафіксував |
|---|---|---|
| `tariff.test.js` › `duration is rounded to the nearest minute` | тривалість — до найближчої хвилини | BUG-1 |
| `tariff.test.js` › `2 minutes costs one block` | 2 хв коштує блок | BUG-2 |
| `tariff.test.js` › `ebike gets an extra 20% off the chargeable part` | e-bike абонент: безкоштовні 45 хв | BUG-3 |
| `tariff.test.js` › `out-of-zone fee is halved when the reduced fare is the plan` | збір за зону ділиться навпіл | BUG-4 |
| `tariff.test.js` › `out-of-zone fee is halved for a conceding subscriber when reduced wins` | те саме для абонента з пільгою | BUG-4 |
| `tariff.test.js` › `reduced rider gets the unreturned fee halved too` | збір за неповернений — навпіл | BUG-4 |
| `day-cap.test.js` › `returns the UTC date as YYYY-MM-DD` | `dayKey` — UTC-дата | BUG-5 |
| `day-cap.test.js` › `normalises offsets to UTC` | зсув нормалізується до UTC | BUG-5 |

## Відкриті питання, що не стали дефектами Task B

- **HT-02 з A1** (`ai-runs/a1-from-code.md`): `app/src/server.js` викликає `quote` без журналу денного ліміту, тож ліміт T6 через HTTP не накопичується між запитами. Специфікація не описує HTTP і сховище історії, тому це **прогалина в специфікації** (питання до власника продукту), а не дефект, який я можу довести за `tariffs.md`. Не виправлялося. Додано як Q-11 у `docs/test-cases.md`.
- Q-1…Q-10 з `docs/test-cases.md` не автоматизовано, вони не впливають на жодний червоний тест.

## Числа

- Дефектів, які знайшли тести з коду: **0**
- Дефектів, які знайшли тести зі специфікації: **5** (BUG-1…BUG-4 — прогін `b2-run.txt` напряму; BUG-5 — після виправлення TC-45 мною)
- Тестів з коду, що зафіксували дефект: **8**
