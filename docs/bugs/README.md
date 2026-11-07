# Червоні тести і дефекти

> Task B. Кожен червоний тест з `ai-runs/b1-run.txt` і `ai-runs/b2-run.txt` — рядок таблиці
> з класом і доказом. Класи: **дефект коду** (код розходиться зі специфікацією) · **хибний
> тест** (тест очікує те, чого специфікація не вимагає, або перевіряє неправильно) ·
> **прогалина в специфікації** (специфікація не дає однозначної відповіді).

## Класифікація червоних тестів

`ai-runs/b1-run.txt` (з коду): `ℹ tests 90 · pass 90 · fail 0` — червоних немає.
`ai-runs/b2-run.txt` (зі специфікації): `ℹ tests 96 · pass 84 · fail 12` — усі 12 нижче.

Файли — у `app/test/spec/`. «Факт» — вивід команди з розділу «Доказ» відповідного
`BUG-<N>.md` (виклик `quote` на коді до виправлень).

| # | Тест (файл › назва) | Прогін | Клас | Доказ (рядок специфікації, команда і вивід) | Що зроблено |
|---|---|---|---|---|---|
| 1 | `t1-t3-duration-blocks.test.js` › `T1: TC-04 — 10:00:00 → 10:30:01 → 31 хв, до сплати 5000` | зі специфікації | дефект коду | `:46-47`: «неповна хвилина рахується як повна: … вгору»; 30 хв 1 с → факт `30 2500` (хв, коп.) | BUG-1 |
| 2 | `t1-t3-duration-blocks.test.js` › `T1, T2: TC-05 — 10:00:00 → 10:01:30 → 2 хв, до сплати 0` | зі специфікації | дефект коду | `:54`: «не більше 2 хвилин … без погодинного нарахування»; факт `minutes 2, total 2500` (хвилини збіглися: `Math.round(1.5)` = 2) | BUG-2 |
| 3 | `t1-t3-duration-blocks.test.js` › `T2: TC-07 — 10:00:00 → 10:02:00 → 2 хв, до сплати 0` | зі специфікації | дефект коду | `:54`; рівно 2 хв → факт `2 2500` | BUG-2 |
| 4 | `t1-t3-duration-blocks.test.js` › `T2: TC-08 — 10:00:00 → 10:02:01 → 3 хв, до сплати 2500` | зі специфікації | дефект коду | `:46-47`; факт `minutes 2` замість 3 (сума 2 500 збіглася лише через BUG-2) | BUG-1 |
| 5 | `t4-t5-subscription-reduced.test.js` › `T4: TC-22 — абонент, електровелосипед, 30 хв → до сплати 3200` | зі специфікації | дефект коду | `:76-77`: «знижка 20 % … Безкоштовних хвилин на електровелосипеді немає»; факт `discounts [subscription 4000], total 0` | BUG-3 |
| 6 | `t4-t5-subscription-reduced.test.js` › `T4: TC-23 — абонент, електровелосипед, 45 хв → до сплати 6400` | зі специфікації | дефект коду | `:76-77`; факт `0` | BUG-3 |
| 7 | `t4-t5-subscription-reduced.test.js` › `T5, T7: TC-29 — пільговий, 20 хв, станція X01 (збір без пільги) → до сплати 16250` | зі специфікації | дефект коду | `:87`: «Пільга не поширюється на збори (T7, T8)»; факт `fees [out-of-zone 7500], total 8750` | BUG-4 |
| 8 | `t4-t5-subscription-reduced.test.js` › `T5, T8: TC-30 — пільговий, 16.09 10:00 → 17.09 11:00 (25 год, збір без пільги) → до сплати 230000` | зі специфікації | дефект коду | `:87`, `:120`; факт `130000` (збір T8 100 000 замість 200 000) | BUG-4 |
| 9 | `t6-day-cap.test.js` › `T6, T10: TC-39 — після TC-31 — 2026-09-16T22:00:00Z → 22:30:00Z (17.09 01:00–01:30 за Києвом) → нова доба, нічна → 1 750` | зі специфікації | дефект коду | `:34` «доба — за київським часом», `:101-102`; `dayKey('2026-09-16T22:00:00Z')` → `2026-09-16`, поїздка → `0` | BUG-5 |
| 10 | `t7-t8-fees.test.js` › `T8: TC-46 — 16.09 10:00:00 → 17.09 10:00:01, 24 год 1 с → 1 441 хв → зі збором → до сплати 230000` | зі специфікації | дефект коду | `:46-47`, `:119` «понад 24 години»; факт `1440 [] 30000` — збору немає | BUG-1 |
| 11 | `t9-amounts-receipt.test.js` › `T9: TC-50 — чек поїздки TC-29 містить рядок: збір T7 150,00 грн` | зі специфікації | дефект коду | `:87`, `:112`; у чеку `Збір: повернення поза зоною ........ 75,00 грн` (`ai-runs/b2-run.txt`) | BUG-4 |
| 12 | `t9-amounts-receipt.test.js` › `T9: TC-50 — чек поїздки TC-29 містить рядок: «До сплати» 162,50 грн` | зі специфікації | дефект коду | `:87`, `:112`, `:135`; у чеку `До сплати .......................... 87,50 грн` | BUG-4 |

