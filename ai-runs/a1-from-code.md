- Інструмент і модель: Claude Code (розширення VS Code, версія 2.1.318), Claude Opus 5.5 (`claude-opus-5-5`)
- Дата: 2026-11-05
- Що бачила сесія: тимчасова тека `../ws12-a1` з копією `app/src/`; агент читав лише файли `app/src/` і запускав їх через Node
- Що було ввімкнено з пам'яті й глобальних правил: записів і файлів правил не було. Функція пам'яті Claude Code була ввімкнена, але тека пам'яті сесії (`~/.claude/projects/c--Users-pikachu-UDC-task-12-ws12-a1/memory`) порожня. У журналі сесії немає вмісту жодного `CLAUDE.md` / `AGENTS.md`, і таких файлів у `~/.claude`, домашній теці, `UDC` і `task_12` немає. Під час прогону цього не записали, перевірено пізніше, 2026-11-06

- Промпт (дослівно):

  > У цій теці — код сервісу, який рахує вартість поїздок велопрокату громади (app/src/).
  > Читай лише файли в app/src/.
  > Склади набір тест-кейсів для розрахунку вартості поїздки. Для кожного кейсу: ID; що
  > перевіряє; вхідні дані (усе, від чого залежить результат); очікуваний результат у
  > копійках; звідки взято це очікування.
  > Запиши відповідь у файл ai-runs/a1-from-code.md. Нічого іншого не створюй і не змінюй.
  > Уточнювальних питань не став; працюй з тим, що є.

---

# Тест-кейси розрахунку вартості поїздки (виведені з коду)

**Обмеження цього набору.** Усі очікування взято з коду в `app/src/`, бо читати дозволено лише його. Коментарі в коді посилаються на правила в `docs/spec/tariffs.md` (T3, T6, T9), але цей файл не читали. Тому набір фіксує **поточну поведінку** сервісу: він ловить регресії, але не доводить, що тариф порахований правильно. Якщо код помиляється, кейс повторює цю помилку.

**Перевірка.** Значення порахували вручну за кодом, потім запустили 130 кейсів проти коду (Node 24.18, часові пояси America/New_York та Asia/Tokyo). Збіглися всі. Це підтверджує лише правильність прочитання коду.

## Що звірити зі специфікацією насамперед

16 кейсів позначено ⚠: значення точно відтворює код, але код викликає сумнів або не пояснює намір. Якщо специфікація каже інакше, правильним буде інше очікування.

| Поведінка коду | Чому сумнівно | Кейси |
|---|---|---|
| API не передає журнал у `quote` (`server.js:33`) | Через API ліміт діє на кожну поїздку окремо: той самий райдер платить 60000 за день. У `server.js` журнал не створюється взагалі | HT-02 |
| Доба для ліміту — UTC, а ніч — за Києвом (`day-cap.js:7`, `tariff.js:50`) | Межа доби для ліміту припадає на 02:00 або 03:00 за Києвом, тому поїздки різних київських діб ділять ліміт, а однієї — ні | LG-08, LG-09 |
| Пільговик без нарахування за час платить збір повністю (`tariff.js:47`, `tariff.js:64`) | Коротша поїздка коштує дорожче: 1 хв — 15000, 2 хв — 8750 | FE-05, FE-06 |
| Абонент із пільгою: план обирається без урахування зборів (`tariff.js:46`, `tariff.js:64`) | Коментар `tariff.js:88` обіцяє варіант, де платити менше, але підсумок буває вищим: 15000 проти 8750, 20000 проти 12500 | FE-07, FE-08 |
| `quote` записує поїздку в журнал щоразу (`tariff.js:61`) | Повторний розрахунок тієї самої поїздки дає іншу суму | LG-15 |
| Хвилини округлюються до найближчої, а не вгору (`tariff.js:71`) | Межі зсуваються на 30 с: 1:29 безкоштовно, 30:29 — один блок, 24:00:29 — без збору. У коді немає пояснення, чи так задумано | TM-02, TM-03, TM-06, TM-07, SB-04, SB-05, UR-02, UR-03 |
| Неіснуюча дата 30 лютого приймається (`tariff.js:132-133`) | Перевірка формату її пропускає, а `Date.parse` у Node переносить на 2 березня замість помилки | TM-16 |

## Як читати

- **Виклик:** `quote(ride, rider, { zones, dayCap })` з `tariff.js`. Усі суми — у копійках, усі рядки наведено повністю.
- **`dayCap=немає`:** журнал не передано, ліміт 30000 діє лише на цю поїздку.
- **`zones`:** якщо не вказано, це `stationZones` (`zones.js`): S01–S08 — зона `in`, X01–X03 — зона `out`.
- **Константи коду:** classic 2500 і ebike 4000 за блок, блок 30 хв, безкоштовний старт 2 хв, абонемент 45 хв і −20 % на ebike, пільга −50 %, ніч −30 % до 06:00, ліміт 30000, збори 15000 і 200000, поріг неповернення 1440 хв.
- **Джерело:** посилання на рядки файлів у `app/src/`. Слово «коментар» означає, що очікування прямо сказане в коментарі; інакше воно виведене з логіки коду.

## 1. Тривалість і блоки (без знижок)

Стандартний тариф удень. Хвилини округлюються до найближчої, далі кожні початі 30 хв — один блок.

