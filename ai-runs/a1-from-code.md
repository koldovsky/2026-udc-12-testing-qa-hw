- Інструмент і модель: GitHub Copilot CLI 1.0.96, окремий sub-agent `general-purpose` (модель sub-agent'а — за замовчуванням harness; головна сесія — Claude Opus 5.5), запущений головним агентом як нова сесія без історії
- Дата: 2026-11-04
- Що бачила сесія: тимчасова тека `../ws12-a1` — лише `app/src/` з `main` (`git archive main app/src`)
- Що було ввімкнено з пам'яті й глобальних правил: не вимикалося. Sub-agent стартував із CLI, відкритого в репо, тож у його системному контексті могли бути `AGENTS.md` / `CLAUDE.md` репо й пам'ять Copilot. Вмісту `docs/`, `app/test/` та інших файлів поза тимчасовою текою він не отримував. До промпта додано одне службове речення (англійською) з робочою текою — див. нижче.
- Промпт (дослівно):

  > Your working directory for this task is /Users/sergii.osadchyi-external/IdeaProjects/udc-worksop/ws12-a1 (all relative paths below are relative to it). Do not read or access anything outside that directory.
  >
  > У цій теці — код сервісу, який рахує вартість поїздок велопрокату громади (app/src/).
  > Читай лише файли в app/src/.
  > Склади набір тест-кейсів для розрахунку вартості поїздки. Для кожного кейсу: ID; що
  > перевіряє; вхідні дані (усе, від чого залежить результат); очікуваний результат у
  > копійках; звідки взято це очікування.
  > Запиши відповідь у файл ai-runs/a1-from-code.md. Нічого іншого не створюй і не змінюй.
  > Уточнювальних питань не став; працюй з тим, що є.
- Примітка: агент сам викликав `quote()` з коду, щоб перевірити значення (так написано в його файлі). `npm run mutate` не запускав.

---

# A1. Тест-кейси розрахунку вартості поїздки — виведені з коду

Джерело: лише `app/src/` (`tariff.js`, `day-cap.js`, `kyiv-time.js`, `zones.js`; `server.js` і
`receipt.js` — лише для контексту). Специфікацію не читав, тому **кожне очікування нижче — це те,
що робить код, а не те, що мало б бути**. Значення перевірено прямим викликом `quote()` з коду.

## Від чого залежить результат (за кодом)

| Вхід | Де в коді | Вплив |
|---|---|---|
| `ride.pickupAt`, `ride.returnAt` (ISO 8601 з `Z`/зміщенням) | `tariff.js:31,70-72,128-135` | хвилини = `Math.round((return − pickup)/60 000)` |
| `ride.bike` (`classic` / `ebike`) | `tariff.js:18` | 2500 / 4000 коп. за блок 30 хв |
| `ride.returnStation` | `zones.js:3-15` | `X01–X03` = поза зоною → збір 15000 |
| `rider.type`, `rider.concession` | `tariff.js:89-98` | абонемент / пільга (обирається більша знижка) |
| година відправлення за Києвом | `tariff.js:50`, `kyiv-time.js` | `hour < 6` → нічна знижка 30 % |
| `options.dayCap` (журнал), `rider.id` | `tariff.js:56-61`, `day-cap.js` | денний ліміт 30000 на тарифну частину (ключ — **UTC-дата** відправлення) |
| `options.zones` | `tariff.js:40` | таблиця станцій (за замовчуванням `STATIONS`) |

Порядок обчислення (`tariff.js:44-66`): `timeCharge` → знижка плану (абонемент/пільга) → нічна
(лише якщо залишок > 0) → денний ліміт → збори (для плану `reduced` збори ×50 %) → `total`.
Округлення знижки: `discount(a,p) = a − floor(a·(100−p)/100)` (`tariff.js:101-103`).

Позначення: `P = 2026-09-16T07:00:00Z` (10:00 за Києвом, денний час); станція `S01` (у зоні),
якщо не сказано інше; `rider = {type:"standard"}`; без `dayCap`, якщо не сказано інше.
«+N хв» — `returnAt = pickupAt + N хв`.

## 1. Тривалість і базовий тариф (T3-подібна логіка)

| ID | Що перевіряє | Вхідні дані | Очікування (коп.) | Звідки |
|---|---|---|---|---|
| TC-01 | Нульова поїздка безкоштовна | classic, P → P | minutes 0, timeCharge 0, total **0** | `tariff.js:79` (`minutes < 2 → 0`) |
| TC-02 | Округлення хвилин вниз (1 хв 29 с → 1) — безкоштовний старт | classic, +1 хв 29 с | minutes 1, total **0** | `tariff.js:71` `Math.round`, `:79` |
| TC-03 | Округлення вгору (1 хв 30 с → 2) — вже платно | classic, +1 хв 30 с | minutes 2, total **2500** | `tariff.js:71,79-80` |
| TC-04 | Межа безкоштовного старту: рівно 2 хв | classic, +2 хв | total **2500** | `tariff.js:20,79` |
| TC-05 | Рівно один блок | classic, +30 хв | total **2500** | `tariff.js:75` `ceil(30/30)=1` |
| TC-06 | 30 хв 29 с → 30 хв, один блок | classic, +30 хв 29 с | minutes 30, total **2500** | `tariff.js:71,75` |
| TC-07 | 30 хв 30 с → 31 хв, два блоки | classic, +30 хв 30 с | minutes 31, total **5000** | `tariff.js:71,75` |
| TC-08 | Початок другого блоку | classic, +31 хв | total **5000** | `tariff.js:75` |
| TC-09 | Рівно два блоки | classic, +60 хв | total **5000** | `tariff.js:75` |
| TC-10 | Початок третього блоку | classic, +61 хв | total **7500** | `tariff.js:75` |
| TC-11 | Тариф е-велосипеда, 1 блок | ebike, +30 хв | total **4000** | `tariff.js:18` |
| TC-12 | Тариф е-велосипеда, 2 блоки | ebike, +31 хв | total **8000** | `tariff.js:18,75` |
| TC-13 | Безкоштовний старт діє і для ebike | ebike, +1 хв | total **0** | `tariff.js:79` |
| TC-14 | Час без секунд (`HH:MM`) приймається | classic, `2026-09-16T07:00Z` → `2026-09-16T07:31Z` | minutes 31, total **5000** | регулярка `tariff.js:31` |
| TC-15 | Мілісекунди враховуються в округленні | classic, `…07:00:00.500Z` → `…07:30:00.400Z` | minutes 30, total **2500** | `tariff.js:31,71` |
| TC-16 | Різні зміщення в pickup/return | `2026-09-16T10:00:00+03:00` → `2026-09-16T07:30:00Z` | minutes 30, total **2500** | `Date.parse`, `tariff.js:132` |

## 2. Абонемент (subscriber)

Ціна для абонента: `ceil(max(0, хв − 45)/30) × тариф`, для ebike ще −20 % (`tariff.js:83-86`);
знижка `subscription = timeCharge − ця ціна`.

| ID | Що перевіряє | Вхідні дані | Очікування (коп.) | Звідки |
|---|---|---|---|---|
| TC-20 | 45 безкоштовних хвилин — межа | subscriber, classic, +45 хв | timeCharge 5000, subscription 5000, total **0** | `tariff.js:21,84` |
| TC-21 | 46-та хвилина — один платний блок | subscriber, classic, +46 хв | timeCharge 5000, subscription 2500, total **2500** | `tariff.js:84` |
| TC-22 | Кінець першого платного блоку | subscriber, classic, +75 хв | timeCharge 7500, subscription 5000, total **2500** | `tariff.js:84` |
| TC-23 | Другий платний блок | subscriber, classic, +76 хв | timeCharge 7500, subscription 2500, total **5000** | `tariff.js:84` |
| TC-24 | ebike у межах 45 хв безкоштовно | subscriber, ebike, +30 хв | subscription 4000, total **0** | `tariff.js:84-85` |
| TC-25 | ebike −20 % на платну частину | subscriber, ebike, +46 хв | timeCharge 8000, subscription 4800, total **3200** | `tariff.js:22,85` |
| TC-26 | ebike, кілька платних блоків | subscriber, ebike, +120 хв | timeCharge 16000, subscription 6400, total **9600** | `tariff.js:85` (3·4000·0.8) |

## 3. Пільговий тариф (reduced) і абонент з пільгою (concession)

| ID | Що перевіряє | Вхідні дані | Очікування (коп.) | Звідки |
|---|---|---|---|---|
| TC-30 | Пільга −50 % | reduced, classic, +10 хв | reduced 1250, total **1250** | `tariff.js:23,95` |
| TC-31 | Пільга на ebike | reduced, ebike, +31 хв | timeCharge 8000, reduced 4000, total **4000** | `tariff.js:95` |
| TC-32 | Безкоштовний старт — знижки в списку немає | reduced, classic, +1 хв | discounts `[]`, total **0** | `tariff.js:47` (`amount > 0`) |
| TC-33 | Concession: абонемент вигідніший | subscriber + `concession:true`, classic, +30 хв | subscription 2500, total **0** | `tariff.js:89-97` |
| TC-34 | Concession: нічия (2500 = 2500) → перемагає абонемент | subscriber + concession, classic, +46 хв | discounts `[subscription 2500]`, total **2500** | `tariff.js:97` (строге `>`, перший план лишається) |
| TC-35 | Concession: пільга вигідніша | subscriber + concession, classic, +120 хв | timeCharge 10000, reduced 5000, total **5000** | `tariff.js:97` (5000 > 2500) |
| TC-36 | Concession лише при `=== true` | subscriber, `concession:"true"`, classic, +120 хв | лише subscription 2500, total **7500** | `tariff.js:94` |
| TC-37 | `concession` ігнорується для standard | standard, `concession:true`, classic, +120 хв | discounts `[]`, total **10000** | `tariff.js:94` |

## 4. Нічна знижка (за годиною відправлення у Києві)

| ID | Що перевіряє | Вхідні дані | Очікування (коп.) | Звідки |
|---|---|---|---|---|
| TC-40 | Ніч, літній час (UTC+3): 05:30 Київ | classic, `2026-09-16T02:30:00Z`, +20 хв | night 750, total **1750** | `tariff.js:24-25,50-51`, `kyiv-time.js` |
| TC-41 | Межа 06:00 Київ — вже не ніч | classic, `2026-09-16T03:00:00Z`, +20 хв | total **2500** | `tariff.js:50` (`hour < 6`) |
| TC-42 | Північ за Києвом (UTC — ще попередній день) | classic, `2026-09-15T21:00:00Z`, +20 хв | night 750, total **1750** | `kyiv-time.js` |
| TC-43 | 23:59 Київ — не ніч | classic, `2026-09-15T20:59:00Z`, +20 хв | total **2500** | `tariff.js:50` |
| TC-44 | Зимовий час (UTC+2): 05:30 Київ | classic, `2026-12-16T03:30:00Z`, +20 хв | night 750, total **1750** | `kyiv-time.js` (Europe/Kyiv) |
| TC-45 | Зимовий час: 06:00 Київ | classic, `2026-12-16T04:00:00Z`, +20 хв | total **2500** | `tariff.js:50` |
| TC-46 | Зміщення в рядку враховується | `2026-09-16T05:59:00+03:00` → `…06:19:00+03:00` | night 750, total **1750** | `tariff.js:132`, `kyiv-time.js` |
| TC-47 | Важить лише час відправлення (поїздка через 06:00) | classic, `02:50Z` → `03:50Z` (05:50–06:50 Київ) | timeCharge 5000, night 1500, total **3500** | `tariff.js:50` (`pickup`) |
| TC-48 | Нічна не додається, якщо після плану 0 | subscriber, classic, `02:00Z`, +30 хв | discounts лише `subscription`, total **0** | `tariff.js:50` (`due > 0`) |
| TC-49 | Нічна застосовується після пільги (послідовно) | reduced, ebike, `02:00Z`, +20 хв | reduced 2000, night 600, total **1400** | `tariff.js:48-53` |
| TC-50 | Нічна після абонементу ebike | subscriber, ebike, `02:00Z`, +46 хв | subscription 4800, night 960, total **2240** | `tariff.js:48-53` |

Примітка: з тарифами 2500/4000 правило округлення `floor` у `discount()` на реальних поїздках
дробових значень не дає (усі проміжні суми кратні 1250 / 800); перевірити його можна лише
юніт-тестом `discount()` напряму (напр. `discount(1001, 30)` → `1001 − floor(700.7) = 301`).

## 5. Денний ліміт без журналу (кожна поїздка окремо, ліміт 30000)

| ID | Що перевіряє | Вхідні дані | Очікування (коп.) | Звідки |
|---|---|---|---|---|
| TC-60 | Рівно ліміт — без запису `day-cap` | classic, +360 хв | timeCharge 30000, discounts `[]`, total **30000** | `day-cap.js:3`, `tariff.js:57` (`>`) |
| TC-61 | Ліміт +1 блок | classic, +361 хв | day-cap 2500, total **30000** | `tariff.js:56-60` |
| TC-62 | Ліміт для ebike | ebike, +240 хв | timeCharge 32000, day-cap 2000, total **30000** | `tariff.js:56-60` |
| TC-63 | Ліміт рахується після нічної | ebike, `2026-09-16T02:00:00Z`, +240 хв | night 9600, без day-cap, total **22400** | `tariff.js:50-60` (порядок) |

## 6. Збори (поза зоною, неповернений велосипед)

| ID | Що перевіряє | Вхідні дані | Очікування (коп.) | Звідки |
|---|---|---|---|---|
| TC-70 | Повернення поза зоною | classic, +10 хв, `X01` | out-of-zone 15000, total **17500** | `zones.js:12`, `tariff.js:26,107` |
| TC-71 | Збір і за безкоштовну поїздку | classic, +1 хв, `X03` | total **15000** | `tariff.js:107` (від хвилин не залежить) |
| TC-72 | Збір не зменшується абонементом | subscriber, classic, +30 хв, `X01` | total **15000** | `tariff.js:64` (лише `reduced`) |
| TC-73 | Збір ×50 % для пільгового | reduced, classic, +10 хв, `X02` | reduced 1250, out-of-zone 7500, total **8750** | `tariff.js:63-65` |
| TC-74 | Concession + нічия → план subscription → збір повний | subscriber + concession, classic, +46 хв, `X01` | subscription 2500, out-of-zone 15000, total **17500** | `tariff.js:64,97` |
| TC-75 | Concession + пільга перемогла → збір ×50 % | subscriber + concession, classic, +120 хв, `X01` | reduced 5000, out-of-zone 7500, total **12500** | `tariff.js:64` |
| TC-76 | Рівно 24 год — ще не «неповернений» | classic, +1440 хв | timeCharge 120000, day-cap 90000, total **30000** | `tariff.js:28,108` (`>`) |
| TC-77 | 24 год + 1 хв — збір 200000 | classic, +1441 хв | timeCharge 122500, day-cap 92500, unreturned 200000, total **230000** | `tariff.js:27,108` |
| TC-78 | Обидва збори | classic, +1441 хв, `X03` | out-of-zone 15000 + unreturned 200000, total **245000** | `tariff.js:105-110` |
| TC-79 | Неповернений, пільговий: збір ×50 %, ліміт після пільги | reduced, classic, +1441 хв | reduced 61250, day-cap 31250, unreturned 100000, total **130000** | `tariff.js:57-65` |
| TC-80 | Пільговий, обидва збори ×50 % | reduced, classic, +1441 хв, `X01` | out-of-zone 7500, unreturned 100000, total **137500** | `tariff.js:63-65` |
| TC-81 | Неповернений, абонент | subscriber, classic, +1441 хв | subscription 5000, day-cap 87500, unreturned 200000, total **230000** | `tariff.js:84,108` |

## 7. Денний ліміт із журналом (`dayCap: createDayCap()`, `rider.id`)

Кейси в групі виконуються послідовно з **одним** журналом.

| ID | Що перевіряє | Вхідні дані | Очікування (коп.) | Звідки |
|---|---|---|---|---|
| TC-90a | Перша поїздка вичерпує ліміт | r1, ebike, P, +240 хв | day-cap 2000, total **30000**; `chargedOn("r1","2026-09-16")` = 30000 | `tariff.js:56-61` |
| TC-90b | Наступна поїздка того ж дня — тарифна частина 0 | r1, classic, `2026-09-16T12:00:00Z`, +10 хв | day-cap 2500, total **0** | `day-cap.js:17-19` |
| TC-90c | Збори не покриваються лімітом | r1, classic, `…12:00:00Z`, +10 хв, `X01` | day-cap 2500, out-of-zone 15000, total **15000** | `tariff.js:61-66` (збори не записуються) |
| TC-90d | Інший райдер — окремий ліміт | r2, classic, `…12:00:00Z`, +10 хв | total **2500** | `day-cap.js:12` (ключ `id|день`) |
| TC-90e | Наступний день — ліміт знову повний | r1, classic, `2026-09-17T12:00:00Z`, +10 хв | total **2500** | `day-cap.js:6-8` |
| TC-91 | Часткове використання ліміту | r1: classic P +300 хв (25000), потім classic `2026-09-16T14:00:00Z` +180 хв | 1-ша **25000**; 2-га: day-cap 10000, total **5000** | `day-cap.js:18` |
| TC-92 | День ліміту — **UTC-дата**, не київська: поїздка о 01:30 Київ 17.09 (`2026-09-16T22:30:00Z`) зараховується в 16.09 | r1: classic P +300 хв (25000), потім classic `2026-09-16T22:30:00Z` +240 хв | 2-га: night 6000, day-cap 9000, total **5000**; `chargedOn("r1","2026-09-17")` = 0 | `day-cap.js:7` (`toISOString().slice(0,10)`) |
| TC-93 | Те саме з боку «київського вчора»: 23:30 і 00:30 Київ — один «день» | r1: classic `2026-09-16T20:30:00Z` +300 хв (25000), потім classic `2026-09-16T21:30:00Z` +180 хв | 2-га: night 4500, day-cap 5500, total **5000** | `day-cap.js:7` |
| TC-94 | У журнал пишеться сума після нічної | r1: ebike `2026-09-16T02:00:00Z` +300 хв, потім classic P +180 хв | 1-ша: timeCharge 40000, night 12000, total **28000** (записано 28000); 2-га: day-cap 13000, total **2000** | `tariff.js:61` |
| TC-95 | Власний ліміт журналу | `createDayCap({limit:10000})`, r1, classic, P, +180 хв | day-cap 5000, total **10000** | `day-cap.js:10` |
| TC-96 | Неповернений велосипед вичерпує ліміт дня, збір не записується | r1: classic P +1441 хв, потім classic `…12:00:00Z` +10 хв | 1-ша **230000**; 2-га: day-cap 2500, total **0** | `tariff.js:61-66` |

## 8. Помилки вхідних даних (`QuoteError`; через HTTP — 400)

| ID | Що перевіряє | Вхідні дані | Очікування | Звідки |
|---|---|---|---|---|
| TC-100 | Повернення раніше відправлення | P, returnAt = P − 1 хв | `QuoteError: returnAt is before pickupAt` | `tariff.js:116` |
| TC-101 | Невідомий тип велосипеда | bike `tandem` | `unknown bike type: tandem` | `tariff.js:117` |
| TC-102 | Невідома станція | returnStation `S99` | `unknown station: S99` | `tariff.js:118-119` |
| TC-103 | Невідомий тип райдера | rider `{type:"vip"}` | `unknown rider type: vip` | `tariff.js:124` |
| TC-104 | Немає райдера | rider `undefined` | `unknown rider type: undefined` | `tariff.js:124` |
| TC-105 | Час без зміщення | pickupAt `2026-09-16T07:00:00` | `pickupAt must be an ISO 8601 date-time with an offset` | `tariff.js:31,129` |
| TC-106 | Час — не рядок (число мс) | pickupAt `1789542000000` | те саме повідомлення | `tariff.js:129` |
| TC-107 | Неіснуючий місяць | `2026-13-01T10:00:00Z` | `pickupAt is not a valid date-time` | `tariff.js:132-133` |
| TC-108 | Журнал без `rider.id` | `dayCap` передано, rider `{type:"standard"}` | `rider.id is required with a daily cap ledger` | `tariff.js:125` |
| TC-109 | 30 лютого **не** відхиляється (V8 `Date.parse` приймає) | `2026-02-30T10:00:00Z` → `…10:10:00Z` | total **2500**, помилки немає | `tariff.js:132` — поведінка коду, ймовірно не задумана |

## Спостереження (місця, де код може розходитися з наміром — звірити зі специфікацією)

1. Денний ліміт рахується за **UTC-датою** (`day-cap.js:7`), а нічна знижка — за київським часом;
   «день» для ліміту зсунутий на 2–3 год від київської доби (TC-92, TC-93).
2. При нічиїй абонемент/пільга обирається абонемент, і тоді збори не зменшуються (TC-34, TC-74) —
   для райдера це різниця 7500 коп.
3. Хвилини округлюються `Math.round`, а не вгору/вниз (TC-02, TC-03, TC-06, TC-07).
4. Нічна знижка — лише за часом відправлення (TC-47).
5. Невалідні дати на кшталт 30 лютого проходять валідацію (TC-109).
6. Уся очікувана поведінка тут — «як у коді»; це регресійні, а не специфікаційні очікування.
