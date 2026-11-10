# Червоні тести і дефекти

> Task B. Класифікація виконана за `ai-runs/b1-run.txt`, `ai-runs/b2-run.txt`, кодом тестів, специфікацією та поточною реалізацією.

## Класифікація червоних тестів

| # | Тест (файл › назва) | Прогін | Клас | Доказ (рядок специфікації, фактичний/очікуваний результат) | Що зроблено |
|---|---|---|---|---|---|
| 1 | `ai-runs/b1-from-code/tariff.test.js` › `subscriber ebike subscription reduces its billed block by twenty percent` | з коду | хибний тест | B1: фактично discount `4800`, total `3200`; очікувалось `3200` і `800`. T4 `docs/spec/tariffs.md:74-77`: e-bike отримує 20% знижки на погодинне нарахування; тест помилково застосував 45 безкоштовних хвилин до e-bike. | тест не переносимо |
| 2 | `ai-runs/b1-from-code/tariff.test.js` › `subscriber concession chooses the cheaper reduced plan when applicable` | з коду | хибний тест | B1: фактично код `subscription`, очікувався `reduced`, сума однакова `2500`. T5 `docs/spec/tariffs.md:89-96`: при однакових сумах застосовується абонемент. | тест не переносимо |
| 3 | `ai-runs/b1-from-code/tariff.test.js` › `adds out-of-zone and unreturned fees without applying them to time charge` | з коду | хибний тест | B1: фактично `245000`, очікувалось `337500`. T6 `docs/spec/tariffs.md:98-103` обмежує погодинну частину 30000; T7/T8 `109-125` додають збори окремо. | тест не переносимо |
| 4 | `app/test/spec/tariffs.test.js` › `T1: TC-02 — базове погодинне нарахування` | зі специфікації | дефект коду | B2: фактично 1 хв, очікувалось 2 хв. T1 `docs/spec/tariffs.md:43-50`: неповна хвилина округлюється вгору. `rideMinutes()` використовує `Math.round()`. | BUG-1; виправлено в `cd894bf` |
| 5 | `app/test/spec/tariffs.test.js` › `T2: TC-03 — базове погодинне нарахування` | зі специфікації | дефект коду | B2: фактично total `2500`, очікувалось `0`. T2 `docs/spec/tariffs.md:52-58`: поїздка не більше 2 хв безкоштовна. `chargeFor()` перевіряв `minutes < 2`. | BUG-2; виправлено в `1197440` |
| 6 | `app/test/spec/tariffs.test.js` › `T4: TC-07 — вибір тарифу та знижки` | зі специфікації | хибний тест | B2: фактично `timeCharge=5000`, очікувалось `0`; T4 `docs/spec/tariffs.md:72-82` визначає безкоштовний результат до сплати, а не нульове базове поле `timeCharge`. | хибна асерція |
| 7 | `app/test/spec/tariffs.test.js` › `T4: TC-08 — вибір тарифу та знижки` | зі специфікації | хибний тест | B2: фактично `timeCharge=10000`, очікувалось `5000`. 100 хв = 4 блоки T3; T4 `docs/spec/tariffs.md:72-82` зменшує до сплати до 5000. | хибна асерція |
| 8 | `app/test/spec/tariffs.test.js` › `T4: TC-09 — вибір тарифу та знижки` | зі специфікації | дефект коду | B2: фактично total `3200`, очікувалось `9600`. T4 `docs/spec/tariffs.md:74-77`: 12000 − 20% = 9600; безкоштовні 45 хв для e-bike не передбачені. `subscriptionCharge()` помилково віднімав 45 хв. | BUG-3; виправлено в `ddd6f1b` |
| 9 | `app/test/spec/tariffs.test.js` › `T5: TC-11 — вибір тарифу та знижки` | зі специфікації | хибний тест | B2: фактично `timeCharge=7500`, очікувалось `5000`. 80 хв = 3 блоки T3 = 7500; очікуваний за T5 `docs/spec/tariffs.md:84-96` total `3750` є окремою величиною. | хибна асерція |
| 10 | `app/test/spec/tariffs.test.js` › `T5: TC-12 — вибір тарифу та знижки` | зі специфікації | хибний тест | B2: фактично `timeCharge=5000`, очікувалось `2500`. 60 хв = 2 блоки T3 = 5000, а T5 `docs/spec/tariffs.md:89-91` очікує total `2500`. | хибна асерція |
| 11 | `app/test/spec/tariffs.test.js` › `T8: TC-17 — збори не входять до погодинного ліміту` | зі специфікації | хибний тест | B2: фактично `timeCharge=125000`, очікувалось `30000`. `timeCharge` у API є базовою T3-сумою до знижок і денного ліміту; тому це очікування поля неправильне. Окремо тест не передає `dayCap`, отже він не може перевірити застосування T6. T6 `docs/spec/tariffs.md:98-103`. | виправити окремо асерцію `timeCharge` і вхідний ledger |
| 12 | `app/test/spec/tariffs.test.js` › `T7/T8: TC-18 — збори не входять до погодинного ліміту` | зі специфікації | хибний тест | B2: фактично `timeCharge=125000`, очікувалось `30000`. Як і в TC-17, `timeCharge` має залишатися базовою T3-сумою; ліміт змінює `total`/додає discount, не `timeCharge`. Крім того, відсутній `dayCap`, тому T6 не відтворено. T6 `docs/spec/tariffs.md:98-103`, T7/T8 `109-125`. | виправити окремо асерцію `timeCharge` і вхідний ledger |
| 13 | `app/test/spec/tariffs.test.js` › `T9: TC-21 — чек містить погодинне нарахування, ліміт, збори та підсумок` | зі специфікації | дефект коду | B2: фактично 1500 хв, очікувалось 1501. Входи дають 1500 хв 1 с; за T1 `docs/spec/tariffs.md:43-50` неповна хвилина округлюється вгору. Реалізація `Math.round()` повертає 1500, тому TC-21 підтверджує BUG-1, а не є хибним тестом. | BUG-1; виправлено в `cd894bf` |

