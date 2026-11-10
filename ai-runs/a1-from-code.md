- Інструмент і модель: OpenCode, Nemotron 3.5 Super VL Free
- Дата: 2026-11-08
- Що бачила сесія: тимчасова тека D:\Lessons_Selenium_Bionics\lesson1\ws12-a1 з кодом сервісу велопрокату громади в app/src/; вказівка читати лише файли з app/src/
- Що було ввімкнено з пам'яті й глобальних правил: нічого
- Промпт (дослівно):

  > У цій теці — код сервісу, який рахує вартість поїздок велопрокату громади (app/src/).
  > Читай лише файли в app/src/.
  > Склади набір тест-кейсів для розрахунку вартості поїздки. Для кожного кейсу: ID; що
  > перевіряє; вхідні дані (усе, від чого залежить результат); очікуваний результат у
  > копійках; звідки взято це очікування.
  > Запиши відповідь у файл a1-from-code.md. Нічого іншого не створюй і не змінюй.
  > Уточнювальних питань не став; працюй з тим, що є

---

# Тест-кейси для розрахунку вартості поїздки велопрокату

Джерело логіки — виключно файли з `app/src/`:
- `app/src/tariff.js` — функція `quote`, всі константи та правила тарифікації.
- `app/src/zones.js` — таблиця станцій і їхні зони ("in" / "out").
- `app/src/day-cap.js` — денний ліміт (DAY_CAP) та логіка книги рахунків.
- `app/src/kyiv-time.js` — київський час (визначає нічну знижку).

Усі суми в **копійках** (1 грн = 100 копійок).

## Константи (tariff.js)

| Константа | Значення | Примітка |
|---|---|---|
| `RATES.classic` | 2500 kop за блок | |
| `RATES.ebike` | 4000 kop за блок | |
| `BLOCK_MINUTES` | 30 хв | розмір тарифного блоку |
| `FREE_START_MINUTES` | 2 хв | поїздки коротше 2 хв — безкоштовні |
| `SUBSCRIPTION_FREE_MINUTES` | 45 хв | для абонементів: перші 45 хв безкоштовні |
| `SUBSCRIPTION_EBIKE_PERCENT` | 20 % | знижка на електробайк для абонементів після безкоштовних хв |
| `REDUCED_PERCENT` | 50 % | пільговий тариф |
| `NIGHT_PERCENT` | 30 % | нічна знижка |
| `NIGHT_UNTIL_HOUR` | 6 | година піку < 6 (Київ) = ніч |
| `OUT_OF_ZONE_FEE` | 15000 kop | повернення поза зоною |
| `UNRETURNED_FEE` | 200000 kop | неповернений велосипед (> 1440 хв) |
| `UNRETURNED_AFTER_MINUTES` | 1440 | поріг неповернення |
| `DAY_CAP` | 30000 kop | денний ліміт на оплату часу |

Станції (zones.js): S01–S08 — зона "in"; X01–X03 — зона "out".

Київський час для тестів (зимовий період, Київ = UTC+2):
- `2026-01-15T10:00:00Z` → Kyiv 12:00 (день, година ≥ 6)
- `2026-01-15T02:00:00Z` → Kyiv 04:00 (ніч, година < 6)
- `2026-01-15T04:00:00Z` → Kyiv 06:00 (межа, година не < 6)

---

## Група А — Базовий тариф (без знижок і зборів)

### TC-01 — Поїздка менше 2 хв — безкоштовна

**Що перевіряє:** поїздки коротше `FREE_START_MINUTES` не тарифікуються (`tariff.js:78-79`).

**Вхідні дані:**
- `ride`: `{ pickupAt: "2026-01-15T10:00:00Z", returnAt: "2026-01-15T10:01:00Z", bike: "classic", returnStation: "S01" }`
- `rider`: `{ type: "standard" }`
- опції: без `dayCap` (ліміт `DAY_CAP = 30000`)

**Розрахунок:** `minutes = 1`; `1 < 2` → `timeCharge = 0`; план знижок не має значення (`due = 0`, ніч не застосовується, збори відсутні).