| ID | Що перевіряє | Вхідні дані | Очікуваний результат (коп.) | Звідки взято |
|---|---|---|---|---|
| TM-01 | Нульова поїздка безкоштовна | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:00:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=0**<br>minutes=0; timeCharge=0<br>discounts: —<br>fees: — | `tariff.js:79` |
| ⚠ TM-02 | 1:29 округлюється до 1 хв і лишається в безкоштовному старті | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:01:29+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=0**<br>minutes=1; timeCharge=0<br>discounts: —<br>fees: — | `tariff.js:71`, `tariff.js:79` |
| ⚠ TM-03 | 1:30 округлюється до 2 хв, безкоштовний старт закінчився | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:01:30+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=2500**<br>minutes=2; timeCharge=2500<br>discounts: —<br>fees: — | `tariff.js:71`, `tariff.js:79-80` |
| TM-04 | Рівно 2 хв — це вже один повний блок | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:02:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=2500**<br>minutes=2; timeCharge=2500<br>discounts: —<br>fees: — | `tariff.js:20`, `tariff.js:79-80` |
| TM-05 | Рівно 30 хв — один блок | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:30:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=2500**<br>minutes=30; timeCharge=2500<br>discounts: —<br>fees: — | `tariff.js:75`, `tariff.js:80` |
| ⚠ TM-06 | 30:29 округлюється до 30 хв — один блок | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:30:29+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=2500**<br>minutes=30; timeCharge=2500<br>discounts: —<br>fees: — | `tariff.js:71`, `tariff.js:75` |
| ⚠ TM-07 | 30:30 округлюється до 31 хв — два блоки | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:30:30+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=5000**<br>minutes=31; timeCharge=5000<br>discounts: —<br>fees: — | `tariff.js:71`, `tariff.js:75` |
| TM-08 | Рівно 60 хв — два блоки | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T11:00:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=5000**<br>minutes=60; timeCharge=5000<br>discounts: —<br>fees: — | `tariff.js:75`, `tariff.js:80` |
| TM-09 | 61 хв — три блоки | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T11:01:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=7500**<br>minutes=61; timeCharge=7500<br>discounts: —<br>fees: — | `tariff.js:75`, `tariff.js:80` |
| TM-10 | Електровелосипед: безкоштовний старт діє так само | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:01:00+02:00`<br>`bike=ebike, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=0**<br>minutes=1; timeCharge=0<br>discounts: —<br>fees: — | `tariff.js:79` |
| TM-11 | Електровелосипед: один блок | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:30:00+02:00`<br>`bike=ebike, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=4000**<br>minutes=30; timeCharge=4000<br>discounts: —<br>fees: — | `tariff.js:18`, `tariff.js:80` |
| TM-12 | Електровелосипед: 31 хв — два блоки | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:31:00+02:00`<br>`bike=ebike, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=8000**<br>minutes=31; timeCharge=8000<br>discounts: —<br>fees: — | `tariff.js:18`, `tariff.js:75` |
| TM-13 | Тривалість рахується між миттєвостями, а не за цифрами годинника: різні зміщення | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T08:30:00Z`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=2500**<br>minutes=30; timeCharge=2500<br>discounts: —<br>fees: — | `tariff.js:71`, `tariff.js:132` |
| TM-14 | Час без секунд приймається | `pickupAt=2026-01-15T10:00+02:00`<br>`returnAt=2026-01-15T10:20+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=2500**<br>minutes=20; timeCharge=2500<br>discounts: —<br>fees: — | `tariff.js:31` |
| TM-15 | Дробові секунди враховуються при округленні (89,999 с → 1 хв) | `pickupAt=2026-01-15T08:00:00.000Z`<br>`returnAt=2026-01-15T08:01:29.999Z`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=0**<br>minutes=1; timeCharge=0<br>discounts: —<br>fees: — | `tariff.js:31`, `tariff.js:71` |
| ⚠ TM-16 | Неіснуюча дата 30 лютого не відхиляється: V8 переносить її на 2 березня | `pickupAt=2026-02-30T10:00:00Z`<br>`returnAt=2026-03-02T10:20:00Z`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=2500**<br>minutes=20; timeCharge=2500<br>discounts: —<br>fees: — | `tariff.js:132-133`; поведінка `Date.parse` у Node 24 |

## 2. Абонемент

Перші 45 хв безкоштовні, решта — блоками; на електровелосипед ще −20 %.

| ID | Що перевіряє | Вхідні дані | Очікуваний результат (коп.) | Звідки взято |
|---|---|---|---|---|
| SB-01 | Безкоштовний старт: нарахування нуль, знижки в чеку немає | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:01:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"subscriber"}`<br>`dayCap=немає` | **total=0**<br>minutes=1; timeCharge=0<br>discounts: —<br>fees: — | `tariff.js:47`, `tariff.js:79`, `tariff.js:84` |
| SB-02 | 2 хв повністю покриті абонементом | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:02:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"subscriber"}`<br>`dayCap=немає` | **total=0**<br>minutes=2; timeCharge=2500<br>discounts: subscription 2500<br>fees: — | `tariff.js:21`, `tariff.js:84`, `tariff.js:92` |
| SB-03 | Рівно 45 хв — усе ще безкоштовно | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:45:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"subscriber"}`<br>`dayCap=немає` | **total=0**<br>minutes=45; timeCharge=5000<br>discounts: subscription 5000<br>fees: — | `tariff.js:21`, `tariff.js:84` |
| ⚠ SB-04 | 45:29 округлюється до 45 хв — безкоштовно | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:45:29+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"subscriber"}`<br>`dayCap=немає` | **total=0**<br>minutes=45; timeCharge=5000<br>discounts: subscription 5000<br>fees: — | `tariff.js:71`, `tariff.js:84` |
| ⚠ SB-05 | 45:30 округлюється до 46 хв — один платний блок | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:45:30+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"subscriber"}`<br>`dayCap=немає` | **total=2500**<br>minutes=46; timeCharge=5000<br>discounts: subscription 2500<br>fees: — | `tariff.js:71`, `tariff.js:84` |
| SB-06 | 75 хв: 30 платних хв — один блок | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T11:15:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"subscriber"}`<br>`dayCap=немає` | **total=2500**<br>minutes=75; timeCharge=7500<br>discounts: subscription 5000<br>fees: — | `tariff.js:84`, `tariff.js:92` |
| SB-07 | 76 хв: 31 платна хв — два блоки | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T11:16:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"subscriber"}`<br>`dayCap=немає` | **total=5000**<br>minutes=76; timeCharge=7500<br>discounts: subscription 2500<br>fees: — | `tariff.js:84`, `tariff.js:92` |
| SB-08 | Електровелосипед, 45 хв — безкоштовно | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:45:00+02:00`<br>`bike=ebike, returnStation=S01`<br>`rider={"type":"subscriber"}`<br>`dayCap=немає` | **total=0**<br>minutes=45; timeCharge=8000<br>discounts: subscription 8000<br>fees: — | `tariff.js:84-85`, `tariff.js:92` |
| SB-09 | Електровелосипед, 46 хв: блок 4000 мінус 20 % | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:46:00+02:00`<br>`bike=ebike, returnStation=S01`<br>`rider={"type":"subscriber"}`<br>`dayCap=немає` | **total=3200**<br>minutes=46; timeCharge=8000<br>discounts: subscription 4800<br>fees: — | `tariff.js:22`, `tariff.js:84-85` |
| SB-10 | Електровелосипед, 76 хв: два блоки 8000 мінус 20 % | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T11:16:00+02:00`<br>`bike=ebike, returnStation=S01`<br>`rider={"type":"subscriber"}`<br>`dayCap=немає` | **total=6400**<br>minutes=76; timeCharge=12000<br>discounts: subscription 5600<br>fees: — | `tariff.js:22`, `tariff.js:84-85` |