## Дефекти

| ID | Правило | Коротко | Знайшов прогін з коду? | Знайшов прогін зі специфікації? | Коміт виправлення |
|---|---|---|---|---|---|
| BUG-1 | T1 | `Math.round()` замість округлення неповної хвилини вгору | ні | так | `cd894bf` |
| BUG-2 | T2 | Межа 2 хв помилково тарифікується | ні | так | `1197440` |
| BUG-3 | T4 | Абонементний e-bike помилково отримує 45 безкоштовних хвилин | ні | так | `ddd6f1b` |

## Наявні тести, що почервоніли після виправлення (якщо є)

| Тест (файл › назва) | Що стверджував | Що каже специфікація (рядок) | Що змінили |
|---|---|---|---|
| `app/test/unit/tariff.test.js` › `a ride of 30 min 20 s is billed as one block` | Старе очікування: 30 хв і 2500 коп. | T1 `docs/spec/tariffs.md:43-50`: 30 хв 20 с округлюються вгору до 31 хв; T3 `docs/spec/tariffs.md:60-70`: 31 хв — це 2 блоки по 2500 коп., разом 5000 коп. | Оновлено назву й очікування на 31 хв і 5000 коп. у `cd894bf` |
| `app/test/spec/tariffs.test.js` › `T2: TC-03 — базове погодинне нарахування` | Очікував безкоштовний total для рівно 2 хв. | T2 `docs/spec/tariffs.md:52-58`: до 2 хв включно безкоштовно. | Тест не змінювався; виправлено код у `1197440`. |
| `app/test/unit/tariff.test.js` › `subscribers ride the first 45 minutes free` | Старий тест очікував безкоштовні 45 хв також для `ebike`. | T4 `docs/spec/tariffs.md:72-82`: 45 хв безкоштовні лише для `classic`; T4 `74-77`: для `ebike` повна погодинна сума зі знижкою 20%. | Тест розділено: `classic` 45 хв → 0 коп.; `ebike` 30 хв → 3200 коп., 45 хв → 6400 коп. у `ddd6f1b`. |

## Тести з коду після виправлення (`ai-runs/b1-rerun.txt`)

Порівняння виконано за назвами тестів у `b1-run.txt` і `b1-rerun.txt`. Історичні прогони не змінювалися: початково 14/17 зелених, після виправлень 8/17 зелених.