**Очікуваний результат:** `total = 0` kop; `minutes = 1`; `timeCharge = 0`; `discounts = []`; `fees = []`.

**Джерело:** `tariff.js:78-81` (`chargeFor`), `tariff.js:40-67`.

---

### TC-02 — Поїздка рівно 2 хв — один тарифний блок

**Що перевіряє:** поріг `FREE_START_MINUTES` включає саме 2 хв; округляється вгору до блоку (`tariff.js:74-76, 78-81`).

**Вхідні дані:**
- `ride`: `{ pickupAt: "2026-01-15T10:00:00Z", returnAt: "2026-01-15T10:02:00Z", bike: "classic", returnStation: "S01" }`
- `rider`: `{ type: "standard" }`

**Розрахунок:** `minutes = 2`; `blocks = ceil(2/30) = 1`; `timeCharge = 1 × 2500 = 2500`; стандарт — без знижок; `due = 2500`.

**Очікуваний результат:** `total = 2500` kop; `minutes = 2`; `timeCharge = 2500`.

**Джерело:** `tariff.js:18-19, 74-81`.

---

### TC-03 — Класик, 30 хв (1 блок), стандарт, денна поїздка

**Що перевіряє:** базова оплата одного блоку класичного велосипеда.

**Вхідні дані:**
- `ride`: `{ pickupAt: "2026-01-15T10:00:00Z", returnAt: "2026-01-15T10:30:00Z", bike: "classic", returnStation: "S01" }`
- `rider`: `{ type: "standard" }`

**Розрахунок:** `minutes = 30`; `blocks = 1`; `timeCharge = 2500`; `due = 2500`.

**Очікуваний результат:** `total = 2500` kop.

**Джерело:** `tariff.js:18-19, 74-81`.

---

### TC-04 — Класик, 31 хв (2 блоки), стандарт, денна поїздка

**Що перевіряє:** цілечислене округлення вгору до блоку при перевищенні межі блоку (`tariff.js:75`).

**Вхідні дані:**
- `ride`: `{ pickupAt: "2026-01-15T10:00:00Z", returnAt: "2026-01-15T10:31:00Z", bike: "classic", returnStation: "S01" }`
- `rider`: `{ type: "standard" }`

**Розрахунок:** `minutes = 31`; `blocks = ceil(31/30) = 2`; `timeCharge = 2 × 2500 = 5000`.

**Очікуваний результат:** `total = 5000` kop; `minutes = 31`.

**Джерело:** `tariff.js:74-81`.

---

### TC-05 — Електробайк, 30 хв, стандарт, денна поїздка

**Що перевіряє:** тариф електробайка (інша константа `RATES.ebike`).

**Вхідні дані:**
- `ride`: `{ pickupAt: "2026-01-15T10:00:00Z", returnAt: "2026-01-15T10:30:00Z", bike: "ebike", returnStation: "S01" }`
- `rider`: `{ type: "standard" }`

**Розрахунок:** `minutes = 30`; `blocks = 1`; `timeCharge = 1 × 4000 = 4000`.

**Очікуваний результат:** `total = 4000` kop.

**Джерело:** `tariff.js:18-19, 74-81`.

---

### TC-06 — Електробайк, 60 хв, стандарт, денна поїздка

**Що перевіряє:** дві тарифні блоки для електробайка.

**Вхідні дані:**
- `ride`: `{ pickupAt: "2026-01-15T10:00:00Z", returnAt: "2026-01-15T11:00:00Z", bike: "ebike", returnStation: "S01" }`
- `rider`: `{ type: "standard" }`

**Розрахунок:** `minutes = 60`; `blocks = 2`; `timeCharge = 2 × 4000 = 8000`.

**Очікуваний результат:** `total = 8000` kop.

**Джерело:** `tariff.js:18-19, 74-81`.

---

## Група Б — Знижки за категорією пасажира

### TC-07 — Пільговий (reduced), класик, 60 хв, денна поїздка

**Що перевіряє:** знижка `REDUCED_PERCENT = 50 %` від `timeCharge` (`tariff.js:94-96, 101-103`).

