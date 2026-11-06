- Інструмент і модель: Claude Code 2.1.168, headless-сесія `claude -p`; модель claude-sonnet-4-6
- Дата: 2026-11-05
- Що бачила сесія: тимчасова тека `C:/ws12-runs/ws12-c-smells` — копія поточного `app/` (після виправлень Task B, коміт c31fa42)
- Що було ввімкнено з пам'яті й глобальних правил: нічого — `--setting-sources project,local` (без `~/.claude/CLAUDE.md` і user settings), `--disable-slash-commands` (без skills), `--strict-mcp-config` (без MCP), `--settings '{"autoMemoryEnabled":false}'` (без пам'яті); тека поза `C:\Users\Haspe`, тому батьківські `CLAUDE.md` не підвантажувались. Перевірено пробною сесією з тими самими прапорцями.
- Промпт (дослівно):

  > У цій теці — застосунок (app/): код у app/src/ і тести в app/test/.
  > Знайди тестові «запахи» (test smells) у тестах app/test/unit/. Для кожного: файл:рядок,
  > назва тесту, назва запаху і чому це проблема. Нічого не змінюй.
  > Запиши відповідь у файл ai-runs/c-smells.md.
  > Уточнювальних питань не став; працюй з тим, що є.

---

# Test Smells — app/test/unit/

## 1. Weak Assertion

**Файл:** `day-cap.test.js:8`
**Тест:** `"charges recorded for a day reduce what is left of the cap"`

```js
assert.ok(ledger.remaining("rider-1", "2026-09-16T12:00:00Z") < DAY_CAP);
```

**Чому проблема.** Перевіряється лише те, що залишок *якось* зменшився (будь-яке значення < 30 000 копійок — проходить). Тест не перевіряє конкретну суму: після запису 12 000 залишок має бути рівно 18 000. Реалізація, що записує 1 копійку замість 12 000, все одно пройде. Потрібно `assert.equal(remaining, DAY_CAP - 12000)`.

---

## 2. Assertion Roulette

**Файл:** `receipt-format.test.js:5–9`
**Тест:** `"amounts are shown in hryvnias"`

```js
assert.equal(formatUah(5000),   "50,00 грн");
assert.equal(formatUah(230000), "2 300,00 грн");
assert.equal(formatUah(-1250),  "-12,50 грн");
```

