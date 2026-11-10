# Червоні тести і дефекти

> Task B. Скопіюйте у `docs/bugs/README.md`. Кожен червоний тест з `ai-runs/b1-run.txt`
> і `ai-runs/b2-run.txt` — рядок таблиці з класом і доказом. Червоний тест — це питання
> «хто неправий?», а не автоматично дефект у коді.
>
> Класи: **дефект коду** (код розходиться зі специфікацією) · **хибний тест** (тест
> очікує те, чого специфікація не вимагає, або перевіряє неправильно) · **прогалина в
> специфікації** (специфікація не дає однозначної відповіді — це питання, а не дефект).
>
> Приклади курсивом — з **іншої** системи (онлайн-бібліотека громади).

## Класифікація червоних тестів

| # | Тест (файл › назва) | Прогін | Клас | Доказ (рядок специфікації, команда і вивід) | Що зроблено |
|---|---|---|---|---|---|
| 1 | `ai-runs/b1-from-code/day-cap.test.js` › whole file | з коду | хибний тест | `ai-runs/b1-run.txt`: `ReferenceError: require is not defined in ES module scope` — у головному репо кореневий `package.json` має `"type": "module"`, тому `.js`-файл із `require("node:test")` виконується як ESM. У копії без кореневого `package.json` (прогін `b1-from-code`) ті самі файли трактуються як CommonJS і запускаються (пор. `docs/test-quality.md`, розділ 6). У головному репо код не запускається взагалі. | тест не переносимо (описано текстом, не правимо) |
| 2 | `ai-runs/b1-from-code/tariff.test.js` › whole file | з коду | хибний тест | аналогічно #1: той самий `require` і кореневий `package.json` з `"type": "module"` у головному репо → `require is not defined in ES module scope` (`ai-runs/b1-run.txt`). | тест не переносимо (описано текстом, не правимо) |
| 3 | `app/test/spec/tariff.test.js` › `T1: 121 с → 3 хв; … (TC-02)` | зі специфікації | дефект коду | `docs/spec/tariffs.md` T1: «Неповна хвилина рахується як повна: тривалість округлюється вгору до цілих хвилин.» 121 с → 3 хв. Код `rideMinutes` використовує `Math.round` → 2 хв (`ai-runs/b2-run.txt`: `2 !== 3`). | BUG-1 |
| 4 | `app/test/spec/tariff.test.js` › `T2: 120 с = 2 хв; ≤ 2 хв → погодинне нарахування 0 грн (TC-03)` | зі специфікації | дефект коду | `docs/spec/tariffs.md` T2: «Поїздка тривалістю не більше 2 хвилин (за T1) — без погодинного нарахування.» Код `chargeFor` має `if (minutes < FREE_START_MINUTES)` (`FREE_START_MINUTES = 2`), тобто 2 хв платні — помилка на межі (`ai-runs/b2-run.txt`: `2500 !== 0`). | BUG-2 |
| 5 | `app/test/spec/tariff.test.js` › `T1: 121 с → 3 хв; … (TC-04)` | зі специфікації | дефект коду | аналогічно #3: T1 вимагає округлення вгору, код дає 2 замість 3 (`ai-runs/b2-run.txt`: `2 !== 3`). | BUG-1 |
| 6 | `app/test/spec/tariff.test.js` › `T4: абонент, електровелосипед 75 хв → … 96 грн (TC-13)` | зі специфікації | дефект коду | `docs/spec/tariffs.md` T4: «Електровелосипед: знижка 20 % на погодинне нарахування за T3. Безкоштовних хвилин на електровелосипеді немає.» Код віднімає 45 безкоштовних хвилин і для електровелосипеда (`subscriptionCharge`), даючи 32 грн замість 96 грн (`ai-runs/b2-run.txt`: `3200 !== 9600`). | BUG-3 |

Нестабільних червоних тестів немає: жоден із червоних тестів `ai-runs/b1-run.txt` / `ai-runs/b2-run.txt` не змінює свій результат між прогонами без змін у коді — вони стабільно червоні (b1: помилка модуля на кожен запуск; b2: червоні одні й ті самі твердження про код на кожен запуск). Хибні очікування з чернетки AI (`ai-runs/a1-from-code.md`, TC-19/TC-21 про план `reduced`) не є червоними тестами `b2`, бо вони не потрапили до `app/test/spec/`.

## Дефекти