**Вхідні дані:**
- `ride`: `{ pickupAt: "2026-01-15T10:00:00Z", returnAt: "2026-01-15T11:00:00Z", bike: "classic", returnStation: "S01" }`
- `rider`: `{ type: "reduced" }`

**Розрахунок:** `timeCharge = 5000`; reduced discount = `discount(5000, 50) = 5000 − floor(5000×50/100) = 2500`; `due = 2500`.

**Очікуваний результат:** `total = 2500` kop; `discounts = [{ code: "reduced", amount: 2500 }]`.

**Джерело:** `tariff.js:89-98, 101-103`.

---

### TC-08 — Абонемент (subscriber), класик, 30 хв (у межах безкоштовних 45 хв), денна поїздка

**Що перевіряє:** абонементні безкоштовні хвилі — оплата 0, якщо поїздка ≤ `SUBSCRIPTION_FREE_MINUTES` (`tariff.js:83-86, 91-93`).

**Вхідні дані:**
- `ride`: `{ pickupAt: "2026-01-15T10:00:00Z", returnAt: "2026-01-15T10:30:00Z", bike: "classic", returnStation: "S01" }`
- `rider`: `{ type: "subscriber", id: "R1" }`

**Розрахунок:** `timeCharge = 2500`; `subscriptionCharge = blocks(max(0, 30−45)) × 2500 = blocks(0) × 2500 = 0`; subscription discount = `2500 − 0 = 2500`; `due = 0`.

**Очікуваний результат:** `total = 0` kop; `discounts = [{ code: "subscription", amount: 2500 }]`.

**Джерело:** `tariff.js:83-86, 89-98`.

---

### TC-09 — Абонемент, класик, 60 хв, денна поїздка

**Що перевіряє:** абонемент платить лише за хвилі після 45 безкоштовних (`tariff.js:83-86`).

**Вхідні дані:**
- `ride`: `{ pickupAt: "2026-01-15T10:00:00Z", returnAt: "2026-01-15T11:00:00Z", bike: "classic", returnStation: "S01" }`
- `rider`: `{ type: "subscriber", id: "R1" }`

**Розрахунок:** `timeCharge = 5000`; `subscriptionCharge = blocks(60−45) × 2500 = blocks(15) × 2500 = 1 × 2500 = 2500`; discount = `5000 − 2500 = 2500`; `due = 2500`.

**Очікуваний результат:** `total = 2500` kop; `discounts = [{ code: "subscription", amount: 2500 }]`.

**Джерело:** `tariff.js:83-86, 89-98`.

---

### TC-10 — Абонемент, класик, 45 хв (межа безкоштовних), денна поїздка

**Що перевіряє:** рівно 45 хв — ще в межах безкоштовних (`Math.max(0, 45−45) = 0`).

**Вхідні дані:**
- `ride`: `{ pickupAt: "2026-01-15T10:00:00Z", returnAt: "2026-01-15T10:45:00Z", bike: "classic", returnStation: "S01" }`
- `rider`: `{ type: "subscriber", id: "R1" }`

**Розрахунок:** `minutes = 45`; `timeCharge = blocks(45) × 2500 = 2 × 2500 = 5000`; `subscriptionCharge = blocks(0) × 2500 = 0`; discount = `5000`; `due = 0`.

**Очікуваний результат:** `total = 0` kop.

**Джерело:** `tariff.js:74-81, 83-86`.

---

### TC-11 — Абонемент, класик, 46 хв (щойно за межею безкоштовних), денна поїздка

**Що перевіряє:** 46 хв — один блок оплачується (`blocks(max(0, 46−45)) = blocks(1) = 1`).

**Вхідні дані:**
- `ride`: `{ pickupAt: "2026-01-15T10:00:00Z", returnAt: "2026-01-15T10:46:00Z", bike: "classic", returnStation: "S01" }`
- `rider`: `{ type: "subscriber", id: "R1" }`

**Розрахунок:** `timeCharge = blocks(46) × 2500 = 2 × 2500 = 5000`; `subscriptionCharge = blocks(1) × 2500 = 2500`; discount = `2500`; `due = 2500`.

**Очікуваний результат:** `total = 2500` kop.

**Джерело:** `tariff.js:74-81, 83-86`.

---

