- Інструмент і модель: Claude Code, Claude Opus 4.6
- Дата: 2026-11-09
- Що бачила сесія: тимчасова тека ../ws12-c-smells з app/ (поточний стан)
- Що було ввімкнено з пам'яті й глобальних правил: нічого
- Промпт (дослівно):

  > У цій теці — застосунок (app/): код у app/src/ і тести в app/test/.
  > Знайди тестові «запахи» (test smells) у тестах app/test/unit/. Для кожного: файл:рядок,
  > назва тесту, назва запаху і чому це проблема. Нічого не змінюй.
  > Запиши відповідь у файл ai-runs/c-smells.md.
  > Уточнювальних питань не став; працюй з тим, що є.

---

## Тестові запахи в app/test/unit/

### 1. Mystery Guest / Magic Number
**Файл:** `app/test/unit/tariff.test.js:77-82`
**Тест:** `a 45-minute classic ride costs 50 UAH`
**Запах:** Eager Test з mock — тест створює `mock.fn()` з захардкодженим результатом, потім перевіряє цей же результат. Тест не викликає реальну функцію `quote()` і перевіряє тільки те, що mock повертає задане значення. Не тестує жодної логіки.

### 2. Assertion Roulette
**Файл:** `app/test/unit/tariff.test.js:9-21`
**Тест:** `quote returns an itemised price`
**Запах:** Кілька різних вхідних даних (3 rides) перевіряються в одному тесті з `assert.ok` замість точних значень. Якщо один з трьох ride зламає логіку, повідомлення про помилку не покаже який саме. Перевірки надто слабкі (`total >= 0`, `Array.isArray`).

### 3. Eager Test
**Файл:** `app/test/unit/tariff.test.js:30-34`
**Тест:** `e-bikes are billed at the e-bike rate`
**Запах:** Перевіряє `timeCharge` через формулу `Math.ceil(result.minutes / BLOCK_MINUTES) * RATES.ebike` — тобто дублює логіку продакшн-коду в assert. Якщо формула в коді хибна, тест пройде, бо він рахує так само.

### 4. Obscure Test
**Файл:** `app/test/unit/tariff.test.js:67-75`
**Тест:** `the daily cap limits the time charge`
**Запах:** Тест використовує 3 поїздки в циклі, але перевіряє тільки `last.total <= DAY_CAP`. Не перевіряє конкретні значення для кожної поїздки, не перевіряє, що ліміт справді досягнуто і третя поїздка обрізана.

### 5. Sensitive Equality / Weak Assertion
**Файл:** `app/test/unit/tariff.test.js:43-44`
**Тест:** `subscription on a long e-bike ride`
**Запах:** Перевіряє лише `result.total < result.timeCharge` і наявність коду знижки. Не перевіряє точне значення total. Якщо формула знижки хибна (наприклад, дає 1% замість 20%), тест пройде.

### 6. Missing Assertion
**Файл:** `app/test/unit/day-cap.test.js:5-9`
**Тест:** `charges recorded for a day reduce what is left of the cap`
**Запах:** `assert.ok(remaining < DAY_CAP)` — перевіряє лише, що залишок менше ліміту після запису 12000. Не перевіряє конкретне значення (30000 - 12000 = 18000). Будь-яка помилка в підрахунку (наприклад, залишок = 1) пройде тест.