| ID | Правило | Коротко | Знайшов прогін з коду? | Знайшов прогін зі специфікації? | Коміт виправлення |
|---|---|---|---|---|---|
| BUG-1 | T1 | `rideMinutes` округлює до найближчої (`Math.round`) замість вгору (`Math.ceil`); 121 с дає 2 хв замість 3 | ні | так (TC-02, TC-04) | `dcdd76b` |
| BUG-2 | T2 | `chargeFor` використовує `minutes < 2` замість `minutes <= 2`; 2-хвилинна поїздка платна замість безкоштовної | ні | так (TC-03) | `c1535fd` |
| BUG-3 | T4 | `subscriptionCharge` віднімає 45 безкоштовних хвилин для електровелосипеда, хоча специфікація T4 забороняє безкоштовні хвилини для ebike | ні | так (TC-13) | `3f92d26` |

Звіт про кожен дефект — у `docs/bugs/BUG-<N>.md` (шаблон `docs/templates/bug-report.md`).

## Наявні тести, що почервоніли після виправлення (якщо є)

Тести з `app/test/unit/`, які почервоніли після виправлення коду і які ви змінили за специфікацією. Тести стверджували стару (хибну) поведінку коду; за специфікацією неправий — код, а не тест, тому очікування оновлено відповідно до специфікації (перевірку не послаблено, а уточнено).

| Тест (файл › назва) | Що стверджував | Що каже специфікація (рядок) | Що змінили |
|---|---|---|---|
| `app/test/unit/tariff.test.js` › `a ride of 30 min 20 s is billed as one block` | `minutes = 30`, `timeCharge = 2500` (хибне округлення `Math.round`) | T1: «Неповна хвилина рахується як повна: тривалість округлюється вгору до цілих хвилин» (рядки 46–47) → 30 хв 20 с = 31 хв → `ceil(31/30)=2` блоки → 5000 kop | Перейменовано на `…billed as 31 minutes → 2 blocks (T1)`; очікування `minutes = 31`, `timeCharge = 5000` |
| `app/test/unit/tariff.test.js` › `subscribers ride the first 45 minutes free` | `total = 0` для класичного і електровелосипеда | T4: «Електровелосипед: знижка 20 % на погодинне нарахування за T3. Безкоштовних хвилин на електровелосипеді немає» (рядки 76–77) → для ebike 40 хв = `ceil(40/30)=2` блоки × 4000 − 20% = 6400 kop | Розділено на класичний (`total = 0`) та електровелосипед (`total = 6400`); назва уточнена |

## Повний перелік змін в unit-тестах

Нижче — усі зміни в `app/test/unit/` відносно початкового стану `4606c72`, включно
з двома тестами з попередньої таблиці. Інші unit-файли (`receipt-format.test.js`,
`server.test.js`) не змінювалися.

### Змінені наявні тести

| Тест (файл › назва) | Що було | Що стало | Причина зміни |
|---|---|---|---|
| `app/test/unit/tariff.test.js` › `a ride of 30 min 20 s is billed as 31 minutes → 2 blocks (T1)` | `minutes = 30`, `timeCharge = 2500` (старе `Math.round`) | `minutes = 31`, `timeCharge = 5000` | BUG-1: T1 вимагає округлення вгору; тест приведено до специфікації після `dcdd76b` (коміт тесту `02f1a89`) |
| `app/test/unit/tariff.test.js` › `subscribers: a classic ride keeps the first 45 minutes free (T4)` (був `subscribers ride the first 45 minutes free`) | один тест перевіряв classic і ebike, для обох `total = 0` | classic — `total = 0`; ebike — окремий тест `subscribers: an e-bike ride has no free minutes and pays 20 % less than T3 (T4)` з `total = 6400` | BUG-3: T4 не дає безкоштовних хвилин для ebike; тест розділено, щоб не змішувати два випадки (`3f92d26`, `02f1a89`, `1c7699f`) |
| `app/test/unit/tariff.test.js` › `night rides get 30 % off` | перевірялися `discounts.length`, код знижки та `total < timeCharge` | точні `discounts = [{ code: "night", amount: 750 }]`, `total = 1750` | Посилення слабкої асерції за T10: 30 % від 2500 = 750, до сплати 1750; поведінка не змінилася (`50e0bdb`) |
| `app/test/unit/tariff.test.js` › `a bike kept over a day and left outside the zone pays both fees` | `fees.length === 2` | точні `fees = [out-of-zone 15000, unreturned 200000]`, `total = 245000` | Посилення перевірки T7+T8 (обидва збори незалежно) замість кількості; та сама поведінка, що перевіряє CI-1152 (`50e0bdb`) |

### Додані unit-тести