### TC-12 — Абонемент, електробайк, 60 хв, денна поїздка

**Що перевіряє:** для абонементів на електробайку додаткова знижка `SUBSCRIPTION_EBIKE_PERCENT = 20 %` на платну частину (`tariff.js:84-86`).

**Вхідні дані:**
- `ride`: `{ pickupAt: "2026-01-15T10:00:00Z", returnAt: "2026-01-15T11:00:00Z", bike: "ebike", returnStation: "S01" }`
- `rider`: `{ type: "subscriber", id: "R1" }`

**Розрахунок:** `timeCharge = 8000`; `subscriptionCharge = blocks(15) × 4000 = 4000`; ebike −20%: `discount(4000, 20) = 4000 − floor(4000×80/100) = 800`; `charge = 4000 − 800 = 3200`; subscription discount = `8000 − 3200 = 4800`; `due = 8000 − 4800 = 3200`.

**Очікуваний результат:** `total = 3200` kop; `discounts = [{ code: "subscription", amount: 4800 }]`.

**Джерело:** `tariff.js:83-86, 89-98, 101-103`.

---

### TC-13 — Абонемент + пільга (concession), класик, 30 хв, денна поїздка

**Що перевіряє:** абонемент з правом на пільгу — обирається вигідніший план (subscription дає більше, ніж reduced) (`tariff.js:94-97`).

**Вхідні дані:**
- `ride`: `{ pickupAt: "2026-01-15T10:00:00Z", returnAt: "2026-01-15T10:30:00Z", bike: "classic", returnStation: "S01" }`
- `rider`: `{ type: "subscriber", concession: true, id: "R1" }`

**Розрахунок:** `timeCharge = 2500`; subscription discount = `2500` (як TC-08); reduced discount = `discount(2500, 50) = 1250`; `cheaperPlan` обирає `subscription` (2500 > 1250); `due = 0`.

**Очікуваний результат:** `total = 0` kop; `discounts = [{ code: "subscription", amount: 2500 }]`.

**Джерело:** `tariff.js:89-98`.

---

### TC-14 — Абонемент + пільга, класик, 60 хв (нічия в cheaperPlan), денна поїздка

**Що перевіряє:** при рівних знижках виграє перший план (subscription, через строге `>` в `tariff.js:97`).

**Вхідні дані:**
- `ride`: `{ pickupAt: "2026-01-15T10:00:00Z", returnAt: "2026-01-15T11:00:00Z", bike: "classic", returnStation: "S01" }`
- `rider`: `{ type: "subscriber", concession: true, id: "R1" }`

**Розрахунок:** `timeCharge = 5000`; subscription discount = `2500`; reduced discount = `discount(5000, 50) = 2500`; равення → subscription; `due = 2500`.

**Очікуваний результат:** `total = 2500` kop; `discounts = [{ code: "subscription", amount: 2500 }]`.

**Джерело:** `tariff.js:89-98`.

---

## Група В — Нічна знижка

### TC-15 — Нічна знижка, класик, 60 хв, стандарт, pick-up о 04:00 київського часу

**Що перевіряє:** нічна знижка `NIGHT_PERCENT = 30 %`, коли година піку < 6 за київським часом (`tariff.js:50-54`, `kyiv-time.js`).

**Вхідні дані:**
- `ride`: `{ pickupAt: "2026-01-15T02:00:00Z", returnAt: "2026-01-15T03:00:00Z", bike: "classic", returnStation: "S01" }` (Kyiv 04:00 → 05:00)
- `rider`: `{ type: "standard" }`

**Розрахунок:** `kyivTime(pickup).hour = 4 < 6`; `timeCharge = 5000`; night discount = `discount(5000, 30) = 5000 − floor(5000×70/100) = 1500`; `due = 3500`.

**Очікуваний результат:** `total = 3500` kop; `discounts = [{ code: "night", amount: 1500 }]`.

**Джерело:** `tariff.js:50-54, 101-103`; `kyiv-time.js:14-21`.

---

### TC-16 — Нічна границя, година = 6 — знижка не застосовується

**Що перевіряє:** о 6:00 київського часу нічна знижка не діє (`hour < 6` є хибним).