**Тест, що червоніє то так, то ні.** `app/test/integration/receipt.test.js` › `every receipt of a
week of rides ends with the amount due` у `ai-runs/b2-run.txt` зелений, а в іншому прогоні
`npm test` на тому самому коді (до будь-яких змін) — червоний. Рядка в таблиці немає, бо в
`b1-run.txt` і `b2-run.txt` він не червоний; ним займаємося в Task D. Гіпотеза: тест бере
випадкову тривалість (`test/helpers/factory.js`, `between(5, 89)`) і рахує блоки як
`Math.floor(minutes / 30) + 1`, а для 30 і 60 хв це на блок більше, ніж за `:62`. Спостереження,
що її підтримує (прогін `npm test` після виправлення BUG-2): `classic, 60 min from
2026-09-21T07:48:00.000Z: got "До сплати .......................... 50,00 грн", expected 75,00 грн`
— за `:62` 60 хв = 2 блоки = 50,00 грн, тобто тут неправий тест, а не код.

## Дефекти

Тести з коду (`ai-runs/b1-run.txt`) зелені всі — жодного дефекту вони не знайшли.

| ID | Правило | Коротко | Знайшов прогін з коду? | Знайшов прогін зі специфікації? | Коміт виправлення |
|---|---|---|---|---|---|
| BUG-1 | T1 | тривалість округлюється до найближчої хвилини, а не вгору | ні | так (TC-04, TC-08, TC-46) | `2395cfe` |
| BUG-2 | T2 | поїздка рівно 2 хв оплачується як блок | ні | так (TC-05, TC-07) | `dfe41dc` |
| BUG-3 | T4 | абонент на електровелосипеді отримує 45 безкоштовних хвилин | ні | так (TC-22, TC-23) | `c553ee3` |
| BUG-4 | T5 | пільга зменшує збори T7 і T8 удвічі | ні | так (TC-29, TC-30, TC-50) | `4e91598` |
| BUG-5 | T6 | доба денного ліміту рахується за UTC, а не за Києвом | ні | так (TC-39) | `ec0c832` |

Звіт про кожен дефект — у `docs/bugs/BUG-<N>.md`.

## Наявні тести, що почервоніли після виправлення (якщо є)

| Тест (файл › назва) | Що стверджував | Що каже специфікація (рядок) | Що змінили |
|---|---|---|---|
| `app/test/unit/tariff.test.js` › `a ride of 30 min 20 s is billed as one block` (після BUG-1) | 30 хв 20 с → 30 хв, 1 блок, 2 500 | `:46-47`: неповна хвилина — вгору → 31 хв → 2 блоки (`:62`) → 5 000 | очікування 31 хв і 5 000, назва → `… is billed as two blocks` |
| `app/test/unit/tariff.test.js` › `subscribers ride the first 45 minutes free` (після BUG-3; вивід `6400 !== 0`) | абонент, 40 хв → 0 і на класичному, і на електровелосипеді | `:74-77`: 45 безкоштовних хв — лише класичний; електровелосипед — 2 блоки 8 000 − 20 % → 6 400 | очікування за типом: classic 0, ebike 6 400; назва → `… free on a classic bike, an e-bike gets 20 % off` |
| `app/test/unit/tariff.test.js` › `reduced fare for a ride returned outside the zone` (після BUG-4; вивід `17500 !== 10000`) | пільговий, 40 хв, X01 → `total 10000`, збір `7500` (збір зі знижкою 50 %) | `:86-87`: «Пільга не поширюється на збори (T7, T8)»; 5 000 − 50 % = 2 500 + збір 15 000 (`:112`) → 17 500 | очікування `total 17500`, збір `15000`; назву не змінено |

## Інші змінені наявні тести (Task C, Task D)

