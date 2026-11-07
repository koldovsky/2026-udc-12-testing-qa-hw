- Інструмент і модель: Claude Code 2.1.319 (headless `claude -p`), claude-opus-5-5
- Дата: 2026-11-06
- Що бачила сесія: тимчасова тека `../ws12-c-smells` поруч із репо — копія поточного `app/` (`cp -r app`, стан після Task B, коміт f9338bf): `app/src/`, `app/test/` (unit, spec, integration, helpers), `app/public/`, `app/package.json`, `app/package-lock.json`, `app/README.md`; сесію запущено з цієї теки з `--restricted` (файлові інструменти обмежені текою), інструменти Read, Write, Glob, Grep (без Bash)
- Що було ввімкнено з пам'яті й глобальних правил: нічого з користувацьких/проєктних налаштувань — `--safe-mode` і `--restricted` (CLAUDE.md/AGENTS.md, користувацькі skills, plugins, hooks, output styles, MCP вимкнено) і `--strict-mcp-config` (у init `mcp_servers` порожній); глобальний `~/.claude/CLAUDE.md` порожній (0 байт); у батьківських теках над `../ws12-c-smells` немає CLAUDE.md/AGENTS.md; пам'ять: авто-пам'ять для нової теки порожня (у init-події `memory_paths` немає). Лишилися лише вбудовані в Claude Code plugins (4, `@builtin`) і bundled skills (17) — жоден не викликано
- Дії агента (з журналу stream-json): Glob `app/**/*`, Read app/test/unit/receipt-format.test.js, Read app/test/unit/tariff.test.js, Read app/test/unit/server.test.js, Read app/test/unit/day-cap.test.js, Read app/test/helpers/factory.js, Read app/src/tariff.js, Read app/src/day-cap.js, Read app/src/receipt.js, Read app/README.md, Read app/src/server.js, Read app/src/kyiv-time.js, Write ai-runs/c-smells.md; відхилених викликів немає; тести не запускалися, `npm run mutate` не запускався (Bash недоступний)
- Метрики прогону: 93.003 с (API 92.642 с), ходів 14, токени: вхід 12 + кеш-запис 20319 + кеш-читання 58700, вихід 8108; вартість $0.3365
- Промпт (дослівно):

  > У цій теці — застосунок (app/): код у app/src/ і тести в app/test/.
  > Знайди тестові «запахи» (test smells) у тестах app/test/unit/. Для кожного: файл:рядок,
  > назва тесту, назва запаху і чому це проблема. Нічого не змінюй.
  > Запиши відповідь у файл ai-runs/c-smells.md.
  > Уточнювальних питань не став; працюй з тим, що є.

---

# Тестові «запахи» в `app/test/unit/`

Переглянуто: `tariff.test.js`, `day-cap.test.js`, `receipt-format.test.js`, `server.test.js`
(разом із кодом у `app/src/`, щоб перевірити, які значення реально повертаються).
Код і тести не змінювались.

Для кожного запаху нижче є очікуване значення, обчислене за кодом у `src/`. З ним видно, що
тест міг би перевіряти точніше.

---

## tariff.test.js

### 1. `tariff.test.js:9`, «quote returns an itemised price»
- **Запахи:** слабкі асерції (*Weak / Vague Assertion*), цикл у тесті (*Loop in Test*), неясна назва (*Unclear Test Name*).
- **Чому це проблема:** для трьох різних поїздок (1 хв безкоштовно, 50 хв класичний, 130 хв е-байк)
  тест перевіряє тільки форму результату: `total >= 0`, `discounts`/`fees` є масивами, `minutes` має тип number.
  Він пройде навіть тоді, коли ціна буде зовсім неправильна (наприклад, `total` завжди 0).
  Тест покриває код, але не ловить помилок. Цикл ще й приховує, на якій поїздці тест упав,
  а назва не каже, яку поведінку перевіряють.

### 2. `tariff.test.js:31`, «e-bikes are billed at the e-bike rate»
- **Запахи:** очікуване значення обчислюється тією ж логікою, що й у продакшн-коді
  (*Tautological Test / Logic in Test / Re-implementing the SUT*).
- **Чому це проблема:** `Math.ceil(result.minutes / BLOCK_MINUTES) * RATES.ebike` повторює `chargeFor`
  з `src/tariff.js:76-79` і ще й бере `minutes` із результату самого SUT. Якщо формула блоків
  або хвилин неправильна (наприклад, `floor` замість `ceil`), то неправильними будуть і код, і очікування, і тест пройде.
  Треба порівнювати з конкретним числом зі специфікації: 75 хв → 3 блоки → `12000`.