**Вхідні дані:**
- `ride`: `{ pickupAt: "2026-01-15T04:00:00Z", returnAt: "2026-01-15T05:00:00Z", bike: "classic", returnStation: "S01" }` (Kyiv 06:00 → 07:00)
- `rider`: `{ type: "standard" }`

**Розрахунок:** `kyivTime(pickup).hour = 6`, не < 6 → нічні знижки немає; `timeCharge = 5000`; `due = 5000`.

**Очікуваний результат:** `total = 5000` kop; `discounts = []`.

**Джерело:** `tariff.js:50`; `kyiv-time.js:14-21`.

---

### TC-17 — Нічна + пільгова (reduced) одночасно

**Що перевіряє:** нічна знижка застосовується до суми вже після пільгової (`tariff.js:44-54`).

**Вхідні дані:**
- `ride`: `{ pickupAt: "2026-01-15T02:00:00Z", returnAt: "2026-01-15T03:00:00Z", bike: "classic", returnStation: "S01" }` (Kyiv 04:00)
- `rider`: `{ type: "reduced" }`

**Розрахунок:** `timeCharge = 5000`; reduced discount = `2500`; `due = 2500`; night discount = `discount(2500, 30) = 2500 − floor(2500×70/100) = 750`; `due = 1750`.

**Очікуваний результат:** `total = 1750` kop; `discounts = [{ code: "reduced", amount: 2500 }, { code: "night", amount: 750 }]`.

**Джерело:** `tariff.js:44-54, 89-98, 101-103`.

---

## Група Г — Збори (зона та неповернення)

### TC-18 — Збір поза зоною, стандартний пасажир

**Що перевіряє:** повернення на станцію зони "out" додає `OUT_OF_ZONE_FEE` (`tariff.js:105-109`, `zones.js`).

**Вхідні дані:**
- `ride`: `{ pickupAt: "2026-01-15T10:00:00Z", returnAt: "2026-01-15T10:30:00Z", bike: "classic", returnStation: "X01" }` (X01 — зона "out")
- `rider`: `{ type: "standard" }`

**Розрахунок:** `timeCharge = 2500`; `due = 2500`; fee `out-of-zone = 15000` (план не reduced, збір не зменшується).

**Очікуваний результат:** `total = 2500 + 15000 = 17500` kop; `fees = [{ code: "out-of-zone", amount: 15000 }]`.

**Джерело:** `tariff.js:26, 63-66, 105-109`; `zones.js:3-15`.

---

### TC-19 — Збір поза зоною + reduced (збір також скорочується на 50 %)

**Що перевіряє:** при плані `reduced` збори теж зменшуються на `REDUCED_PERCENT` (`tariff.js:63-65`).

**Вхідні дані:**
- `ride`: `{ pickupAt: "2026-01-15T10:00:00Z", returnAt: "2026-01-15T10:30:00Z", bike: "classic", returnStation: "X01" }`
- `rider`: `{ type: "reduced" }`

**Розрахунок:** `timeCharge = 2500`; reduced discount = `1250`; `due = 1250`; fee: `plan.code === "reduced"` → `15000 − discount(15000, 50) = 15000 − 7500 = 7500`.

**Очікуваний результат:** `total = 1250 + 7500 = 8750` kop; `fees = [{ code: "out-of-zone", amount: 7500 }]`.

**Джерело:** `tariff.js:63-65, 101-103, 105-109`.

---

### TC-20 — Неповернений велосипед (> 1440 хв), стандарт

**Що перевіряє:** збір `UNRETURNED_FEE` після `UNRETURNED_AFTER_MINUTES` та денний ліміт до зборів (`tariff.js:27-28, 56-61, 105-109`).

**Вхідні дані:**
- `ride`: `{ pickupAt: "2026-01-15T10:00:00Z", returnAt: "2026-01-16T10:01:00Z", bike: "classic", returnStation: "S01" }` (1441 хв)
- `rider`: `{ type: "standard" }`

**Розрахунок:** `minutes = 1441`; `timeCharge = ceil(1441/30) × 2500 = 49 × 2500 = 122500`; без `dayCap` → allowance `DAY_CAP = 30000`; `due = 122500 > 30000` → day-cap discount = `92500`, `due = 30000`; fee `unreturned = 200000`.

