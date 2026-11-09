- Tool and model: Codex desktop fresh subagent (fork_turns=none); inherited model, exact runtime model ID unavailable
- Date: 2026-11-09
- Session inputs: C:\Users\pc\AppData\Local\Temp/ws12-okedo-20261109/c-smells: current app after Task B source fixes and corrected baseline assertions, no participant notes/rules.
- Memory/global rules: fresh agent has no parent chat history; platform/system/developer instructions remain active; no participant rules were copied unless specified. Subagents have filesystem access, so isolation relies on explicit read scope plus separate directories, not OS access controls.
- Transport: parent specified temporary working directory and allowed files; Ukrainian experimental prompt below is verbatim.
- Prompt (verbatim):

> У цій теці — застосунок (app/): код у app/src/ і тести в app/test/.
> Знайди тестові «запахи» (test smells) у тестах app/test/unit/. Для кожного: файл:рядок,
> назва тесту, назва запаху і чому це проблема. Нічого не змінюй.
> Запиши відповідь у файл ai-runs/c-smells.md.
> Уточнювальних питань не став; працюй з тим, що є.

---

# Тестові запахи в `app/test/unit/`

| Файл:рядок | Назва тесту | Запах | Чому це проблема |
|---|---|---|---|
| `app/test/unit/day-cap.test.js:8` | `charges recorded for a day reduce what is left of the cap` | Слабкий оракул | Перевірка лише `< DAY_CAP` пропустить неправильне списання будь-якої додатної суми; після запису 12000 залишок має бути рівно 18000. |
| `app/test/unit/day-cap.test.js:12` | `the day of a ride is the date of its pickup` | Нерозрізнювальні тестові дані | О 08:00 UTC дата UTC і київська дата збігаються; реалізація через обрізання ISO-рядка теж пройде тест, хоча помилиться біля місцевої півночі. |
| `app/test/unit/receipt-format.test.js:19` | `a receipt has a line for every item` | Слабкий оракул | Кількість рядків і підрядок у фіналі не доводять, що надруковані правильні тривалість, нарахування, знижка, збір, їхні назви й суми; п'ять довільних рядків можуть пройти. |
| `app/test/unit/server.test.js:29` | `GET / serves the page and GET /api/health answers` | Кілька незалежних сценаріїв в одному тесті | Збій сторінки зупинить перевірку health endpoint і приховає його результат; назва збою не локалізує маршрут. |
| `app/test/unit/server.test.js:31` | `GET / serves the page and GET /api/health answers` | Неповний оракул HTTP-відповіді | Для сторінки не перевіряється тіло, а для health — статус і тип вмісту; порожня HTML-сторінка або health з помилковим статусом пройдуть ці перевірки. |
| `app/test/unit/tariff.test.js:17` | `quote returns an itemised price` | Слабкий оракул | Невід'ємний total, два масиви та числові minutes не підтверджують жодної правильної ціни або деталізації; константна нульова відповідь пройде всі три сценарії. |
| `app/test/unit/tariff.test.js:15` | `quote returns an itemised price` | Погана діагностика табличного тесту | Цикл не має підназв або повідомлень із вхідними даними; перший збій зупиняє решту сценаріїв, а звіт не показує, яка поїздка зламалася. |
| `app/test/unit/tariff.test.js:32` | `e-bikes are billed at the e-bike rate` | Оракул, залежний від реалізації | Очікування повторює формулу з production-константами `BLOCK_MINUTES`, `RATES.ebike` і фактично поверненим `result.minutes`; неправильний тариф, розмір блоку або кількість хвилин можуть узгоджено змінити обидві сторони. |
| `app/test/unit/tariff.test.js:45` | `subscription on a long e-bike ride` | Слабкий оракул | Наявність коду subscription та довільне зменшення суми пропускають неправильний відсоток і суму знижки. |
| `app/test/unit/tariff.test.js:61` | `night rides get 30 % off` | Назва сильніша за перевірку | Тест обіцяє 30 %, але перевіряє лише зменшення; знижка на одну копійку теж пройде, хоча для нарахування 2500 очікувані знижка 750 і total 1750. |
| `app/test/unit/tariff.test.js:66` | `a bike kept over a day and left outside the zone pays both fees` | Слабкий оракул колекції | Довжина 2 не перевіряє коди й суми зборів; два дублікати або довільні записи пройдуть тест. |
| `app/test/unit/tariff.test.js:76` | `the daily cap limits the time charge` | Нерозрізнювальний сценарій та слабкий оракул | Кожна 80-хвилинна поїздка на ebike коштує 12000, що вже менше DAY_CAP=30000; без накопичувального ліміту остання поїздка все одно пройде `<= DAY_CAP`, хоча після перших двох має коштувати 6000. |
| `app/test/unit/tariff.test.js:80` | `a 45-minute classic ride costs 50 UAH` | Підміна об'єкта тестування / тест мока | Замість `quote` викликається локальний `mock.fn`, який сам повертає 5000; перевірка доводить тільки задану поведінку мока і не виявить жодної помилки тарифу. |

Це спостереження за тестами та кодом у цій теці; відповідність зовнішній специфікації не перевірялася, код і тести не змінювалися.