## 3. Пільговий тариф і вибір плану

Абонент із `concession: true` отримує дешевший із двох планів. При рівності лишається абонемент, бо порівняння строге.

| ID | Що перевіряє | Вхідні дані | Очікуваний результат (коп.) | Звідки взято |
|---|---|---|---|---|
| RD-01 | Пільговий: −50 % на класичний | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:20:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"reduced"}`<br>`dayCap=немає` | **total=1250**<br>minutes=20; timeCharge=2500<br>discounts: reduced 1250<br>fees: — | `tariff.js:23`, `tariff.js:94-95` |
| RD-02 | Пільговий: −50 % на електровелосипед | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:31:00+02:00`<br>`bike=ebike, returnStation=S01`<br>`rider={"type":"reduced"}`<br>`dayCap=немає` | **total=4000**<br>minutes=31; timeCharge=8000<br>discounts: reduced 4000<br>fees: — | `tariff.js:23`, `tariff.js:94-95` |
| RD-03 | Пільговий, безкоштовний старт: знижки в чеку немає | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:01:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"reduced"}`<br>`dayCap=немає` | **total=0**<br>minutes=1; timeCharge=0<br>discounts: —<br>fees: — | `tariff.js:47`, `tariff.js:79` |
| RD-04 | `concession` у стандартного тарифу ігнорується | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:20:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard","concession":true}`<br>`dayCap=немає` | **total=2500**<br>minutes=20; timeCharge=2500<br>discounts: —<br>fees: — | `tariff.js:94` |
| CN-01 | Абонемент вигідніший: 20 хв | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:20:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"subscriber","concession":true}`<br>`dayCap=немає` | **total=0**<br>minutes=20; timeCharge=2500<br>discounts: subscription 2500<br>fees: — | коментар `tariff.js:88`; `tariff.js:97` |
| CN-02 | Пільговий вигідніший: 200 хв, класичний | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T13:20:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"subscriber","concession":true}`<br>`dayCap=немає` | **total=8750**<br>minutes=200; timeCharge=17500<br>discounts: reduced 8750<br>fees: — | коментар `tariff.js:88`; `tariff.js:97` |
| CN-03 | Рівні знижки (100 хв): обирається абонемент | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T11:40:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"subscriber","concession":true}`<br>`dayCap=немає` | **total=5000**<br>minutes=100; timeCharge=10000<br>discounts: subscription 5000<br>fees: — | `tariff.js:91-97`, строге `>` у `tariff.js:97` |
| CN-04 | Пільговий вигідніший: 300 хв, електровелосипед | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T15:00:00+02:00`<br>`bike=ebike, returnStation=S01`<br>`rider={"type":"subscriber","concession":true}`<br>`dayCap=немає` | **total=20000**<br>minutes=300; timeCharge=40000<br>discounts: reduced 20000<br>fees: — | коментар `tariff.js:88`; `tariff.js:97` |
| CN-05 | `concession: false`: лише абонемент, навіть коли пільговий дешевший | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T13:20:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"subscriber","concession":false}`<br>`dayCap=немає` | **total=15000**<br>minutes=200; timeCharge=17500<br>discounts: subscription 2500<br>fees: — | `tariff.js:94` |
| CN-06 | `concession: "true"` (рядок) не вважається правом на пільгу | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T13:20:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"subscriber","concession":"true"}`<br>`dayCap=немає` | **total=15000**<br>minutes=200; timeCharge=17500<br>discounts: subscription 2500<br>fees: — | `tariff.js:94`, `=== true` |

## 4. Нічна знижка

−30 % на залишок після знижки плану. Вирішує лише година `pickupAt` за київським часом: менше 6 — ніч.