### 3. `tariff.test.js:37`, «subscribers ride the first 45 minutes free on a classic bike only»
- **Запахи:** умовна логіка в тесті (*Conditional Test Logic*), цикл у тесті, два сценарії в одному тесті (*Eager Test*).
- **Чому це проблема:** очікування задається тернарним виразом `bike === "classic" ? 0 : 6400` всередині
  циклу. Тож це два різні правила (безкоштовні хвилини для класичного велосипеда і −20 % для е-байка) в одному тесті,
  і повідомлення про падіння не каже, для якого велосипеда тест упав. Читачеві доводиться
  виконувати тест «у голові». Краще зробити два окремі тести з фіксованими очікуваннями.

### 4. `tariff.test.js:45`, «subscription on a long e-bike ride»
- **Запахи:** слабкі асерції, назва не описує очікувану поведінку.
- **Чому це проблема:** тест перевіряє тільки, що є знижка з кодом `subscription` і що `total < timeCharge`.
  Будь-яка знижка більша за нуль задовольнить тест, хоча правило вимагає саме 20 %:
  100 хв е-байк → 4 блоки = `16000`, знижка `3200`, до сплати `12800`. Назва описує сценарій, а не результат
  («…коштує», «…дає знижку 20 %»).

### 5. `tariff.test.js:58`, «night rides get 30 % off»
- **Запахи:** слабка асерція на головну поведінку, магічні значення часу без пояснення поясу.
- **Чому це проблема:** назва обіцяє «30 %», але сам відсоток не перевіряється: `total < timeCharge`
  задовольнить будь-яка знижка. Очікувано: `discounts[0].amount === 750`, `total === 1750`.
  Те, що `22:10Z` — це нічний час, залежить від літнього часу Києва (UTC+3). Це пояснено тільки
  коментарем, а сама залежність прихована (*Mystery Guest*-подібна неявна умова).

### 6. `tariff.test.js:67`, «a bike kept over a day and left outside the zone pays both fees»
- **Запахи:** слабка асерція (перевіряється тільки кількість).
- **Чому це проблема:** `fees.length === 2` не перевіряє, які саме це збори і які в них суми
  (`out-of-zone` = 15000, `unreturned` = 200000). Якщо помилково додати один збір двічі
  або змінити суму, тест усе одно пройде.

### 7. `tariff.test.js:72`, «the daily cap limits the time charge»
- **Запахи:** асерція, яка не може впасти за цих даних (*Always-Passing / Weak Assertion*), цикл у тесті.
- **Чому це проблема:** кожна поїздка (80 хв е-байк = 3 блоки = `12000`) і так дешевша за `DAY_CAP` (`30000`),
  тому `last.total <= DAY_CAP` виконується навіть без денного ліміту. Тест не перевіряє, що ліміт
  щось обмежив. Насправді третя поїздка має коштувати `6000` і мати знижку `day-cap` = `6000`.
  До того ж перевіряється лише остання ітерація циклу, а перші дві не перевіряються взагалі.

### 8. `tariff.test.js:82`, «a 45-minute classic ride costs 50 UAH»
- **Запахи:** мок замість тестованого коду (*Mocking the SUT / Testing the Mock*), тавтологічний тест.
- **Чому це проблема:** `quote` у тесті взагалі не викликається. Тест створює `mock.fn`, який
  повертає `total: 5000`, викликає його і перевіряє, що той повернув 5000 і був викликаний один раз.
  Тест пройде за будь-якого стану `src/tariff.js` і нічого не каже про реальну ціну.
  Через це він ще й вводить в оману, бо назва описує бізнес-правило.

*(Рядки 24, 51 і 89 — «30 min 20 s…», «reduced fare…», «return before the pickup…» — істотних запахів
не мають: там конкретні очікувані значення з посиланням на специфікацію. Дрібниця на рядку 55:
`fees[0]` залежить від порядку зборів у масиві.)*

---

## day-cap.test.js

### 9. `day-cap.test.js:5`, «charges recorded for a day reduce what is left of the cap»
- **Запахи:** слабка асерція (нерівність замість точного значення).
- **Чому це проблема:** `remaining(...) < DAY_CAP` пройде за будь-якого зменшення, навіть на 1 копійку,
  або якщо `record` віднімає неправильну суму. Очікувано: `30000 − 12000 = 18000`. Не перевіряється
  і межа ліміту: інший райдер або інша доба не повинні бути зачеплені.

### 10. `day-cap.test.js:11`, «the day of a ride is the date of its pickup»
- **Запахи:** нерепрезентативні тестові дані, які не відрізняють правильну реалізацію від неправильної
  (*Weak Test Data / Missing Boundary*), неточна назва.