**Очікуваний результат:** `total = 30000 + 200000 = 230000` kop; `discounts = [{ code: "day-cap", amount: 92500 }]`; `fees = [{ code: "unreturned", amount: 200000 }]`.

**Джерело:** `tariff.js:26-28, 56-61, 105-109`; `day-cap.js:3`.

---

### TC-21 — Неповернений велосипед + reduced (збір скорочується на 50 %)

**Що перевіряє:** збір за неповернення теж підлягає пільговому скороченню (`tariff.js:63-65`).

**Вхідні дані:**
- `ride`: `{ pickupAt: "2026-01-15T10:00:00Z", returnAt: "2026-01-16T10:01:00Z", bike: "classic", returnStation: "S01" }` (1441 хв)
- `rider`: `{ type: "reduced" }`

**Розрахунок:** `timeCharge = 122500`; reduced discount = `discount(122500, 50) = 61250`; `due = 61250`; day cap: `due > 30000` → day-cap discount = `31250`, `due = 30000`; fee unreturned, reduced: `200000 − discount(200000, 50) = 100000`.

**Очікуваний результат:** `total = 30000 + 100000 = 130000` kop; `fees = [{ code: "unreturned", amount: 100000 }]`.

**Джерело:** `tariff.js:63-65, 105-109`.

---

## Група Д — Денний ліміт (day cap)

### TC-22 — Денний ліміт не перевищено (залишка достатньо)

**Що перевіряє:** коли `due` не перевищує залишок денного ліміту, ліміт не зменшує суму (`tariff.js:56-60`, `day-cap.js:17-19`).

**Вхідні дані:**
- `ride`: `{ pickupAt: "2026-01-15T10:00:00Z", returnAt: "2026-01-15T11:00:00Z", bike: "classic", returnStation: "S01" }` (timeCharge = 5000)
- `rider`: `{ type: "standard", id: "R1" }`
- `dayCap`: створений `createDayCap()`, вже зараховано `20000` kop за поточний день

**Розрахунок:** `allowance = 30000 − 20000 = 10000`; `due = 5000 < 10000` → ліміт не спрацьовує; `total = 5000`; `dayCap.record("R1", pickup, 5000)`.

**Очікуваний результат:** `total = 5000` kop; `discounts = []`.

**Джерело:** `tariff.js:56-61`; `day-cap.js:10-23`.

---

### TC-23 — Денний ліміт обмежує оплату

**Що перевіряє:** коли `due` перевищує залишок ліміту, discount `day-cap` зводить `due` до залишка (`tariff.js:57-59`).

**Вхідні дані:**
- `ride`: `{ pickupAt: "2026-01-15T10:00:00Z", returnAt: "2026-01-15T11:00:00Z", bike: "classic", returnStation: "S01" }` (timeCharge = 5000)
- `rider`: `{ type: "standard", id: "R1" }`
- `dayCap`: вже зараховано `28000` kop за поточний день

**Розрахунок:** `allowance = 30000 − 28000 = 2000`; `due = 5000 > 2000` → day-cap discount = `3000`, `due = 2000`.

**Очікуваний результат:** `total = 2000` kop; `discounts = [{ code: "day-cap", amount: 3000 }]`.

**Джерело:** `tariff.js:56-60`; `day-cap.js:10-23`.

---

### TC-24 — Денний ліміт рівно на межі (знижка не застосовується)

**Що перевіряє:** порівняння строге `due > allowance`; при рівності ліміт не зменшує (`tariff.js:57`).

**Вхідні дані:**
- `ride`: `{ pickupAt: "2026-01-15T10:00:00Z", returnAt: "2026-01-15T11:00:00Z", bike: "classic", returnStation: "S01" }` (timeCharge = 5000)
- `rider`: `{ type: "standard", id: "R1" }`
- `dayCap`: вже зараховано `25000` kop за поточний день

**Розрахунок:** `allowance = 30000 − 25000 = 5000`; `due = 5000`, не `> 5000` → знижки немає.