| ID | Що перевіряє | Вхідні дані | Очікуваний результат (коп.) | Звідки взято |
|---|---|---|---|---|
| NT-01 | 05:59 за Києвом — ніч | `pickupAt=2026-01-15T05:59:00+02:00`<br>`returnAt=2026-01-15T06:19:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=1750**<br>minutes=20; timeCharge=2500<br>discounts: night 750<br>fees: — | `tariff.js:24-25`, `tariff.js:50-53` |
| NT-02 | 06:00 за Києвом — вже не ніч | `pickupAt=2026-01-15T06:00:00+02:00`<br>`returnAt=2026-01-15T06:20:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=2500**<br>minutes=20; timeCharge=2500<br>discounts: —<br>fees: — | `tariff.js:25`, `tariff.js:50` |
| NT-03 | 00:00 за Києвом — ніч | `pickupAt=2026-01-15T00:00:00+02:00`<br>`returnAt=2026-01-15T00:20:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=1750**<br>minutes=20; timeCharge=2500<br>discounts: night 750<br>fees: — | `tariff.js:50`, `kyiv-time.js:10` |
| NT-04 | Старт 23:50, повернення 00:10: ніч не застосовується | `pickupAt=2026-01-15T23:50:00+02:00`<br>`returnAt=2026-01-16T00:10:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=2500**<br>minutes=20; timeCharge=2500<br>discounts: —<br>fees: — | `tariff.js:50` |
| NT-05 | Взимку 03:00Z = 05:00 за Києвом — ніч | `pickupAt=2026-01-15T03:00:00Z`<br>`returnAt=2026-01-15T03:20:00Z`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=1750**<br>minutes=20; timeCharge=2500<br>discounts: night 750<br>fees: — | `kyiv-time.js:4`, `tariff.js:50` |
| NT-06 | Влітку 03:00Z = 06:00 за Києвом — не ніч | `pickupAt=2026-07-15T03:00:00Z`<br>`returnAt=2026-07-15T03:20:00Z`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=2500**<br>minutes=20; timeCharge=2500<br>discounts: —<br>fees: — | `kyiv-time.js:4`, `tariff.js:50` |
| NT-07 | Влітку 02:59Z = 05:59 за Києвом — ніч | `pickupAt=2026-07-15T02:59:00Z`<br>`returnAt=2026-07-15T03:19:00Z`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=1750**<br>minutes=20; timeCharge=2500<br>discounts: night 750<br>fees: — | `kyiv-time.js:4`, `tariff.js:50` |
| NT-08 | Старт уночі, кінець удень: знижка на всю поїздку | `pickupAt=2026-01-15T05:50:00+02:00`<br>`returnAt=2026-01-15T07:00:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=5250**<br>minutes=70; timeCharge=7500<br>discounts: night 2250<br>fees: — | `tariff.js:50-53` |
| NT-09 | Абонемент + ніч: відсоток рахується від залишку | `pickupAt=2026-01-15T02:00:00+02:00`<br>`returnAt=2026-01-15T02:46:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"subscriber"}`<br>`dayCap=немає` | **total=1750**<br>minutes=46; timeCharge=5000<br>discounts: subscription 2500, night 750<br>fees: — | `tariff.js:48-53` |
| NT-10 | Пільговий + ніч: відсоток рахується від залишку | `pickupAt=2026-01-15T02:00:00+02:00`<br>`returnAt=2026-01-15T02:20:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"reduced"}`<br>`dayCap=немає` | **total=875**<br>minutes=20; timeCharge=2500<br>discounts: reduced 1250, night 375<br>fees: — | `tariff.js:48-53` |
| NT-11 | Абонемент покрив усе: нічної позиції в чеку немає | `pickupAt=2026-01-15T02:00:00+02:00`<br>`returnAt=2026-01-15T02:20:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"subscriber"}`<br>`dayCap=немає` | **total=0**<br>minutes=20; timeCharge=2500<br>discounts: subscription 2500<br>fees: — | `tariff.js:50`, `due > 0` |
| NT-12 | Безкоштовний старт уночі: нічної позиції в чеку немає | `pickupAt=2026-01-15T02:00:00+02:00`<br>`returnAt=2026-01-15T02:01:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=0**<br>minutes=1; timeCharge=0<br>discounts: —<br>fees: — | `tariff.js:50`, `due > 0` |
| NT-13 | Перехід на літній час (годинник стрибає вперед): реально минуло 60 хв | `pickupAt=2026-03-29T02:30:00+02:00`<br>`returnAt=2026-03-29T04:30:00+03:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=3500**<br>minutes=60; timeCharge=5000<br>discounts: night 1500<br>fees: — | `tariff.js:71`, `kyiv-time.js:4` |
| NT-14 | Перехід на зимовий час (годинник повертається): реально минуло 120 хв | `pickupAt=2026-10-25T02:30:00+03:00`<br>`returnAt=2026-10-25T03:30:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=7000**<br>minutes=120; timeCharge=10000<br>discounts: night 3000<br>fees: — | `tariff.js:71`, `kyiv-time.js:4` |
| NT-15 | Вирішує київський час, а не зміщення у вхідному рядку: 10:00+09:00 = 03:00 за Києвом | `pickupAt=2026-01-15T10:00:00+09:00`<br>`returnAt=2026-01-15T10:20:00+09:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=1750**<br>minutes=20; timeCharge=2500<br>discounts: night 750<br>fees: — | коментар `kyiv-time.js:1`; `kyiv-time.js:14-16` |

## 5. Денний ліміт без журналу

Без `dayCap` ліміт 30000 застосовується до однієї поїздки. Він обмежує залишок після всіх інших знижок.

| ID | Що перевіряє | Вхідні дані | Очікуваний результат (коп.) | Звідки взято |
|---|---|---|---|---|
| CP-01 | Рівно ліміт: 12 блоків, позиції day-cap немає | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T16:00:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=30000**<br>minutes=360; timeCharge=30000<br>discounts: —<br>fees: — | `day-cap.js:3`, `tariff.js:56-57` |
| CP-02 | Перевищення на один блок | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T16:01:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=30000**<br>minutes=361; timeCharge=32500<br>discounts: day-cap 2500<br>fees: — | `day-cap.js:3`, `tariff.js:56-60` |
| CP-03 | Електровелосипед під лімітом: 7 блоків | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T13:30:00+02:00`<br>`bike=ebike, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=28000**<br>minutes=210; timeCharge=28000<br>discounts: —<br>fees: — | `tariff.js:57` |
| CP-04 | Електровелосипед над лімітом: 8 блоків | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T13:31:00+02:00`<br>`bike=ebike, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=30000**<br>minutes=211; timeCharge=32000<br>discounts: day-cap 2000<br>fees: — | `tariff.js:57-60` |
| CP-05 | Ніч: тариф вищий за ліміт, але залишок нижчий — ліміт не спрацьовує | `pickupAt=2026-01-15T01:00:00+02:00`<br>`returnAt=2026-01-15T09:30:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=29750**<br>minutes=510; timeCharge=42500<br>discounts: night 12750<br>fees: — | порядок у `tariff.js:50-60` |
| CP-06 | Ніч: залишок вищий за ліміт — day-cap лише на різницю | `pickupAt=2026-01-15T01:00:00+02:00`<br>`returnAt=2026-01-15T10:00:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=30000**<br>minutes=540; timeCharge=45000<br>discounts: night 13500, day-cap 1500<br>fees: — | порядок у `tariff.js:50-60` |
| CP-07 | Пільговий: залишок рівно на ліміті | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T22:00:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"reduced"}`<br>`dayCap=немає` | **total=30000**<br>minutes=720; timeCharge=60000<br>discounts: reduced 30000<br>fees: — | порядок у `tariff.js:46-60` |
| CP-08 | Пільговий: залишок над лімітом | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T22:30:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"reduced"}`<br>`dayCap=немає` | **total=30000**<br>minutes=750; timeCharge=62500<br>discounts: reduced 31250, day-cap 1250<br>fees: — | порядок у `tariff.js:46-60` |
| CP-09 | Абонемент над лімітом | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-16T02:40:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"subscriber"}`<br>`dayCap=немає` | **total=30000**<br>minutes=1000; timeCharge=85000<br>discounts: subscription 5000, day-cap 50000<br>fees: — | порядок у `tariff.js:46-60` |

## 6. Денний ліміт із журналом

Журнал (`createDayCap`) накопичує суму до сплати за час окремо для кожної пари «райдер + доба». Доба — це UTC-дата `pickupAt`.