Зміни, не пов'язані з дефектами. Червоних тестів вони не лагодили: кожна посилює перевірку,
що вже була, або прибирає з неї залежність від коду. Нові тести, що з'явилися в Task C,
тут не перелічено — це доповнення, а не зміни (`docs/test-quality.md`, розд. 3). Входи
змінених тестів лишилися ті самі, а нові очікування зі специфікації точніші за старі, тож
жодна зміна не є послабленням.

| Тест (файл › назва) | Що було | Що стало | Чому (специфікація) |
|---|---|---|---|
| `app/test/unit/day-cap.test.js` › `charges recorded for a day reduce what is left of the cap` | `assert.ok(remaining < DAY_CAP)` — пройде за будь-якого залишку, меншого за ліміт | `assert.equal(remaining, DAY_CAP - 12000)` — точний залишок (`ai-runs/c-strengthen.diff:9-10`) | T6 `:100-101`: ліміт 300 грн; 30 000 − 12 000 = 18 000. Очікування досі з константи `DAY_CAP`, але її значення окремо фіксує тест `the cap is 30 000 kopecks` (`docs/test-quality.md`, розд. 3, № 5) |
| `app/test/unit/tariff.test.js` › `quote returns an itemised price` | `total >= 0`, `Array.isArray(...)`, `typeof minutes` — лише форма результату | `deepEqual` усього результату для 1, 50 і 130 хв (`c-strengthen.diff:83-106`) | T2 `:54` (1 хв → 0), T3 `:62-69` (50 хв → 5 000; ел., 130 хв → 5 блоків → 20 000) |
| `app/test/unit/tariff.test.js` › `e-bikes are billed at the e-bike rate` | очікування `Math.ceil(minutes / BLOCK_MINUTES) * RATES.ebike` — з формули й констант коду (тавтологія) | `minutes 75`, `timeCharge 12000`, `total 12000` числами (`c-strengthen.diff:116-120`) | T3 `:67`, `:70`: ел., 75 хв → 3 блоки → 120 грн |
| `app/test/unit/tariff.test.js` › `subscription on a long e-bike ride` | «є знижка `subscription`» і `total < timeCharge` — пройде за будь-якого відсотка | `timeCharge 16000`, знижка `subscription 3200`, `total 12800` (`c-strengthen.diff:131-135`) | T4 `:76`: ел., 100 хв → 4 блоки = 16 000 − 20 % → 12 800 |
| `app/test/unit/tariff.test.js` › `reduced fare for a ride returned outside the zone` (вдруге — після BUG-4, див. вище) | `fees[0].amount === 15000` | `deepEqual` знижки `reduced 2500` і зборів `[out-of-zone 15000]` (`c-strengthen.diff:142-145`) | T5 `:86-87`, T7 `:112`: 5 000 − 50 % = 2 500; збір 15 000 без пільги |
| `app/test/unit/tariff.test.js` › `night rides get 30 % off` | `discounts.length === 1`, `discounts[0].code === "night"`, `total < timeCharge` | знижка `night 750`, `total 1750` (`c-strengthen.diff:153-157`) | T10 `:141-143`: 25 грн − 30 % → 17,50 грн |
| `app/test/unit/tariff.test.js` › `a bike kept over a day and left outside the zone pays both fees` | `fees.length === 2` — пройде і з двома однаковими чи неправильними зборами | `deepEqual(fees, [out-of-zone 15000, unreturned 200000])`, `total 245000` (`c-strengthen.diff:163-168`) | T7 `:112`, T8 `:119-122` (обидва збори), T6 `:100` (48 год → ліміт 30 000) |
| `app/test/unit/tariff.test.js` › `the daily cap limits the time charge` | `last.total <= DAY_CAP` — лише остання поїздка й нерівність з константою коду | суми всіх трьох поїздок `[12000, 12000, 6000]`, рядок `day-cap 6000`, `chargedOn 30000` (`c-strengthen.diff:175-185`) | T6 `:105-106`: три поїздки ел. по 80 хв → 120, 120, **60** грн |
| `app/test/unit/tariff.test.js` › `a 45-minute classic ride costs 50 UAH` | викликав власний `mock.fn` замість `quote()` — не перевіряв код узагалі | викликає справжній `quote()` (`c-strengthen.diff:190-194`) | T3 `:62`: 45 хв → 2 блоки → 50 грн |
| `app/test/integration/receipt.test.js` › `every receipt of a week of rides ends with the amount due` (Task D) | 10 випадкових поїздок, очікування за формулою `floor(m/30)+1`; падав 6 з 30 прогонів | таблиця з 12 явних поїздок, кожна — окремий `test()`, з межами 29/30/31 і 59/60/61 хв; перевіряється весь рядок «До сплати» | T3 `:62`: розпочаті 30 хв → `⌈m/30⌉` блоків. Причина й докази — `docs/triage.md`, розд. 1 |