**Очікуваний результат:** `total = 5000` kop; `discounts = []`.

**Джерело:** `tariff.js:57`.

---

## Група Е — Валідація та помилки

### TC-25 — Невідомий тип велосипеда

**Що перевіряє:** функція кидає `QuoteError` для невідомого `bike` (`tariff.js:117`).

**Вхідні дані:**
- `ride`: `{ pickupAt: "2026-01-15T10:00:00Z", returnAt: "2026-01-15T10:30:00Z", bike: "scooter", returnStation: "S01" }`
- `rider`: `{ type: "standard" }`

**Очікуваний результат:** помилка `QuoteError: unknown bike type: scooter`.

**Джерело:** `tariff.js:117-118`.

---

### TC-26 — returnAt раніше pickupAt

**Що перевіряє:** функція кидає `QuoteError`, якщо час повернення раніше часу виїзду (`tariff.js:116`).

**Вхідні дані:**
- `ride`: `{ pickupAt: "2026-01-15T10:00:00Z", returnAt: "2026-01-15T09:00:00Z", bike: "classic", returnStation: "S01" }`
- `rider`: `{ type: "standard" }`

**Очікуваний результат:** помилка `QuoteError: returnAt is before pickupAt`.

**Джерело:** `tariff.js:116`.

---

### TC-27 — Невідома станція повернення

**Що перевіряє:** функція кидає `QuoteError` для невідомої станції (`tariff.js:118-119`, `zones.js:20-22`).

**Вхідні дані:**
- `ride`: `{ pickupAt: "2026-01-15T10:00:00Z", returnAt: "2026-01-15T10:30:00Z", bike: "classic", returnStation: "S99" }`
- `rider`: `{ type: "standard" }`

**Очікуваний результат:** помилка `QuoteError: unknown station: S99`.

**Джерело:** `tariff.js:118-119`; `zones.js:18-27`.

---

### TC-28 — rider.id обов'язковий при наданні dayCap

**Що перевіряє:** без `rider.id` не можна користуватися книгою денного ліміту (`tariff.js:125`).

**Вхідні дані:**
- `ride`: `{ pickupAt: "2026-01-15T10:00:00Z", returnAt: "2026-01-15T10:30:00Z", bike: "classic", returnStation: "S01" }`
- `rider`: `{ type: "standard" }` (без `id`)
- `dayCap`: `createDayCap()`

**Очікуваний результат:** помилка `QuoteError: rider.id is required with a daily cap ledger`.

**Джерело:** `tariff.js:123-126`.

---

### TC-29 — Некоректний формат pickupAt

**Що перевіряє:** функція кидає `QuoteError`, якщо дата не відповідає ISO 8601 з оフセтом (`tariff.js:128-131`).

**Вхідні дані:**
- `ride`: `{ pickupAt: "not-a-date", returnAt: "2026-01-15T10:30:00Z", bike: "classic", returnStation: "S01" }`
- `rider`: `{ type: "standard" }`

**Очікуваний результат:** помилка `QuoteError: pickupAt must be an ISO 8601 date-time with an offset`.

**Джерело:** `tariff.js:128-131`.

---

## Підсумок pokриття

| Логіка tariff.js | Тест-кейси |
|---|---|
| Базова оплата за блоки (`chargeFor`) | TC-01–TC-06 |
| Поріг безкоштовних 2 хв | TC-01, TC-02 |
| Пільговий тариф reduced | TC-07, TC-17, TC-19, TC-21 |
| Абонемент: безкоштовні 45 хв | TC-08, TC-10, TC-12 |
| Абонемент: оплата після 45 хв | TC-09, TC-11, TC-12 |
| Абонемент: електробайк −20 % | TC-12 |
| Абонемент + concession (вибір плану) | TC-13, TC-14 |
| Нічна знижка (година < 6) | TC-15, TC-17 |
| Нічна границя (година = 6) | TC-16 |
| Збір поза зоною (out-of-zone) | TC-18, TC-19 |
| Збір неповернення (unreturned) | TC-20, TC-21 |
| Денний ліміт (day cap) | TC-20–TC-24 |
| Валідація помилок | TC-25–TC-29 |
