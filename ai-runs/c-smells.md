- Tool and model: Claude Code 2.1.301, `claude -p` (non-interactive), Claude Opus 5.5 (`claude-opus-5-5`). The session result also lists `claude-haiku-5-5` usage.
- Date: 2026-11-07
- What the session saw: temporary folder `../ws12-c-smells` with a copy of the current `app/` (branch `ws12/yuriislynko` at commit `6c85f02`) and nothing else. The tool log shows a `find` over `app/`, reads of the four files in `app/test/unit/`, `app/test/helpers/factory.js`, `app/package.json`, the six files in `app/src/`, the first 80 lines of `app/README.md` and a search for `factory|random` in `app/test/`.
- Enabled from memory and global rules: nothing. There is no `~/.claude/CLAUDE.md` and no `CLAUDE.md` or `AGENTS.md` in the parent folders. User settings (plugins, hooks) were not loaded (`--setting-sources project`), auto-memory was off, no MCP servers were loaded (`--strict-mcp-config`), skills were off (`--disable-slash-commands`). Only Claude Code's built-in plugins were present.
- How it ran: a new session with no history, started from the terminal by the participant's main agent session. Read, Glob, Grep and Write were allowed without approval. Read-only shell commands (`find`, `cat`) ran. Two compound commands were denied, one of them with `node --test`, so the session did not run the tests. It did not run `npm run mutate`. It wrote only `ai-runs/c-smells.md`: `diff -r app ../ws12-c-smells/app` showed no change. The text below the line is that file, unchanged.
- Prompt (verbatim):

  > У цій теці — застосунок (app/): код у app/src/ і тести в app/test/.
  > Знайди тестові «запахи» (test smells) у тестах app/test/unit/. Для кожного: файл:рядок,
  > назва тесту, назва запаху і чому це проблема. Нічого не змінюй.
  > Запиши відповідь у файл ai-runs/c-smells.md.
  > Уточнювальних питань не став; працюй з тим, що є.

---

# Тестові запахи в `app/test/unit/`

Переглянуто: `tariff.test.js`, `day-cap.test.js`, `receipt-format.test.js`, `server.test.js`
(разом із кодом у `app/src/`, щоб перевірити очікувані значення). Код і тести не змінювались.

Упорядковано за серйозністю: спершу тести, які пропускають реальні дефекти, потім ті, що
лише гірше діагностують помилки.

## Критичні: тест не здатен впасти або перевіряє не той код

| # | Файл:рядок | Тест | Запах | Чому це проблема |
|---|---|---|---|---|
| 1 | `app/test/unit/tariff.test.js:79` | «a 45-minute classic ride costs 50 UAH» | **Тестування мока** (Mock-only test / тест без SUT) | `priceRide` — це `mock.fn`, що повертає зашиті `total: 5000`. `quote` не викликається взагалі, тож тест перевіряє лише сам мок і пройде за будь-якого тарифу. Назва обіцяє перевірку ціни, якої насправді немає. |
| 2 | `app/test/unit/tariff.test.js:69` | «the daily cap limits the time charge» | **Тест, що не може впасти** (Always-passing / слабке твердження) + **цикл у тесті** | Три поїздки на е-байку по 80 хв коштують по 12 000 коп. Без ліміту остання все одно коштує 12 000 ≤ `DAY_CAP` (30 000), тож `last.total <= DAY_CAP` виконується **і з лімітом, і без нього**. Тест пропустить повністю зламаний денний ліміт. Мало б бути `last.total === 6000` і знижка `day-cap` на 6 000. Цикл з `let last` до того ж ховає перші дві поїздки від перевірок. |
| 3 | `app/test/unit/tariff.test.js:30` | «e-bikes are billed at the e-bike rate» | **Логіка в тесті / тавтологічне очікування** (Expected value mirrors implementation) | Очікуване значення рахується тією ж формулою, що й у `chargeFor` (`Math.ceil(minutes / BLOCK_MINUTES) * RATES.ebike`), і бере `minutes` з результату самого `quote`. Помилки в округленні блоків, підрахунку хвилин чи константах відтворюються в обох частинах порівняння, тож тест їх не бачить. Треба зашити 12 000 (75 хв → 3 блоки × 40 грн). |
| 4 | `app/test/unit/tariff.test.js:9` | «quote returns an itemised price» | **Слабкі твердження** (Weak/Lazy assertions) + **цикл у тесті** | Перевіряються лише типи полів і `total >= 0`. Повернення нулів чи будь-яких чисел пройде. Три різні поїздки (безкоштовний старт, 50 хв, е-байк 2 год 10 хв) проганяються в одному циклі без очікуваних цін, тож при падінні не видно, який випадок зламався. |

## Значні: слабкі або неповні твердження