Тести `a ride of 30 min 20 s …` і `subscribers ride …` змінено лише в Task B (таблиця вище);
у Task C агент їх не чіпав. Без жодних змін лишилися: `tariff.test.js` › `a return before the
pickup is rejected`, `day-cap.test.js` › `the day of a ride is the date of its pickup`, усі тести
`app/test/unit/server.test.js` і `app/test/unit/receipt-format.test.js`,
`app/test/integration/receipt.test.js` › `a receipt lists the fee for a return outside the zone`.

## Тести з коду після виправлення (`ai-runs/b1-rerun.txt`)

`ai-runs/b1-run.txt` (до виправлень): 90 з 90 зелені. `ai-runs/b1-rerun.txt` (після
`ec0c832`): 11 справжніх червоних тестів — усі 11 нижче були зелені в `b1-run.txt`.

| Тест (файл › назва) | Що стверджував | Який дефект зафіксував |
|---|---|---|
| `ai-runs/b1-from-code/tariff.test.js` › `ride length is rounded to the nearest minute` | 30 хв 29,999 с → 30 хв, 2 500 (вивід після виправлення: `31 !== 30`) | BUG-1 |
| `ai-runs/b1-from-code/tariff.test.js` › `accepted ISO variants: no seconds, fractional seconds, Z, offset` | 10 хв 0,5 с → 10 хв («10.008 min → 10»; вивід: `11 !== 10`) | BUG-1 |
| `ai-runs/b1-from-code/tariff.test.js` › `from 2 minutes the first 30-minute block is charged in full` | рівно 2 хв → 2 500 (вивід: `0 !== 2500`) | BUG-2 |
| `ai-runs/b1-from-code/tariff.test.js` › `e-bike subscription charge gets 20% off` | абонент, електровелосипед, 46 хв → 3 200 (45 хв безкоштовно; вивід: `6400 !== 3200`) | BUG-3 |
| `ai-runs/b1-from-code/tariff.test.js` › `halves the out-of-zone fee` | пільговий, X02 → збір 7 500 (вивід: `amount: 15000` замість `7500`) | BUG-4 |
| `ai-runs/b1-from-code/tariff.test.js` › `halves the unreturned-bike fee` | пільговий, 1 441 хв → збір 100 000 (вивід: `200000 !== 100000`) | BUG-4 |
| `ai-runs/b1-from-code/tariff.test.js` › `fees are halved only when the reduced plan is chosen` | абонент з пільгою, обрано пільгу → збір 7 500 (вивід: `15000 !== 7500`) | BUG-4 |
| `ai-runs/b1-from-code/day-cap.test.js` › `last and first millisecond of a UTC day fall on different days` | `dayKey("2026-01-15T23:59:59.999Z")` (01:59 16.01 за Києвом) → `2026-01-15` (вивід: `'2026-01-16'` замість `'2026-01-15'`) | BUG-5 |
| `ai-runs/b1-from-code/day-cap.test.js` › `uses the UTC calendar day (not Kyiv local day)` | 00:30 16.01 за Києвом → доба `2026-01-15` (вивід: `'2026-01-16'` замість `'2026-01-15'`) | BUG-5 |
| `ai-runs/b1-from-code/day-cap.test.js` › `the day boundary is midnight UTC (current behaviour)` | поїздка о 01:00 16.01 за Києвом записується на 15.01 (вивід: `10000 !== 15000`) | BUG-5 |
| `ai-runs/b1-from-code/tariff.test.js` › `an after-midnight Kyiv ride is booked on the previous UTC day (current behaviour)` | нічна поїздка 16.01 обмежується залишком ліміту 15.01 (вивід: немає рядка `day-cap 1000`) | BUG-5 |

Кожен із 5 дефектів зафіксовано щонайменше одним тестом з коду. Чотири з них AI сам позначив
як «current behaviour» або «Characterises current behaviour» — тобто описав код, а не
специфікацію.

## Числа

- Дефектів, які знайшли тести з коду: 0
- Дефектів, які знайшли тести зі специфікації: 5
- Тестів з коду, що зафіксували дефект: 11