| ID | Що перевіряє | Вхідні дані | Очікуваний результат (коп.) | Звідки взято |
|---|---|---|---|---|
| LG-01 | Порожній журнал: поїздка записується | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T16:00:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard","id":"r1"}`<br>`dayCap=createDayCap()` | **total=30000**<br>minutes=360; timeCharge=30000<br>discounts: —<br>fees: —<br>після: chargedOn("r1","2026-01-15")=30000 | `tariff.js:56`, `tariff.js:61`, `day-cap.js:20-23` |
| LG-02 | Лишилося 10000: стягується лише залишок | `pickupAt=2026-01-15T14:00:00+02:00`<br>`returnAt=2026-01-15T18:00:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard","id":"r1"}`<br>`dayCap=createDayCap() → record("r1","2026-01-15T10:00:00+02:00",20000)` | **total=10000**<br>minutes=240; timeCharge=20000<br>discounts: day-cap 10000<br>fees: —<br>після: chargedOn("r1","2026-01-15")=30000 | `day-cap.js:17-19`, `tariff.js:57-60` |
| LG-03 | Ліміт вичерпано: до сплати нуль | `pickupAt=2026-01-15T14:00:00+02:00`<br>`returnAt=2026-01-15T14:20:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard","id":"r1"}`<br>`dayCap=createDayCap() → record("r1","2026-01-15T10:00:00+02:00",30000)` | **total=0**<br>minutes=20; timeCharge=2500<br>discounts: day-cap 2500<br>fees: —<br>після: chargedOn("r1","2026-01-15")=30000 | `day-cap.js:18`, `tariff.js:57-60` |
| LG-04 | Лишилася 1 копійка | `pickupAt=2026-01-15T14:00:00+02:00`<br>`returnAt=2026-01-15T14:20:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard","id":"r1"}`<br>`dayCap=createDayCap() → record("r1","2026-01-15T10:00:00+02:00",29999)` | **total=1**<br>minutes=20; timeCharge=2500<br>discounts: day-cap 2499<br>fees: —<br>після: chargedOn("r1","2026-01-15")=30000 | `day-cap.js:18`, `tariff.js:57-60` |
| LG-05 | Журнал вже понад ліміт: залишок не йде в мінус | `pickupAt=2026-01-15T14:00:00+02:00`<br>`returnAt=2026-01-15T14:20:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard","id":"r1"}`<br>`dayCap=createDayCap() → record("r1","2026-01-15T10:00:00+02:00",35000)` | **total=0**<br>minutes=20; timeCharge=2500<br>discounts: day-cap 2500<br>fees: —<br>після: chargedOn("r1","2026-01-15")=35000 | `Math.max` у `day-cap.js:18` |
| LG-06 | Інший райдер не впливає | `pickupAt=2026-01-15T14:00:00+02:00`<br>`returnAt=2026-01-15T14:20:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard","id":"r1"}`<br>`dayCap=createDayCap() → record("r2","2026-01-15T10:00:00+02:00",30000)` | **total=2500**<br>minutes=20; timeCharge=2500<br>discounts: —<br>fees: —<br>після: chargedOn("r1","2026-01-15")=2500, chargedOn("r2","2026-01-15")=30000 | `day-cap.js:12` |
| LG-07 | Наступна UTC-доба: ліміт новий | `pickupAt=2026-01-16T10:00:00Z`<br>`returnAt=2026-01-16T10:20:00Z`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard","id":"r1"}`<br>`dayCap=createDayCap() → record("r1","2026-01-15T10:00:00Z",30000)` | **total=2500**<br>minutes=20; timeCharge=2500<br>discounts: —<br>fees: —<br>після: chargedOn("r1","2026-01-16")=2500 | `day-cap.js:6-8`, `day-cap.js:12` |
| ⚠ LG-08 | 23:30 і 00:30 за Києвом — різні доби, але одна UTC-дата: ліміт спільний | `pickupAt=2026-01-15T22:30:00Z`<br>`returnAt=2026-01-15T22:50:00Z`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard","id":"r1"}`<br>`dayCap=createDayCap() → record("r1","2026-01-15T21:30:00Z",30000)` | **total=0**<br>minutes=20; timeCharge=2500<br>discounts: night 750, day-cap 1750<br>fees: —<br>після: chargedOn("r1","2026-01-15")=30000 | `day-cap.js:7` (UTC), порівняти з `tariff.js:50` (Київ) |
| ⚠ LG-09 | 00:30 і 10:00 за Києвом — одна доба, але різні UTC-дати: ліміт окремий | `pickupAt=2026-01-16T08:00:00Z`<br>`returnAt=2026-01-16T08:20:00Z`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard","id":"r1"}`<br>`dayCap=createDayCap() → record("r1","2026-01-15T22:30:00Z",30000)` | **total=2500**<br>minutes=20; timeCharge=2500<br>discounts: —<br>fees: —<br>після: chargedOn("r1","2026-01-15")=30000, chargedOn("r1","2026-01-16")=2500 | `day-cap.js:7` (UTC), порівняти з `tariff.js:50` (Київ) |
| LG-10 | Поїздка через північ UTC записується на дату старту | `pickupAt=2026-01-15T23:50:00Z`<br>`returnAt=2026-01-16T00:10:00Z`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard","id":"r1"}`<br>`dayCap=createDayCap()` | **total=1750**<br>minutes=20; timeCharge=2500<br>discounts: night 750<br>fees: —<br>після: chargedOn("r1","2026-01-15")=1750, chargedOn("r1","2026-01-16")=0 | коментар `day-cap.js:5`; `day-cap.js:7` |
| LG-11 | Свій ліміт менший за стандартний | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:20:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard","id":"r1"}`<br>`dayCap=createDayCap({limit:1000})` | **total=1000**<br>minutes=20; timeCharge=2500<br>discounts: day-cap 1500<br>fees: —<br>після: chargedOn("r1","2026-01-15")=1000 | `day-cap.js:10`, `tariff.js:56` |
| LG-12 | Свій ліміт більший за стандартний: 30000 не застосовується | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T18:00:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard","id":"r1"}`<br>`dayCap=createDayCap({limit:50000})` | **total=40000**<br>minutes=480; timeCharge=40000<br>discounts: —<br>fees: —<br>після: chargedOn("r1","2026-01-15")=40000 | `tariff.js:56` |
| LG-13 | Збір не обмежується лімітом і не потрапляє до журналу | `pickupAt=2026-01-15T14:00:00+02:00`<br>`returnAt=2026-01-15T14:20:00+02:00`<br>`bike=classic, returnStation=X01`<br>`rider={"type":"standard","id":"r1"}`<br>`dayCap=createDayCap() → record("r1","2026-01-15T10:00:00+02:00",30000)` | **total=15000**<br>minutes=20; timeCharge=2500<br>discounts: day-cap 2500<br>fees: out-of-zone 15000<br>після: chargedOn("r1","2026-01-15")=30000 | коментар `day-cap.js:1`; `tariff.js:61-66` |
| LG-14 | До журналу йде сума після знижок | `pickupAt=2026-01-15T02:00:00+02:00`<br>`returnAt=2026-01-15T02:20:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"reduced","id":"r1"}`<br>`dayCap=createDayCap()` | **total=875**<br>minutes=20; timeCharge=2500<br>discounts: reduced 1250, night 375<br>fees: —<br>після: chargedOn("r1","2026-01-15")=875 | `tariff.js:48-61` |
| ⚠ LG-15 | Повторний `quote` тієї самої поїздки записує її ще раз: другий виклик дає іншу суму | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T14:00:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard","id":"r1"}`<br>`dayCap=createDayCap() → попередній quote тієї самої поїздки` | **total=10000**<br>minutes=240; timeCharge=20000<br>discounts: day-cap 10000<br>fees: —<br>після: chargedOn("r1","2026-01-15")=30000 | `tariff.js:61`, ідемпотентності в коді немає |

