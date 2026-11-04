- Інструмент і модель: GitHub Copilot CLI 1.0.96, окремий sub-agent `general-purpose` (модель sub-agent'а — за замовчуванням harness; головна сесія — Claude Opus 5.5), запущений головним агентом як нова сесія без історії
- Дата: 2026-11-04
- Що бачила сесія: тимчасова тека `../ws12-c-smells` — копія поточного `app/` (після Task B, `cp -r app ../ws12-c-smells/`)
- Що було ввімкнено з пам'яті й глобальних правил: не вимикалося. Sub-agent стартував із CLI, відкритого в репо, тож у його системному контексті могли бути `AGENTS.md` / `CLAUDE.md` репо й пам'ять Copilot. До промпта додано одне службове речення (англійською) з робочою текою.
- Агент сам записав відповідь у `../ws12-c-smells/ai-runs/c-smells.md` — нижче вона без змін. Нічого в `app/` копії не змінив (перевірено `diff -r`).
- Промпт (дослівно):

  > Your working directory is /Users/sergii.osadchyi-external/IdeaProjects/udc-worksop/ws12-c-smells — work only inside it (all paths below are relative to it).
  >
  > У цій теці — застосунок (app/): код у app/src/ і тести в app/test/.
  > Знайди тестові «запахи» (test smells) у тестах app/test/unit/. Для кожного: файл:рядок,
  > назва тесту, назва запаху і чому це проблема. Нічого не змінюй.
  > Запиши відповідь у файл ai-runs/c-smells.md.
  > Уточнювальних питань не став; працюй з тим, що є.

---

# Тестові «запахи» в `app/test/unit/`

Що перевірено: `day-cap.test.js`, `receipt-format.test.js`, `server.test.js`, `tariff.test.js`
(усі 18 тестів зараз проходять, `node --test test/unit/*.test.js`). Код і тести не змінювалися.
Очікувані числа нижче розраховано вручну за `app/src/` (RATES, BLOCK_MINUTES = 30, DAY_CAP = 30000 коп.).

## Зведена таблиця

| # | Файл:рядок | Тест | Запах | Серйозність |
|---|---|---|---|---|
| 1 | `tariff.test.js:79–84` | a 45-minute classic ride costs 50 UAH | Тестування мока замість SUT (Mock-only test) | висока |
| 2 | `tariff.test.js:9–22` | quote returns an itemised price | Логіка в тесті (цикл) + слабкі/«форма-only» перевірки + Assertion Roulette | висока |
| 3 | `tariff.test.js:69–77` | the daily cap limits the time charge | Слабка (тавтологічна) перевірка + цикл/`let last` у тесті | висока |
| 4 | `tariff.test.js:30–34` | e-bikes are billed at the e-bike rate | Очікуване значення обчислюється логікою продакшн-коду (Tautological test) | висока |
| 5 | `day-cap.test.js:11–13` | the day of a ride is the date of its pickup | Неправильно обрані дані: межовий випадок (Київ ≠ UTC) не покрито | висока |
| 6 | `day-cap.test.js:5–9` | charges recorded for a day reduce what is left of the cap | Слабка перевірка (`<` замість точного значення) | середня |
| 7 | `tariff.test.js:43–47` | subscription on a long e-bike ride | Неінформативна назва + слабкі перевірки | середня |
| 8 | `tariff.test.js:55–62` | night rides get 30 % off | Слабка перевірка суми, магічний коментар замість даних, прив'язка до порядку масиву | середня |
| 9 | `tariff.test.js:64–67` | a bike kept over a day and left outside the zone pays both fees | Перевірка лише кількості (Weak assertion) | середня |
| 10 | `tariff.test.js:49–53` | reduced fare … the fee is not reduced (T5) | Прив'язка до порядку (`fees[0]`) | низька |
| 11 | `tariff.test.js:36–41` | subscribers ride the first 45 minutes free … (T4) | Eager test (дві поведінки в одному тесті) | низька |
| 12 | `receipt-format.test.js:11–21` | a receipt has a line for every item | Магічне число + слабка перевірка вмісту рядків | середня |
| 13 | `receipt-format.test.js:5–9` | amounts are shown in hryvnias | Assertion Roulette / кілька випадків в одному тесті | низька |
| 14 | `server.test.js:29–36` | GET / serves the page and GET /api/health answers | Eager test + неповна перевірка (статус health не перевірено) | низька |
| 15 | `server.test.js:38–47` | POST /api/quote returns the quote and the receipt | Слабка перевірка чека (`endsWith`) | низька |
| 16 | `server.test.js:49–53` | POST /api/quote answers 400 to a body that is not JSON | Слабка перевірка тіла помилки (`assert.ok(error)`) | низька |
| 17 | `tariff.test.js:6`, `day-cap.test.js`, `tariff.test.js` загалом | — | Відсутність посилань на правила специфікації (T1–T10) у більшості назв | низька |

---

## Деталі

### 1. `app/test/unit/tariff.test.js:79–84` — «a 45-minute classic ride costs 50 UAH»
**Запах:** тестування мока (Mock-only / testing the test double).
```js
const priceRide = mock.fn(() => ({ ..., total: 5000 }));
const result = priceRide(ride(...), standard);
assert.equal(result.total, 5000);
```
**Чому погано:** `quote()` взагалі не викликається — тест перевіряє, що мок повертає те, що в нього
зашили. Він пройде за будь-якого (навіть видаленого) `tariff.js`, а назва обіцяє перевірку ціни.
Це хибне відчуття покриття. Виправлення: викликати `quote(ride("…07:00:00Z","…07:45:00Z"), standard)`
і перевірити `minutes === 45`, `timeCharge === 5000`, `total === 5000`; мок прибрати.

### 2. `app/test/unit/tariff.test.js:9–22` — «quote returns an itemised price»
**Запахи:** логіка в тесті (цикл `for` по трьох поїздках), слабкі перевірки лише форми результату
(`total >= 0`, `Array.isArray(...)`, `typeof minutes === "number"`), Assertion Roulette.
**Чому погано:** жодне конкретне значення не перевіряється — тест пройде, якщо `quote` поверне
`{ minutes: 0, total: 0, discounts: [], fees: [] }` для всього. При падінні з циклу незрозуміло,
яка саме поїздка зламалася. Три різні сценарії (безкоштовний старт ≤ 2 хв, 50 хв classic,
130 хв ebike) мають бути окремими тестами з точними очікуваннями (0; 5000; 5 блоків × 4000 = 20000).

### 3. `app/test/unit/tariff.test.js:69–77` — «the daily cap limits the time charge»
**Запахи:** слабка/тавтологічна перевірка (`last.total <= DAY_CAP`), цикл і змінна `let last` у тесті.
**Чому погано:** кожна поїздка — 80 хв ebike = 3 × 4000 = 12000 коп., що вже менше за
`DAY_CAP` (30000). Перевірка проходить, навіть якщо денний ліміт не реалізовано взагалі.
Правильне очікування: 12000, 12000, а третя — 6000 з рядком знижки `day-cap` = 6000;
сума за добу = 30000. Проміжні результати циклу відкидаються, тож перші дві поїздки не перевіряються.

### 4. `app/test/unit/tariff.test.js:30–34` — «e-bikes are billed at the e-bike rate»
**Запах:** тавтологічний тест — очікуване значення обчислюється тією ж формулою, що й у продакшн-коді
(`Math.ceil(result.minutes / BLOCK_MINUTES) * RATES.ebike`), ще й з `result.minutes` самого SUT.
**Чому погано:** якщо помилка в `RATES.ebike`, `BLOCK_MINUTES` чи в підрахунку хвилин — тест її
повторить і пройде. Очікування має бути літералом зі специфікації: 75 хв → 3 блоки → `12000`, `minutes === 75`.

### 5. `app/test/unit/day-cap.test.js:11–13` — «the day of a ride is the date of its pickup»
**Запах:** невдало обрані тестові дані (немає межового випадку), неточна назва.
**Чому погано:** `dayKey` має повертати **київську** дату (`kyivTime(pickupAt).date`), але
`08:00Z` — та сама дата і в UTC, і в Києві. Наївна реалізація `pickupAt.slice(0, 10)` теж пройде.
Потрібні випадки на кшталт `2026-09-16T22:30:00Z` → `"2026-09-17"` і вхід зі зміщенням
(`…+03:00`). Назва не згадує, що мова про київський календарний день.

### 6. `app/test/unit/day-cap.test.js:5–9` — «charges recorded for a day reduce what is left of the cap»
**Запах:** слабка перевірка (`remaining(...) < DAY_CAP`).
**Чому погано:** пройде, якщо `remaining` віднімає неправильну суму (1 коп. чи 29999). Точне
очікування — `30000 − 12000 = 18000`. Також не перевірено, що інший день/інший райдер ліміту не зменшують.

### 7. `app/test/unit/tariff.test.js:43–47` — «subscription on a long e-bike ride»
**Запахи:** неінформативна назва (не каже, яку поведінку очікуємо), слабкі перевірки
(`some(code === "subscription")`, `total < timeCharge`).
**Чому погано:** будь-яка знижка з кодом `subscription` будь-якого розміру пройде. Очікування:
100 хв → 4 блоки = 16000, знижка 20 % = 3200, `total === 12800`.

### 8. `app/test/unit/tariff.test.js:55–62` — «night rides get 30 % off»
**Запахи:** слабка перевірка підсумку (`total < timeCharge` — будь-яка знижка підходить);
залежність від порядку (`discounts[0]`); магічний коментар `// 01:10–01:40 in Kyiv` замість
явних даних (UTC-рядки `22:10Z`, читач мусить знати зміщення).
**Чому погано:** 20 % чи 50 % теж пройдуть. Точне очікування: 2500 → знижка 750, `total === 1750`.
Межі нічного інтервалу (05:59 / 06:00 Київ) не перевіряються. Немає посилання на правило T10.

### 9. `app/test/unit/tariff.test.js:64–67` — «a bike kept over a day and left outside the zone pays both fees»
**Запах:** слабка перевірка — лише `fees.length === 2`.
**Чому погано:** не перевірено ні коди (`out-of-zone`, `unreturned`), ні суми (15000, 200000), ні
підсумок (час 2880 хв обмежено денним лімітом 30000 → `total === 245000`). Два будь-які збори
пройдуть.

### 10. `app/test/unit/tariff.test.js:49–53` — «reduced fare … the fee is not reduced (T5)»
**Запах:** прив'язка до порядку елементів (`fees[0]`) замість пошуку за кодом.
**Чому погано:** тест крихкий до зміни порядку зборів і не перевіряє, що `fees[0]` — саме
`out-of-zone`. Загалом тест хороший (точний `total === 17500`).

### 11. `app/test/unit/tariff.test.js:36–41` — «subscribers ride the first 45 minutes free …, e-bikes get 20 % off instead (T4)»
**Запах:** Eager test — дві незалежні поведінки (classic і ebike) в одному тесті.
**Чому погано:** якщо впаде перша перевірка, друга не виконається — частина інформації губиться.
Також межа «45 хв» (45 vs 46 хв) не перевіряється, хоча назва про неї.

### 12. `app/test/unit/receipt-format.test.js:11–21` — «a receipt has a line for every item»
**Запахи:** магічне число (`lines.length === 5` без пояснення: тривалість + нарахування + 1 знижка
+ 1 збір + до сплати); слабка перевірка вмісту (`includes("185,00")` лише в останньому рядку).
**Чому погано:** назва обіцяє «рядок для кожної позиції», але не перевірено, що рядки знижки
(`Знижка: нічна … -15,00 грн`) і збору (`Збір: повернення поза зоною … 150,00 грн`) існують і мають
правильні суми/знаки. `includes("185,00")` пройде і для «1 185,00» або «-185,00».

### 13. `app/test/unit/receipt-format.test.js:5–9` — «amounts are shown in hryvnias»
**Запах:** кілька випадків в одному тесті (Assertion Roulette у легкій формі).
**Чому погано:** перша невдача ховає решту; бракує меж: 0, < 100 коп. (`5` → «0,05 грн»),
рівно 1000 грн, мільйони (кілька роздільників).

### 14. `app/test/unit/server.test.js:29–36` — «GET / serves the page and GET /api/health answers»
**Запахи:** Eager test (два ендпоінти в одному тесті, «and» у назві); неповна перевірка —
для `/api/health` не перевірено `status` і `content-type`, для `/` — тіло сторінки.
**Чому погано:** якщо health відповідає 500 із тілом `{status:"ok"}`, тест пройде.

### 15. `app/test/unit/server.test.js:38–47` — «POST /api/quote returns the quote and the receipt»
**Запах:** слабка перевірка чека (`at(-1).endsWith("50,00 грн")`), не перевірено `content-type`.
**Чому погано:** «150,00 грн» теж закінчується на «50,00 грн». Краще — порівняти з
`formatReceipt(json.quote)` або точним рядком.

### 16. `app/test/unit/server.test.js:49–53` — «POST /api/quote answers 400 to a body that is not JSON»
**Запах:** слабка перевірка (`assert.ok(JSON.parse(res.body).error)`).
**Чому погано:** будь-яке непорожнє значення `error` проходить; не перевіряється зміст повідомлення
і `content-type`. Немає парних випадків на валідний JSON з невалідними даними (має бути 400 від `QuoteError`).

### 17. Загальне — назви без посилань на правила, «загадкові» дані
**Запах:** Mystery Guest / неявний зв'язок зі специфікацією. Більшість назв у `tariff.test.js`
(рядки 30, 43, 55, 64, 69, 79, 86) і всі в `day-cap.test.js` не посилаються на правило T1–T10;
часи задані в UTC (`…Z`), хоча правила (ніч, доба) сформульовані в київському часі.
**Чому погано:** важко простежити тест до вимоги (traceability) і зрозуміти, чому обрано саме ці
дані; легко не помітити, що межі в київському часі не покрито.

---

## Що в порядку
- `tariff.test.js:24–28` (T1, округлення 30 хв 20 с → 31 хв, 2 блоки) — точні значення, межовий випадок, посилання на правило.
- `tariff.test.js:86–88` (повернення раніше взяття → `QuoteError`) — чітко; можна додатково перевірити повідомлення.
- `server.test.js:7–27` — фейкові `req`/`res` без відкриття порту, без спільного стану між тестами — добре.
- Тести не мають спільного змінюваного стану й не залежать від порядку виконання; випадкові дані
  (`helpers/factory.js`) у unit-тестах не використовуються (лише в `test/integration/receipt.test.js`).