- **Чому це проблема:** `dayKey` має повертати дату **за Києвом** (`src/day-cap.js:9` → `kyivTime`).
  Для `08:00Z` дата за UTC і за Києвом однакова, тож тест пройде і з наївною реалізацією
  `pickupAt.slice(0, 10)`. Потрібен випадок, де дати відрізняються, наприклад `2026-09-15T22:30:00Z`
  → `2026-09-16`. Назва «date of its pickup» не уточнює, в якому часовому поясі.

---

## receipt-format.test.js

### 11. `receipt-format.test.js:5`, «amounts are shown in hryvnias»
- **Запахи:** кілька незалежних перевірок в одному тесті (*Assertion Roulette / Eager Test*), хоч і в легкій формі.
- **Чому це проблема:** звичайна сума, розділювач тисяч і від'ємне значення — три різні правила.
  Після першого падіння решта не виконується, і не видно, скільки випадків зламано.
  Краще табличний тест або окремі тести з назвами.

### 12. `receipt-format.test.js:11`, «a receipt has a line for every item»
- **Запахи:** магічне число (*Magic Number*), слабка асерція (`includes`), перевірка лише частини результату.
- **Чому це проблема:** `lines.length === 5` не пояснює, звідки 5 (тривалість + нарахування + знижка + збір + підсумок).
  Перевірка `includes("185,00")` пройде, навіть якщо в рядку неправильна підпис-мітка або немає « грн».
  Решта рядків (мітки `Знижка: нічна` / `Збір: повернення поза зоною`, мінус перед знижкою, порядок)
  не перевіряється, хоча назва обіцяє «рядок для кожної позиції».

---

## server.test.js

### 13. `server.test.js:29`, «GET / serves the page and GET /api/health answers»
- **Запахи:** два сценарії в одному тесті (*Eager Test*), неповні асерції.
- **Чому це проблема:** два різні ендпоінти в одному тесті: якщо впаде `/`, `/api/health` не перевіриться,
  а назва з «and» уже вказує на дві поведінки. Для `/` не перевіряється, що тіло — це сторінка з `page()`
  (можна було б `assert.equal(page.body, "<!doctype html>…")`), а для `/api/health` не перевіряється статус 200.

### 14. `server.test.js:49`, «POST /api/quote answers 400 to a body that is not JSON»
- **Запахи:** слабка асерція на тіло помилки.
- **Чому це проблема:** `assert.ok(JSON.parse(res.body).error)` пройде з будь-яким непорожнім повідомленням,
  тож тест не відрізнить «not valid JSON» від, наприклад, помилки валідації поїздки. Це незначний запах:
  статус 400 перевірено.

*(Тест на рядку 38, «POST /api/quote returns the quote and the receipt», загалом нормальний. Варто лише зауважити,
що це фактично інтеграційний тест: він проходить через справжні `quote`, `zones` і `formatReceipt`,
тож у теці `unit/` він дублює інтеграційне покриття.)*

---

## Підсумок

| # | Файл:рядок | Тест | Основний запах |
|---|---|---|---|
| 1 | tariff.test.js:9 | quote returns an itemised price | Weak Assertion + Loop |
| 2 | tariff.test.js:31 | e-bikes are billed at the e-bike rate | Tautological (логіка SUT у тесті) |
| 3 | tariff.test.js:37 | subscribers ride the first 45 minutes free… | Conditional Test Logic |
| 4 | tariff.test.js:45 | subscription on a long e-bike ride | Weak Assertion / Unclear Name |
| 5 | tariff.test.js:58 | night rides get 30 % off | Weak Assertion |
| 6 | tariff.test.js:67 | …pays both fees | Weak Assertion (лише довжина) |
| 7 | tariff.test.js:72 | the daily cap limits the time charge | Always-Passing Assertion |
| 8 | tariff.test.js:82 | a 45-minute classic ride costs 50 UAH | Mocking the SUT |
| 9 | day-cap.test.js:5 | charges recorded… reduce what is left of the cap | Weak Assertion |
| 10 | day-cap.test.js:11 | the day of a ride is the date of its pickup | Нерепрезентативні дані |
| 11 | receipt-format.test.js:5 | amounts are shown in hryvnias | Assertion Roulette (легкий) |
| 12 | receipt-format.test.js:11 | a receipt has a line for every item | Magic Number + Weak Assertion |
| 13 | server.test.js:29 | GET / serves the page and GET /api/health answers | Eager Test |
| 14 | server.test.js:49 | POST /api/quote answers 400… | Weak Assertion (легкий) |

Найсерйозніші: **#8** (тест взагалі не викликає `quote`), **#7** (асерція не може впасти),
**#2** (очікування рахується тією ж формулою, що й у коді), а також **#1** і **#10**: ці тести
пройдуть навіть із неправильною реалізацією.