## 7. Збір за повернення поза зоною

15000 за повернення в зону `out`; пільговий план зменшує його вдвічі. Збір нараховується після всіх знижок.

| ID | Що перевіряє | Вхідні дані | Очікуваний результат (коп.) | Звідки взято |
|---|---|---|---|---|
| FE-01 | Усі станції зони `in`: збору немає | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:20:00+02:00`<br>`bike=classic, returnStation=S01, S02, S03, S04, S05, S06, S07, S08 (кожна окремим запуском)`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=2500**<br>minutes=20; timeCharge=2500<br>discounts: —<br>fees: — | `zones.js:4-11`, `tariff.js:107` |
| FE-02 | Усі станції зони `out`: збір повний | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:20:00+02:00`<br>`bike=classic, returnStation=X01, X02, X03 (кожна окремим запуском)`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=17500**<br>minutes=20; timeCharge=2500<br>discounts: —<br>fees: out-of-zone 15000 | `zones.js:12-14`, `tariff.js:26`, `tariff.js:107` |
| FE-03 | Нульова поїздка не скасовує збір | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:00:00+02:00`<br>`bike=classic, returnStation=X01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=15000**<br>minutes=0; timeCharge=0<br>discounts: —<br>fees: out-of-zone 15000 | `tariff.js:107` |
| FE-04 | Абонемент не зменшує збір | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:20:00+02:00`<br>`bike=classic, returnStation=X01`<br>`rider={"type":"subscriber"}`<br>`dayCap=немає` | **total=15000**<br>minutes=20; timeCharge=2500<br>discounts: subscription 2500<br>fees: out-of-zone 15000 | `tariff.js:63-65` |
| FE-05 | Пільговий, 2 хв: збір удвічі менший | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:02:00+02:00`<br>`bike=classic, returnStation=X01`<br>`rider={"type":"reduced"}`<br>`dayCap=немає` | **total=8750**<br>minutes=2; timeCharge=2500<br>discounts: reduced 1250<br>fees: out-of-zone 7500 | `tariff.js:63-65` |
| ⚠ FE-06 | Пільговий, 1 хв: знижки плану немає, тому збір повний і сума більша, ніж у FE-05 | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:01:00+02:00`<br>`bike=classic, returnStation=X01`<br>`rider={"type":"reduced"}`<br>`dayCap=немає` | **total=15000**<br>minutes=1; timeCharge=0<br>discounts: —<br>fees: out-of-zone 15000 | `tariff.js:47` і `tariff.js:64`: план `none`, бо `amount = 0` |
| ⚠ FE-07 | Абонент із пільгою, 20 хв: план обрано без огляду на збір, сума 15000 проти 8750 за пільговим | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:20:00+02:00`<br>`bike=classic, returnStation=X01`<br>`rider={"type":"subscriber","concession":true}`<br>`dayCap=немає` | **total=15000**<br>minutes=20; timeCharge=2500<br>discounts: subscription 2500<br>fees: out-of-zone 15000 | `tariff.js:46`, `tariff.js:64`; розходиться з коментарем `tariff.js:88` |
| ⚠ FE-08 | Абонент із пільгою, 100 хв (рівні знижки): сума 20000 проти 12500 за пільговим | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T11:40:00+02:00`<br>`bike=classic, returnStation=X01`<br>`rider={"type":"subscriber","concession":true}`<br>`dayCap=немає` | **total=20000**<br>minutes=100; timeCharge=10000<br>discounts: subscription 5000<br>fees: out-of-zone 15000 | `tariff.js:97`, `tariff.js:64`; розходиться з коментарем `tariff.js:88` |
| FE-09 | Абонент із пільгою, обрано пільговий: збір удвічі менший | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T13:20:00+02:00`<br>`bike=classic, returnStation=X01`<br>`rider={"type":"subscriber","concession":true}`<br>`dayCap=немає` | **total=16250**<br>minutes=200; timeCharge=17500<br>discounts: reduced 8750<br>fees: out-of-zone 7500 | `tariff.js:63-65`, `tariff.js:97` |
| FE-10 | Нічна знижка не зменшує збір | `pickupAt=2026-01-15T01:00:00+02:00`<br>`returnAt=2026-01-15T01:20:00+02:00`<br>`bike=classic, returnStation=X01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=16750**<br>minutes=20; timeCharge=2500<br>discounts: night 750<br>fees: out-of-zone 15000 | `tariff.js:50-66` |
| FE-11 | Своя таблиця: нова станція поза зоною | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:20:00+02:00`<br>`bike=classic, returnStation=Q1`<br>`rider={"type":"standard"}`<br>`dayCap=немає`<br>`zones=createZones({Q1:{name:"Тест",zone:"out"}})` | **total=17500**<br>minutes=20; timeCharge=2500<br>discounts: —<br>fees: out-of-zone 15000 | коментар `zones.js:17`; `tariff.js:118` |
| FE-12 | Своя таблиця: зона визначається таблицею, а не назвою X01 | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:20:00+02:00`<br>`bike=classic, returnStation=X01`<br>`rider={"type":"standard"}`<br>`dayCap=немає`<br>`zones=createZones({X01:{name:"Тест",zone:"in"}})` | **total=2500**<br>minutes=20; timeCharge=2500<br>discounts: —<br>fees: — | коментар `zones.js:17`; `tariff.js:107`, `tariff.js:118` |

## 8. Збір за неповернений велосипед

200000, якщо `minutes` більше за 1440; пільговий план зменшує його вдвічі.

| ID | Що перевіряє | Вхідні дані | Очікуваний результат (коп.) | Звідки взято |
|---|---|---|---|---|
| UR-01 | Рівно 24 год: збору немає | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-16T10:00:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=30000**<br>minutes=1440; timeCharge=120000<br>discounts: day-cap 90000<br>fees: — | `tariff.js:28`, `tariff.js:108` |
| ⚠ UR-02 | 24:00:29 округлюється до 1440 хв: збору немає | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-16T10:00:29+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=30000**<br>minutes=1440; timeCharge=120000<br>discounts: day-cap 90000<br>fees: — | `tariff.js:71`, `tariff.js:108` |
| ⚠ UR-03 | 24:00:30 округлюється до 1441 хв: збір є | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-16T10:00:30+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=230000**<br>minutes=1441; timeCharge=122500<br>discounts: day-cap 92500<br>fees: unreturned 200000 | `tariff.js:27`, `tariff.js:71`, `tariff.js:108` |
| UR-04 | Пільговий: збір удвічі менший | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-16T10:01:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"reduced"}`<br>`dayCap=немає` | **total=130000**<br>minutes=1441; timeCharge=122500<br>discounts: reduced 61250, day-cap 31250<br>fees: unreturned 100000 | `tariff.js:63-65` |
| UR-05 | Обидва збори, порядок: спершу поза зоною | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-16T10:01:00+02:00`<br>`bike=classic, returnStation=X01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=245000**<br>minutes=1441; timeCharge=122500<br>discounts: day-cap 92500<br>fees: out-of-zone 15000, unreturned 200000 | `tariff.js:105-110` |
| UR-06 | Обидва збори, пільговий | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-16T10:01:00+02:00`<br>`bike=classic, returnStation=X01`<br>`rider={"type":"reduced"}`<br>`dayCap=немає` | **total=137500**<br>minutes=1441; timeCharge=122500<br>discounts: reduced 61250, day-cap 31250<br>fees: out-of-zone 7500, unreturned 100000 | `tariff.js:63-66` |
| UR-07 | Абонемент: збір повний | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-16T10:01:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"subscriber"}`<br>`dayCap=немає` | **total=230000**<br>minutes=1441; timeCharge=122500<br>discounts: subscription 5000, day-cap 87500<br>fees: unreturned 200000 | `tariff.js:63-66`, `tariff.js:84` |
| UR-08 | Електровелосипед | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-16T10:01:00+02:00`<br>`bike=ebike, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=230000**<br>minutes=1441; timeCharge=196000<br>discounts: day-cap 166000<br>fees: unreturned 200000 | `tariff.js:18`, `tariff.js:108` |
| UR-09 | Ліміт вичерпано: лишається тільки збір | `pickupAt=2026-01-15T14:00:00+02:00`<br>`returnAt=2026-01-16T14:01:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard","id":"r1"}`<br>`dayCap=createDayCap() → record("r1","2026-01-15T10:00:00+02:00",30000)` | **total=200000**<br>minutes=1441; timeCharge=122500<br>discounts: day-cap 122500<br>fees: unreturned 200000<br>після: chargedOn("r1","2026-01-15")=30000 | `tariff.js:56-66` |
| UR-10 | Абонент із пільгою: обрано пільговий, збір удвічі менший | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-16T10:01:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"subscriber","concession":true}`<br>`dayCap=немає` | **total=130000**<br>minutes=1441; timeCharge=122500<br>discounts: reduced 61250, day-cap 31250<br>fees: unreturned 100000 | `tariff.js:63-65`, `tariff.js:97` |
| UR-11 | Ніч і неповернення разом | `pickupAt=2026-01-15T01:00:00+02:00`<br>`returnAt=2026-01-16T01:01:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=230000**<br>minutes=1441; timeCharge=122500<br>discounts: night 36750, day-cap 55750<br>fees: unreturned 200000 | `tariff.js:50-66` |