| Тест (файл › назва) | Причина додавання |
|---|---|
| `app/test/unit/tariff.test.js` › `a zero-minute ride (pickup === return) is allowed and free` | Task C: вбиває M071, фіксує дозволену 0-хв поїздку |
| `app/test/unit/tariff.test.js` › `a non-object ride is rejected with 'ride is required'` | Task C: вбиває M069, перевіряє некоректний вхід (розділ 4 специфікації) |
| `app/test/unit/tariff.test.js` › `an invalid rider type is rejected with 'unknown rider type'` | Task C: вбиває M075; у `50e0bdb` уточнено точний текст помилки |
| `app/test/unit/tariff.test.js` › `a non-ISO pickupAt string is rejected with the ISO message` | Task C: вбиває M080; у `50e0bdb` уточнено вхід і текст помилки |
| `app/test/unit/tariff.test.js` › `a ride of exactly 24 h = 1440 min does NOT pay the unreturned fee` | Task C: вбиває M067, межа T8; у `50e0bdb` посилено до точних `fees`/`discounts` |
| `app/test/unit/tariff.test.js` › `a ride of 24 h 1 min = 1441 min pays the unreturned fee` | Task C: вбиває M014, межа T8; у `50e0bdb` посилено до точного збору |
| `app/test/unit/tariff.test.js` › `a ride whose due equals the day-cap allowance gets no day-cap discount` | Task C: вбиває M023, межа T6; у `50e0bdb` посилено до точних масивів |
| `app/test/unit/tariff.test.js` › `a night ride that is already free gets no night discount entry` | Task C: вбиває M018, взаємодія T10/T4; у `50e0bdb` посилено до точних масивів |
| `app/test/unit/tariff.test.js` › `30 min 1 ms is billed as 31 minutes → 2 blocks (T1)` | Task C: вбиває M033, межа T1 |
| `app/test/unit/tariff.test.js` › `subscribers: an e-bike ride has no free minutes and pays 20 % less than T3 (T4)` | Виділено зі старого тесту `subscribers ride the first 45 minutes free` під час BUG-3; фіксує T4 для ebike (`total = 6400`) |
| `app/test/unit/day-cap.test.js` › `remaining of a rider with no charges on that day is the full cap` | Task C: вбиває M090 |
| `app/test/unit/day-cap.test.js` › `chargedOn of a rider with no charges on that day is zero` | Task C: вбиває M090 |
| `app/test/unit/day-cap.test.js` › `remaining is zero once the rider is charged up to the cap` | Task C: вбиває M085 |

Разом: 4 змінені наявні тести + 13 доданих unit-тестів.

## Тести з коду після виправлення (`ai-runs/b1-rerun.txt`)

Тести з прогону «з коду», які були зелені на початковому коді й почервоніли на виправленому: вони стверджували саме ту поведінку, яку ви виправили. Перелік порожній — **немає**. `ai-runs/b1-rerun.txt` підтверджує: обидва тести з коду (`day-cap.test.js`, `tariff.test.js`) були червоними ще до виправлень (помилка модуля `require` у ESM-проєкті) і залишились червоними після них (`tests 2, pass 0, fail 2`). Тож жоден тест з коду не «почервонів» через виправлення дефектів коду.

## Числа

- Дефектів, які знайшли тести з коду: 0
- Дефектів, які знайшли тести зі специфікації: 3 (BUG-1, BUG-2, BUG-3)
- Тестів з коду, що зафіксували дефект: 0

## Прогони CI (Task D)

Чотири червоні прогони CI за тиждень 19–23.10.2026 класифіковано в `docs/triage.md`
(розділ 2): **дефект коду** — 1, хибний тест — 1, середовище — 1, нестабільний тест — 1.
На кожен прогін класу «дефект коду» — звіт `docs/bugs/CI-<NNNN>.md`; таких тут один.

| ID | Прогін (PR) | Правило | Коротко | Знайдено | Стан |
|---|---|---|---|---|---|
| CI-1152 | run-1152 (PR #238 «tariff: спростити feesFor») | T8 (+T7) | ранній `return` у `feesFor` втрачає збір «за неповернений велосипед»: поїздка водночас «поза зоною» і «понад добу» отримує 1 збір замість 2 — 450,00 грн замість 2 450,00 грн | тест `app/test/unit/tariff.test.js:64` у прогоні `ci/runs/run-1152.log:186–189` | не виправлено: регресія в PR #238; на `main` дефекту немає (набір 20/20), патч — у гілці PR (див. звіт) |

Решта прогонів — не дефекти коду, звітів на них не потрібно (розбори з доказами —
`docs/triage.md`, розділ 2): run-1141 — хибний тест (очікування 120 хв «за станційним
годинником» проти T1 «фактичний час, що минув» = 180 хв), run-1144 — нестабільний тест
(корінь — у самому тесті, розділ 1), run-1147 — середовище (чужий процес раннера
тримає порт 3000).

