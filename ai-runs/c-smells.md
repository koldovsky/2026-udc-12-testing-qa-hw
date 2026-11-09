- Інструмент і модель: Claude Code (headless, `claude -p`), claude-sonnet-5-5 (типова модель)
- Дата: 2026-11-09
- Що бачила сесія: тимчасова тека ../ws12-c-smells: копія поточного `app/` (код у `app/src/`, тести в `app/test/`, у т.ч. `app/test/spec/`); без `docs/`, без файлу правил
- Що було ввімкнено з пам'яті й глобальних правил: auto-memory вимкнено (`CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`); ввімкнено `~/.claude/CLAUDE.md` (лише правила для git-комітів). Дозволені інструменти: `Read, Glob, Grep, Write(/ai-runs/**)`.
- Примітка: агент не зміг записати `ai-runs/c-smells.md` (Write і `mkdir` відхилено через права), тому видав відповідь у чаті; нижче — його фінальна відповідь (поле result у JSON-виводі `claude -p`) без змін, окрім цієї шапки.
- Промпт (дослівно):

  > У цій теці — застосунок (app/): код у app/src/ і тести в app/test/.
  > Знайди тестові «запахи» (test smells) у тестах app/test/unit/. Для кожного: файл:рядок,
  > назва тесту, назва запаху і чому це проблема. Нічого не змінюй.
  > Запиши відповідь у файл ai-runs/c-smells.md.
  > Уточнювальних питань не став; працюй з тим, що є.

---

Не вдалося записати `ai-runs/c-smells.md`: і `mkdir`, і `Write` у цю теку потребують дозволу, а ви його не надали. Файлу немає. Нижче весь результат у чаті. Ніщо в коді не змінювалося.

**Високий пріоритет**
1. `tariff.test.js:82`, «a 45-minute classic ride costs 50 UAH». **Testing the mock.** Тест викликає `mock.fn`, який сам повертає `5000`, і `quote` не викликається взагалі. Він не може впасти.
2. `tariff.test.js:72`, «the daily cap limits the time charge». **Tautological assertion.** Остання поїздка коштує 12000 коп. і без капа, тож `<= 30000` виконується завжди. Тест проходить без реалізації капа. Треба перевіряти `last.total === 6000` і запис `day-cap` у `discounts`.
3. `tariff.test.js:9`, «quote returns an itemised price». **Weak assertions, цикл у тесті, Assertion Roulette.** Перевіряється лише форма результату (`>= 0`, `Array.isArray`, `typeof`), а не ціна. З повідомлення про падіння не видно, на якій поїздці воно сталося.
4. `day-cap.test.js:5`, «charges recorded for a day reduce what is left of the cap». **Weak assertion.** Перевірка `< DAY_CAP` пройде для будь-якого зменшення, а очікується точно `18000`. Не перевірено ізоляцію за райдером і за днем, обмеження нулем та `chargedOn`.
5. `day-cap.test.js:11`, «the day of a ride is the date of its pickup». **Non-discriminating data.** Вхід `08:00Z` дає ту саму дату в UTC і в Києві, тож реалізація на UTC теж пройде. Потрібен вхід біля півночі, наприклад `2026-09-15T22:30:00Z` → `2026-09-16`.

**Середній пріоритет**
6. `tariff.test.js:31`, «e-bikes are billed at the e-bike rate». **Logic in test.** Очікуване значення рахується тією самою формулою, що й у коді (`Math.ceil(minutes/BLOCK_MINUTES)*RATES.ebike`). Треба літерал `12000`.
7. `tariff.test.js:38`, «subscribers ride the first 45 minutes … free; an e-bike gets 20 % off». **Цикл у тесті та Eager Test.** Два різні правила в одному тесті. Після першого падіння друге не виконується.
8. `tariff.test.js:45`, «subscription on a long e-bike ride». **Vague name та weak assertions.** `total < timeCharge` не фіксує розмір знижки, а очікується `12800`.
9. `tariff.test.js:58`, «night rides get 30 % off». **Weak assertion.** Сума знижки не перевіряється, а очікується `750` і `total === 1750`. Немає граничних випадків 05:59 і 06:00.
10. `tariff.test.js:67`, «a bike kept over a day and left outside the zone pays both fees». **Weak assertion.** Перевіряється лише `fees.length === 2`, без кодів, сум і `total`.
11. `receipt-format.test.js:11`, «a receipt has a line for every item». **Weak assertion і прив'язка до кількості рядків.** Не перевіряються підписи, знак мінус у знижці та порядок рядків. `includes("185,00")` теж слабке.
12. `server.test.js:29`, «GET / serves the page and GET /api/health answers». **Eager Test.** Два ендпоінти в одному тесті, тіло сторінки не перевіряється.

**Низький пріоритет**
13. `server.test.js:49`, «POST /api/quote answers 400 to a body that is not JSON». **Weak assertion.** `ok(error)` не відрізняє цю помилку від будь-якої іншої 400. Гілки 404, 500, завеликого body та `QuoteError` → 400 не покриті.
14. `tariff.test.js:89`, «a return before the pickup is rejected». **Unspecific exception assertion.** Приймається будь-який `QuoteError`, повідомлення не перевіряється.
15. `tariff.test.js:51` і `server.test.js:38`. **Mystery Guest.** Тести залежать від реальних станцій `S01`, `S03`, `X01`, `X03` із `zones.js`, хоча `zones` можна передати ін'єкцією. Літерал `"2026-09-16T07:00:00Z"` повторюється скрізь (Magic Literals).
16. `receipt-format.test.js:5`, «amounts are shown in hryvnias». **Кілька випадків у одному тесті.** Не покриті межі `0`, `99`, `-5`.

**Прогалини**
- `discount()` (округлення вниз) і `FREE_START_MINUTES` (поїздка до 2 хв) не мають окремих тестів.
- `reduced` разом із `subscriber`+`concession` (вибір вигіднішого плану) не перевіряється.
- Валідація входу в `readRide` і `readRider` покрита лише одним негативним тестом.

Дозвольте запис у `ai-runs/` або створіть теку самі, і я збережу цей текст у файл.