## 9. Некоректні вхідні дані

Суми немає: `quote` кидає `QuoteError`, а API перетворює її на HTTP 400 (`server.js:38`).

| ID | Що перевіряє | Вхідні дані | Очікуваний результат (коп.) | Звідки взято |
|---|---|---|---|---|
| ER-01 | Повернення раніше за старт | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T09:59:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | суми немає; `QuoteError: returnAt is before pickupAt` | `tariff.js:116` |
| ER-02 | Невідомий тип велосипеда | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:20:00+02:00`<br>`bike=cargo, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | суми немає; `QuoteError: unknown bike type: cargo` | `tariff.js:117` |
| ER-03 | Тип велосипеда з прототипа об'єкта | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:20:00+02:00`<br>`bike=toString, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | суми немає; `QuoteError: unknown bike type: toString` | `Object.hasOwn` у `tariff.js:117` |
| ER-04 | Невідома станція | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:20:00+02:00`<br>`bike=classic, returnStation=S99`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | суми немає; `QuoteError: unknown station: S99` | `tariff.js:118-119` |
| ER-05 | Назва станції з прототипа об'єкта | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:20:00+02:00`<br>`bike=classic, returnStation=toString`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | суми немає; `QuoteError: unknown station: toString` | `Object.hasOwn` у `zones.js:21` |
| ER-06 | Код станції чутливий до регістру | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:20:00+02:00`<br>`bike=classic, returnStation=s01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | суми немає; `QuoteError: unknown station: s01` | `zones.js:21` |
| ER-07 | Невідомий тип райдера | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:20:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"vip"}`<br>`dayCap=немає` | суми немає; `QuoteError: unknown rider type: vip` | `tariff.js:30`, `tariff.js:124` |
| ER-08 | Райдера немає | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:20:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider=null`<br>`dayCap=немає` | суми немає; `QuoteError: unknown rider type: undefined` | `tariff.js:124` |
| ER-09 | Поїздки немає | `ride=null`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | суми немає; `QuoteError: ride is required` | `tariff.js:113` |
| ER-10 | Час без зміщення | `pickupAt=2026-01-15T10:00:00`<br>`returnAt=2026-01-15T10:20:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | суми немає; `QuoteError: pickupAt must be an ISO 8601 date-time with an offset` | `tariff.js:31`, `tariff.js:129-131` |
| ER-11 | Лише дата | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | суми немає; `QuoteError: returnAt must be an ISO 8601 date-time with an offset` | `tariff.js:31`, `tariff.js:129-131` |
| ER-12 | Час числом | `pickupAt=1768464000000`<br>`returnAt=2026-01-15T10:20:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | суми немає; `QuoteError: pickupAt must be an ISO 8601 date-time with an offset` | `tariff.js:129` |
| ER-13 | Формат правильний, місяць 13 | `pickupAt=2026-13-01T10:00:00Z`<br>`returnAt=2026-01-15T10:20:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | суми немає; `QuoteError: pickupAt is not a valid date-time` | `tariff.js:132-133` |
| ER-14 | Формат правильний, година 25 | `pickupAt=2026-01-15T25:00:00Z`<br>`returnAt=2026-01-15T10:20:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | суми немає; `QuoteError: pickupAt is not a valid date-time` | `tariff.js:132-133` |
| ER-15 | Журнал є, `rider.id` немає | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:20:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=createDayCap()` | суми немає; `QuoteError: rider.id is required with a daily cap ledger` | `tariff.js:125` |
| ER-16 | Журнал є, `rider.id = 0`: нуль вважається відсутнім id | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:20:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard","id":0}`<br>`dayCap=createDayCap()` | суми немає; `QuoteError: rider.id is required with a daily cap ledger` | `!rider.id` у `tariff.js:125` |
| ER-17 | Відхилена поїздка не змінює журнал | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:20:00+02:00`<br>`bike=classic, returnStation=S99`<br>`rider={"type":"standard","id":"r1"}`<br>`dayCap=createDayCap()` | суми немає; `QuoteError: unknown station: S99`<br>після: chargedOn("r1","2026-01-15")=0 | `tariff.js:41`, `tariff.js:61` |
| ER-18 | `rider.id` без журналу не потрібен | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-15T10:20:00+02:00`<br>`bike=classic, returnStation=S01`<br>`rider={"type":"standard"}`<br>`dayCap=немає` | **total=2500**<br>minutes=20; timeCharge=2500<br>discounts: —<br>fees: — | `tariff.js:125` |