**Чому проблема.** Три окремих випадки (мале ціле, велике ціле з тисячним роздільником, від'ємне) тестуються в одному тесті без описових повідомлень. Коли провалюється другий `assert.equal`, у стектрейсі буде лише «очікувалось "2 300,00 грн"», але не зрозуміло, яка саме вхідна умова «зламана». Кожен кейс варто виносити в окремий тест або додавати третій аргумент-повідомлення.

---

## 3. Weak Assertion (часткова перевірка рядка)

**Файл:** `receipt-format.test.js:20`
**Тест:** `"a receipt has a line for every item"`

```js
assert.ok(lines.at(-1).includes("185,00"));
```

**Чому проблема.** Перевіряється лише присутність підрядка `"185,00"` у останньому рядку, але не перевіряється: (а) що це рядок «До сплати», (б) що перед числом є правильний префікс, (в) що немає зайвих або дублікатних рядків із тим самим числом. Реалізація, що друкує `"185,00"` у будь-якому рядку чеку, пройде.

---

## 4. Eager Test (кілька точок поведінки в одному тесті)

**Файл:** `server.test.js:29`
**Тест:** `"GET / serves the page and GET /api/health answers"`

```js
const page   = await call("GET", "/");
// ... assertions for /
const health = await call("GET", "/api/health");
// ... assertions for /api/health
```

**Чому проблема.** Один тест перевіряє два незалежних маршрути (`GET /` і `GET /api/health`). Якщо перший assertion провалюється, другий не виконується — і невідомо, чи справний `/api/health`. Назва тесту навіть містить «and», що є явним сигналом об'єднання. Кожен маршрут повинен мати окремий тест.

---

## 5. Conditional Test Logic + Weak Assertion (структурна перевірка замість значень)

**Файл:** `tariff.test.js:9–22`
**Тест:** `"quote returns an itemised price"`

```js
for (const r of rides) {
  const result = quote(r, standard);
  assert.ok(result.total >= 0);
  assert.ok(Array.isArray(result.discounts));
  assert.ok(Array.isArray(result.fees));
  assert.equal(typeof result.minutes, "number");
}
```

**Чому проблема (Conditional Test Logic).** Три сценарії (1 хв, 50 хв, 70 хв ebike) перевіряються у циклі. При падінні другої ітерації в трейсі немає підказки, який саме сценарій провалився. Кожен окремий випадок має бути окремим тестом.

**Чому проблема (Weak Assertion).** Перевіряється лише *форма* результату (`total >= 0`, `Array.isArray`), але не бізнес-значення. Реалізація, що завжди повертає `total = 0` та порожні масиви, пройде всі чотири assertions. Тест не верифікує жодного тарифного правила.

---

## 6. Mirror Assertion (кругова перевірка формулою виробничого коду)

**Файл:** `tariff.test.js:32`
**Тест:** `"e-bikes are billed at the e-bike rate"`

```js
assert.equal(
  result.timeCharge,
  Math.ceil(result.minutes / BLOCK_MINUTES) * RATES.ebike
);
```

**Чому проблема.** Очікуване значення обраховується тією самою формулою (`blocks * RATES.ebike`), яку використовує виробничий код — це кругова перевірка. Якщо у формулі є помилка (наприклад, неправильний множник), обидві сторони рівняння матимуть однакову помилку й тест все одно пройде. Потрібно зафіксувати конкретне число: `assert.equal(result.timeCharge, 12000)` (75 хв = 3 блоки × 4 000).

---

## 7. Conditional Test Logic (цикл замість окремих тестів)

**Файл:** `tariff.test.js:36–44`
**Тест:** `"subscribers ride the first 45 minutes free on a classic bike; an e-bike has no free minutes, 20 % off (T4)"`

```js
for (const { bike, total } of [
  { bike: "classic", total: 0 },
  { bike: "ebike",   total: 6400 },
]) {
  const result = quote(ride(..., { bike }), { type: "subscriber" });
  assert.equal(result.total, total, bike);
}
```

**Чому проблема.** Два сценарії (classic і ebike) запаковані у `for...of`. При падінні другої ітерації тест-ранер повідомить про помилку, але лише у третьому аргументі `assert.equal` — рядку `"ebike"` — є підказка. Це слабкий замінник окремого тесту. Якщо `for` розширити третім елементом, легко пропустити новий проваль. Класичний і е-байковий сценарій заслуговують окремих тестів.

---

## 8. Mocking the System Under Test (тест перевіряє мок, а не логіку)

**Файл:** `tariff.test.js:82–87`
**Тест:** `"a 45-minute classic ride costs 50 UAH"`

```js
const priceRide = mock.fn(() => ({
  minutes: 45, timeCharge: 5000, discounts: [], fees: [], total: 5000,
}));
const result = priceRide(ride("2026-09-16T07:00:00Z", "2026-09-16T07:45:00Z"), standard);
assert.equal(result.total, 5000);
assert.equal(priceRide.mock.callCount(), 1);
```

**Чому проблема.** `priceRide` — це `mock.fn` із захардкодженим поверненням; реальна функція `quote` не викликається взагалі. Тест перевіряє: (а) що мок повертає те, що в нього запрограмовано — тривіально; (б) що мок було викликано один раз — перевіряє фреймворк, а не бізнес-логіку. Якщо `quote` взагалі видалити з кодової бази, цей тест продовжить проходити. Щоб тест мав сенс, потрібно викликати `quote(...)` напряму й перевірити `result.total === 5000`.