| Тест | До | Після | Причина |
|---|---:|---:|---|
| `uses the default daily cap and derives the UTC calendar day` | pass | pass | без зміни |
| `remaining is capped at zero and records cumulative charges by rider and day` | pass | pass | без зміни |
| `separates riders and days` | pass | pass | без зміни |
| `supports a zero custom limit and unknown entries are empty` | pass | pass | без зміни |
| `discount rounds the amount left down to kopecks` | pass | pass | без зміни |
| `charges no time fee below two minutes and one block at the boundary` | pass | fail | BUG-2: тест очікував оплату рівно за 2 хв, але T2 `docs/spec/tariffs.md:52-58` вимагає 0 коп. включно до 2 хв |
| `rounds a ride up to the next thirty-minute block` | pass | pass | без зміни; сценарій понад 2 хв |
| `uses the ebike rate` | pass | fail | BUG-2: тест використовує 2 хв і очікує тариф e-bike, хоча T2 робить поїздку безкоштовною |
| `applies reduced fare to time charge and out-of-zone fee` | pass | fail | BUG-2: тест використовує 2 хв; T2 скасовує timeCharge і тому reduced discount, а T7-збір залишається окремим |
| `subscriber gets 45 free minutes and charges the next block` | pass | pass | без зміни; classic-сценарій понад 2 хв |
| `subscriber ebike subscription reduces its billed block by twenty percent` | fail | fail | хибний тест в обох прогонах: очікує 3200 коп. знижки, але T4 `docs/spec/tariffs.md:74-77` для 46 хв (`SUBSCRIPTION_FREE_MINUTES + 1`) дає базову суму 8000 коп., знижку 1600 коп. і підсумок 6400 коп. |
| `subscriber concession chooses the cheaper reduced plan when applicable` | fail | fail | хибний tie-breaker: T5 `docs/spec/tariffs.md:89-96` вимагає абонемент при однаковій сумі, не reduced |
| `applies night discount only before six Kyiv time` | pass | fail | BUG-2: нічний сценарій має 2 хв; T2 дає базову суму 0, тому нічна знижка не створюється |
| `adds out-of-zone and unreturned fees without applying them to time charge` | fail | fail | хибне очікування total: T6 `docs/spec/tariffs.md:98-103` обмежує погодинну частину 30000 |
| `combines night discount, reduced fare, and reduced fee` | pass | fail | BUG-2: сценарій має 2 хв, тому T2 скасовує timeCharge і залежні знижки; T7-збір не скасовується |
| `applies the daily cap after fare and night discounts` | pass | fail | BUG-2: 2 хв безкоштовні за T2, тому cap не додає discount; це не новий дефект day-cap |
| `rejects invalid rides and requires rider id with a cap ledger` | pass | pass | без зміни |

Тести, що спочатку проходили, а після виправлень стали червоними: 6, 8, 9, 13, 15 і 16. Усі вони пов'язані з BUG-2 та фіксували помилкову оплату або знижки для рівно 2 хвилин. Тести, червоні в обох прогонах: 11, 12 і 14; вони не підтверджують нові дефекти.

## Числа

- Падінь у прогоні з коду: 3 — дефекти: 0, хибні тести: 3, неоднозначності: 0.
- Падінь у прогоні зі специфікації: 10 — дефекти: 4, хибні тести: 6, неоднозначності: 0.
- Усього падінь: 13; унікальних дефектів реалізації: 3; хибних тестів: 9; неоднозначностей: 0.
- Тести з коду, що зафіксували зміну після виправлення дефекту: 6 (усі BUG-2); BUG-1 і BUG-3 не спричинили переходу green → red у цьому наборі.
- Порівняння `b1-run.txt` → `b1-rerun.txt`: 6 тестів зафіксували зміну поведінки після BUG-2; 3 тести залишилися червоними в обох прогонах через хибні очікування.
- Після виправлення `cd894bf`: `npm test` — 40 тестів, 30 пройшли, 10 впали.
- Після виправлення `1197440`: `npm test` — 40 тестів, 31 пройшов, 9 впали.
- Для BUG-2 перевірено межі: 1 хв, 2 хв, 2 хв 1 с і 3 хв; наявні unit-тести змінювати не довелося.
- Після виправлення `ddd6f1b`: `npm test` — 40 тестів, 33 пройшли, 7 впали.
- Для BUG-3 unit-тест оновлено, щоб він відповідав різним правилам T4 для `classic` та `ebike`.
- Нестабільних тестів не виявлено: падіння детерміновані, випадкові helper-тести в журналі пройшли.