## 10. Округлення у `discount`

Прямий виклик функції. Округлення до меншого в `quote` за нинішніх ставок не проявляється: усі суми в наборі діляться націло.

| ID | Що перевіряє | Вхідні дані | Очікуваний результат (коп.) | Звідки взято |
|---|---|---|---|---|
| DS-01 | Залишок округлюється до меншого | `discount(333, 50)` | **167** | коментар `tariff.js:100`; `tariff.js:102` |
| DS-02 | Залишок менший за копійку: знижка дорівнює всій сумі | `discount(1, 30)` | **1** | коментар `tariff.js:100`; `tariff.js:102` |
| DS-03 | Нульова сума | `discount(0, 50)` | **0** | `tariff.js:102` |

## 11. Чек

Суми в чеку мають збігатися з копійками `quote`.

| ID | Що перевіряє | Вхідні дані | Очікуваний результат (коп.) | Звідки взято |
|---|---|---|---|---|
| RC-01 | Роздільник тисяч | `formatUah(230000)` | `2 300,00 грн` | коментар `receipt.js:14` |
| RC-02 | Від'ємна сума | `formatUah(-2500)` | `-25,00 грн` | коментар `receipt.js:14` |
| RC-03 | Менше гривні | `formatUah(5)` | `0,05 грн` | `receipt.js:18-20` |
| RC-04 | Повний чек для UR-06; останній рядок — сума до сплати | `pickupAt=2026-01-15T10:00:00+02:00`<br>`returnAt=2026-01-16T10:01:00+02:00`<br>`bike=classic, returnStation=X01`<br>`rider={"type":"reduced"}`<br>`dayCap=немає` | `Тривалість поїздки: 1441 хв`<br>`Погодинне нарахування ........... 1 225,00 грн`<br>`Знижка: пільговий тариф .......... -612,50 грн`<br>`Денний ліміт ..................... -312,50 грн`<br>`Збір: повернення поза зоною ........ 75,00 грн`<br>`Збір: неповернений велосипед .... 1 000,00 грн`<br>`До сплати ....................... 1 375,00 грн` | коментар `receipt.js:23`; `receipt.js:24-30`, `receipt.js:32-36` |

## 12. API `POST /api/quote`

Через `createHandler()` без відкриття порту. Обробник викликає `quote` без журналу.

| ID | Що перевіряє | Вхідні дані | Очікуваний результат (коп.) | Звідки взято |
|---|---|---|---|---|
| HT-01 | Успішний розрахунок повертає суму й чек | `{"ride":{"pickupAt":"2026-01-15T10:00:00+02:00","returnAt":"2026-01-15T10:20:00+02:00","bike":"classic","returnStation":"S01"},"rider":{"type":"standard"}}` | HTTP 200<br>**quote.total=2500**; останній рядок `receipt` закінчується на `25,00 грн` | `server.js:31-34` |
| ⚠ HT-02 | Два однакові запити одного райдера за один день: денний ліміт не накопичується | Двічі: `{"ride":{"pickupAt":"2026-01-15T10:00:00+02:00","returnAt":"2026-01-15T22:00:00+02:00","bike":"classic","returnStation":"S01"},"rider":{"type":"standard","id":"r1"}}` | HTTP 200<br>обидва рази **quote.total=30000**; discounts: day-cap 30000; разом за день 60000 | `server.js:33`: `dayCap` не передається |
| HT-03 | Помилка розрахунку стає відповіддю 400 | `{"ride":{"pickupAt":"2026-01-15T10:00:00+02:00","returnAt":"2026-01-15T09:59:00+02:00","bike":"classic","returnStation":"S01"},"rider":{"type":"standard"}}` | HTTP 400<br>суми немає; `error: returnAt is before pickupAt` | `server.js:38`, `tariff.js:116` |
| HT-04 | Тіло не є JSON | `{not json` | HTTP 400<br>суми немає; `error: request body is not valid JSON` | `server.js:54-58` |
| HT-05 | Тіло `null` | `null` | HTTP 400<br>суми немає; `error: request body must be a JSON object` | `server.js:59` |

## 13. Наскрізні властивості

Перевіряються на всіх кейсах `quote` із цього документа, а не на окремих даних.

| ID | Що перевіряє | Вхідні дані | Очікуваний результат (коп.) | Звідки взято |
|---|---|---|---|---|
| IN-01 | Підсумок сходиться, і кожна позиція додатна | Вхідні дані кожного кейсу `quote` | `total = timeCharge − Σ discounts + Σ fees`; кожен `amount > 0` | коментар `tariff.js:12`; `tariff.js:47`, `tariff.js:66` |
| IN-02 | Результат не залежить від часового поясу машини | Вхідні дані кожного кейсу `quote`; змінна середовища `TZ=America/New_York`, потім `TZ=Asia/Tokyo` | Ті самі копійки, що в кейсах вище | коментар `kyiv-time.js:1`; `kyiv-time.js:4`, `day-cap.js:7` |