| # | Файл:рядок | Тест | Запах | Чому це проблема |
|---|---|---|---|---|
| 5 | `app/test/unit/day-cap.test.js:5` | «charges recorded for a day reduce what is left of the cap» | **Слабке твердження** (нерівність замість точного значення) | `remaining(...) < DAY_CAP` пройде за будь-якого зменшення, наприклад якщо віднімається не та сума або ліміт подвоюється. Очікується рівно 18 000 (30 000 − 12 000). |
| 6 | `app/test/unit/day-cap.test.js:11` | «the day of a ride is the date of its pickup» | **Невдалі тестові дані** (не розрізняють правильну й хибну реалізацію) | `08:00Z` — це 11:00 за Києвом, і дата за UTC та за Києвом однакова. Реалізація з `toISOString().slice(0, 10)` (дата за UTC) теж пройде. Головне правило, київська доба, не перевірене: потрібен випадок на зразок `2026-09-16T22:30:00Z` → `2026-09-17`. |
| 7 | `app/test/unit/tariff.test.js:43` | «subscription on a long e-bike ride» | **Невиразна назва** + **слабкі твердження** | Назва не каже, яким має бути результат. Перевіряється лише, що знижка `subscription` є і `total < timeCharge`, тож будь-який розмір знижки пройде, зокрема з неправильним відсотком. Очікується `total` 12 800 (4 блоки × 40 грн − 20 %). |
| 8 | `app/test/unit/tariff.test.js:55` | «night rides get 30 % off» | **Слабке твердження на ключовій властивості** | `timeCharge` і код знижки перевірені точно, а саму суть тесту, 30 %, ні: `total < timeCharge` пройде і з 10 %, і з 90 %. Має бути `total === 1750` (або `discounts[0].amount === 750`). Крім того, без коментаря про Київ (`// 01:10–01:40`) не зрозуміло, чому це нічна поїздка, тобто час закодовано в UTC-рядку (магічні дані). |
| 9 | `app/test/unit/tariff.test.js:64` | «a bike kept over a day and left outside the zone pays both fees» | **Слабке твердження** (лише кількість) | `fees.length === 2` не каже, які саме збори нараховано і в якій сумі. Два однакові збори або збори з неправильними сумами (не 150 / 2 000 грн) пройдуть. Не перевірено й `total`. |
| 10 | `app/test/unit/receipt-format.test.js:11` | «a receipt has a line for every item» | **Слабкі твердження** + **магічне число** | `lines.length === 5` перевіряє тільки кількість рядків, не їхній вміст. Неправильні підписи (`LABELS`), знак знижки (−15,00) чи пропущена тривалість не будуть помічені. `5` не пояснено (тривалість + нарахування + 1 знижка + 1 збір + «До сплати»). `includes("185,00")` пройде й для «1 185,00» чи «-185,00». |

## Помірні: діагностика й структура

| # | Файл:рядок | Тест | Запах | Чому це проблема |
|---|---|---|---|---|
| 11 | `app/test/unit/tariff.test.js:36` | «subscribers ride the first 45 minutes free on a classic bike, an e-bike gets 20 % off» | **Цикл у тесті / кілька сценаріїв в одному тесті** (Eager test) + **межу не перевірено** | Два різні правила перевіряються в одному тесті через цикл. Якщо впаде, повідомлення не скаже, для якого велосипеда, а другий випадок після падіння першого вже не виконається. Назва говорить про «перші 45 хв», але поїздка триває 40 хв, тож саму межу 45/46 хв не перевірено: тест пройде, навіть якщо безкоштовних хвилин 40. |
| 12 | `app/test/unit/server.test.js:29` | «GET / serves the page and GET /api/health answers» | **Eager test** (два ендпоінти в одному тесті) | Якщо зламається `/`, перевірку `/api/health` уже не буде виконано, і причину падіння доведеться шукати. Для health не перевірено ні статус 200, ні `content-type`, лише тіло. |
| 13 | `app/test/unit/receipt-format.test.js:5` | «amounts are shown in hryvnias» | **Кілька незалежних випадків в одному тесті** (Assertion roulette, легка форма) | Три окремі випадки форматування (просте число, розділювач тисяч, від'ємне). Перше падіння приховує решту. Краще параметризовані окремі тести. `strict`-assert показує фактичне й очікуване значення, тож запах помірний. |
| 14 | `app/test/unit/tariff.test.js:49` | «reduced fare for a ride returned outside the zone» | **Mystery Guest** (неявна залежність від реальної таблиці станцій) | Що `X01` поза зоною, видно тільки з `src/zones.js`. Тест неявно покладається на справжній `stationZones`, хоча `quote` приймає `zones` саме для того, щоб тест міг явно задати свою таблицю. Якщо станцію перейменують, тест впаде з незрозумілою `QuoteError`. Те саме з `X03` у рядку 64. |

## Без суттєвих зауважень

- `tariff.test.js:24` «a ride of 30 min 20 s is billed as two blocks»: точні очікувані значення, межа блоку перевірена.
- `tariff.test.js:86` «a return before the pickup is rejected»: перевіряє тип помилки. За бажання можна додати перевірку повідомлення.
- `server.test.js:38`, `server.test.js:49`: прийнятні. Варто лише зауважити, що `:38` проганяє справжній `quote` і `formatReceipt`, тож це радше інтеграційний тест у теці `unit/`. `assert.ok(...error)` у `:49` не перевіряє текст помилки.

## Підсумок

Найважливіше виправити №1–3. Ці тести дають хибне відчуття покриття: денний ліміт (№2) і
ціна класичної поїздки на 45 хв (№1) фактично не тестуються, а тариф е-байка (№3) звіряється
сам із собою. Найчастіший запах загалом — слабкі твердження (`<`, `<=`, `length`, `ok`) там,
де результат детермінований і його можна перевірити точним значенням.
