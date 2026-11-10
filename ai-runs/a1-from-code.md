- Інструмент і модель: Claude Code 2.1.317, неінтерактивна сесія `claude -p` (нова сесія без історії), модель claude-sonnet-5-5
- Дата: 2026-11-10
- Що бачила сесія: тимчасова тека поза репо (`ws12-a1` у scratchpad сесії) з `app/src/` з `main` (`git archive main app/src`); більше нічого
- Що було ввімкнено з пам'яті й глобальних правил: глобального `~/.claude/CLAUDE.md` немає; `CLAUDE.md` / `AGENTS.md` у батьківських теках тимчасової копії немає; авто-пам'ять — нова порожня тека для цього шляху; навички і MCP вимкнено (`--disable-slash-commands --strict-mcp-config --no-chrome`); у `~/.claude/settings.json` лише `effortLevel: medium` і тема. Режим дозволів: `acceptEdits` + дозволені Read/Write/Edit/Glob/Grep і `Bash(node:*)`, `ls`, `mkdir`, `cat`
- Промпт (дослівно):

  > У цій теці — код сервісу, який рахує вартість поїздок велопрокату громади (app/src/).
  > Читай лише файли в app/src/.
  > Склади набір тест-кейсів для розрахунку вартості поїздки. Для кожного кейсу: ID; що
  > перевіряє; вхідні дані (усе, від чого залежить результат); очікуваний результат у
  > копійках; звідки взято це очікування.
  > Запиши відповідь у файл ai-runs/a1-from-code.md. Нічого іншого не створюй і не змінюй.
  > Уточнювальних питань не став; працюй з тим, що є.

---

# Тест-кейси розрахунку вартості поїздки (виведено з коду app/src/)

## Про джерело очікувань

Прочитано лише `app/src/*.js`. Специфікацію (`docs/spec/tariffs.md`) не читав, бо мені заборонено. Тому кожне «очікування» означає: **так рахує поточний код**. Це не доведено, що так правильно. Кейси, де поведінка коду виглядає підозріло, позначені ⚠. Їх треба звірити зі специфікацією до того, як вважати очікування еталоном.

Усі суми в копійках. Скорочення у вхідних даних:
- `P` — `pickupAt`. Тривалість — це `returnAt − pickupAt`. `bike`, `rider`, `станція` — це `ride.bike`, `rider.type` і `ride.returnStation`.
- `ledger` — об'єкт `createDayCap()`. Якщо не вказано, `quote` викликається без `dayCap`.
- `concession` — `rider.concession`. Якщо не вказано, поля немає.
- Якщо рядок не згадує знижки чи збори, то `discounts=[]` і `fees=[]`.
- Результат `quote` — `{minutes, timeCharge, discounts, fees, total}`.

Тарифи, що використовуються в розрахунках: classic 2500 і ebike 4000 за кожні початі 30 хв; перші < 2 хв безкоштовні; абонемент дає 45 хв безкоштовно, а на ebike ще −20%; пільговий тариф −50%; нічна знижка −30% (година початку за Києвом < 6); збір поза зоною 15000; збір за неповернення 200000 при тривалості > 1440 хв; денний ліміт 30000.

---

## A. Погодинне нарахування (стандартний райдер)

| ID | Що перевіряє | Вхідні дані | Очікування | Джерело |
|---|---|---|---|---|
| A01 | Нульова тривалість | P=2025-06-10T09:00:00Z · returnAt=P · classic · standard · S01 | minutes=0, timeCharge=0, total=**0** | `tariff.js:78-80` (`minutes < 2 → 0`) |
| A02 | 1 хв безкоштовна | P=2025-06-10T09:00:00Z · 1 хв · classic · standard · S01 | minutes=1, total=**0** | `tariff.js:15,79` |
| A03 | Округлення хвилин вниз: 89 с → 1 хв, безкоштовно | P=2025-06-10T09:00:00Z · 89 с · classic · standard · S01 | minutes=1, total=**0** | `tariff.js:70-72` (`Math.round`) |
| A04 | Округлення на .5 угору: 90 с → 2 хв, платно | P=2025-06-10T09:00:00Z · 90 с · classic · standard · S01 | minutes=2, total=**2500** | `tariff.js:70-72,79-80` |
| A05 | Межа безкоштовного старту: 2 хв | P=2025-06-10T09:00:00Z · 2 хв · classic · standard · S01 | total=**2500** | `tariff.js:79-80` |
| A06 | Повний перший блок | P=2025-06-10T09:00:00Z · 30 хв · classic · standard · S01 | total=**2500** | `tariff.js:74-76` |
| A07 | 30 хв 29 с → 30 хв, ще один блок | P=2025-06-10T09:00:00Z · 1829 с · classic · standard · S01 | minutes=30, total=**2500** | `tariff.js:70-76` |
| A08 | 30 хв 30 с → 31 хв, другий блок | P=2025-06-10T09:00:00Z · 1830 с · classic · standard · S01 | minutes=31, total=**5000** | `tariff.js:70-76` |
| A09 | 31 хв — початок другого блока | P=2025-06-10T09:00:00Z · 31 хв · classic · standard · S01 | total=**5000** | `tariff.js:74-80` |
| A10 | Кінець другого блока | P=2025-06-10T09:00:00Z · 60 хв · classic · standard · S01 | total=**5000** | `tariff.js:74-80` |
| A11 | Початок третього блока | P=2025-06-10T09:00:00Z · 61 хв · classic · standard · S01 | total=**7500** | `tariff.js:74-80` |
| A12 | ebike: 1 хв безкоштовно | P=2025-06-10T09:00:00Z · 1 хв · ebike · standard · S01 | total=**0** | `tariff.js:18,79` |
| A13 | ebike: 2 хв | P=2025-06-10T09:00:00Z · 2 хв · ebike · standard · S01 | total=**4000** | `tariff.js:18,80` |
| A14 | ebike: 30 хв | P=2025-06-10T09:00:00Z · 30 хв · ebike · standard · S01 | total=**4000** | `tariff.js:18,80` |
| A15 | ebike: 31 хв | P=2025-06-10T09:00:00Z · 31 хв · ebike · standard · S01 | total=**8000** | `tariff.js:18,80` |
| A16 | Зсув часового поясу в даті: тривалість рахується по миттєвостях, а не по тексту | pickupAt=`2025-06-10T12:00:00+03:00` · returnAt=`2025-06-10T09:30:00Z` · classic · standard · S01 | minutes=30, total=**2500** | `tariff.js:128-135,70-72` |
| A17 | Допустимі формати часу: без секунд і з дробовими секундами | pickupAt=`2025-06-10T09:00Z` · returnAt=`2025-06-10T09:30:00.500Z` · classic · standard · S01 | minutes=30, total=**2500** | `tariff.js:31` (регулярка) |

## B. Абонемент (subscriber без concession)

Усі: P=2025-06-10T09:00:00Z · станція S01. Бажано мати окремий кейс у кожного блока, тому межі 45/46 хв і 75/76 хв.

| ID | Що перевіряє | Вхідні дані | Очікування | Джерело |
|---|---|---|---|---|
| B01 | 45 хв безкоштовно (classic) | 45 хв · classic · subscriber | timeCharge=5000, discounts=[subscription 5000], **total=0** | `tariff.js:83-86,91-93` |
| B02 | 46 хв: перший платний блок після 45 | 46 хв · classic · subscriber | timeCharge=5000, discounts=[subscription 2500], **total=2500** | `tariff.js:84` |
| B03 | 75 хв: рівно один платний блок | 75 хв · classic · subscriber | timeCharge=7500, discounts=[subscription 5000], **total=2500** | `tariff.js:84` (30 хв понад 45 = 1 блок) |
| B04 | 76 хв: другий платний блок | 76 хв · classic · subscriber | timeCharge=7500, discounts=[subscription 2500], **total=5000** | `tariff.js:84` |
| B05 | ebike, 45 хв безкоштовно | 45 хв · ebike · subscriber | timeCharge=8000, discounts=[subscription 8000], **total=0** | `tariff.js:84-85` |
| B06 | ebike, 46 хв: блок 4000, −20% = 3200 | 46 хв · ebike · subscriber | timeCharge=8000, discounts=[subscription 4800], **total=3200** | `tariff.js:85,101-103` (4000 − ⌊4000·80/100⌋ = 800) |
| B07 | ebike, 90 хв: 2 платні блоки 8000, −20% = 6400 | 90 хв · ebike · subscriber | timeCharge=12000, discounts=[subscription 5600], **total=6400** | `tariff.js:84-85` |
| B08 | Поїздка < 2 хв: знижка не з'являється | 1 хв · classic · subscriber | timeCharge=0, discounts=[], **total=0** | `tariff.js:47` (`amount > 0`) |

## C. Пільговий тариф (reduced)

Усі: P=2025-06-10T09:00:00Z · станція S01.

| ID | Що перевіряє | Вхідні дані | Очікування | Джерело |
|---|---|---|---|---|
| C01 | −50% від погодинної суми | 60 хв · classic · reduced | timeCharge=5000, discounts=[reduced 2500], **total=2500** | `tariff.js:94-96,101-103` |
| C02 | −50% на ebike | 30 хв · ebike · reduced | timeCharge=4000, discounts=[reduced 2000], **total=2000** | `tariff.js:95` |
| C03 | Безкоштовна поїздка: без знижки | 1 хв · classic · reduced | discounts=[], **total=0** | `tariff.js:47` |
| C04 | `concession` не діє для standard | 60 хв · classic · standard · concession=true | discounts=[], **total=5000** | `tariff.js:94` (умова лише для reduced/subscriber) |

## D. Вибір вигіднішого плану (subscriber + concession)

Усі: P=2025-06-10T09:00:00Z · станція S01 · rider=subscriber.

| ID | Що перевіряє | Вхідні дані | Очікування | Джерело |
|---|---|---|---|---|
| D01 | Рівні знижки (2500 = 2500): перемагає абонемент, бо порівняння строге | 60 хв · classic · concession=true | discounts=[subscription 2500], **total=2500** | `tariff.js:97` (`>`, а не `>=`) |
| D02 | Абонемент вигідніший | 60 хв · ebike · concession=true | timeCharge=8000, discounts=[subscription 4800], **total=3200** | `tariff.js:89-98` (reduced дав би 4000) |
| D03 | Пільговий вигідніший | 200 хв · ebike · concession=true | timeCharge=28000, discounts=[reduced 14000], **total=14000** | `tariff.js:89-98` (абонемент: 28000 − 19200 = 8800 < 14000) |
| D04 | Те саме без concession — лише абонемент | 200 хв · ebike · concession=false | discounts=[subscription 8800], **total=19200** | `tariff.js:94` |
| D05 | `concession` рядком `"true"` не вважається | 200 хв · ebike · concession=`"true"` | discounts=[subscription 8800], **total=19200** | `tariff.js:94` (`=== true`) |
| D06 | Знижки не складаються: застосовується один план | 40 хв · classic · concession=true | discounts=[subscription 2500], **total=0** | `tariff.js:97` |

## E. Нічна знижка (година початку за Києвом < 6)

Усі: classic · standard · S01, якщо не вказано інше.

| ID | Що перевіряє | Вхідні дані | Очікування | Джерело |
|---|---|---|---|---|
| E01 | Базова нічна знижка | P=2025-06-10T00:00:00Z (03:00 Київ) · 30 хв | discounts=[night 750], **total=1750** | `tariff.js:50-54` |
| E02 | Остання хвилина ночі влітку (UTC+3) | P=2025-06-10T02:59:00Z (05:59 Київ) · 30 хв | discounts=[night 750], **total=1750** | `kyiv-time.js`, `tariff.js:50` |
| E03 | Межа 06:00 влітку — вже день | P=2025-06-10T03:00:00Z (06:00 Київ) · 30 хв | discounts=[], **total=2500** | `tariff.js:25,50` |
| E04 | Остання хвилина ночі взимку (UTC+2) | P=2025-01-15T03:59:00Z (05:59 Київ) · 30 хв | discounts=[night 750], **total=1750** | `kyiv-time.js:3-11` |
| E05 | Межа 06:00 взимку | P=2025-01-15T04:00:00Z (06:00 Київ) · 30 хв | discounts=[], **total=2500** | `tariff.js:50` |
| E06 | Перехід на літній час: до 06:00 | P=2025-03-30T02:59:00Z (05:59 Київ, вже UTC+3) · 30 хв | discounts=[night 750], **total=1750** | `kyiv-time.js` (Intl із `Europe/Kyiv`) |
| E07 | Перехід на літній час: 06:00 | P=2025-03-30T03:00:00Z (06:00 Київ) · 30 хв | discounts=[], **total=2500** | те саме |
| E08 | Північ: 00:00 — ніч | P=2025-06-09T21:00:00Z (00:00 Київ) · 30 хв | discounts=[night 750], **total=1750** | `tariff.js:50` |
| E09 | 23:59 — ще не ніч | P=2025-06-09T20:59:00Z (23:59 Київ) · 30 хв | discounts=[], **total=2500** | `tariff.js:50` |
| E10 | Година береться з моменту, а не з тексту зсуву: 05:30+03:00 | P=`2025-06-10T05:30:00+03:00` · 30 хв | discounts=[night 750], **total=1750** | `tariff.js:50`, `kyiv-time.js` |
| E11 | Те саме з протилежним результатом: 05:30−05:00 = 13:30 Київ | P=`2025-06-10T05:30:00-05:00` · 30 хв | discounts=[], **total=2500** | `kyiv-time.js` |
| E12 | Знижка за початком, а не кінцем: старт 05:50, фініш 07:20 | P=2025-06-10T02:50:00Z (05:50 Київ) · 90 хв | timeCharge=7500, discounts=[night 2250], **total=5250** | `tariff.js:50` (`pickup`) |
| E13 | Старт 23:00, перетин півночі — знижки немає | P=2025-06-09T20:00:00Z (23:00 Київ) · 180 хв | timeCharge=15000, discounts=[], **total=15000** | `tariff.js:50` |
| E14 | Нічна знижка на ebike | P=2025-06-10T00:00:00Z · 30 хв · ebike | timeCharge=4000, discounts=[night 1200], **total=2800** | `tariff.js:51,101-103` |
| E15 | Безкоштовна поїздка вночі: рядка night немає | P=2025-06-10T00:00:00Z · 1 хв | discounts=[], **total=0** | `tariff.js:50` (`due > 0`) |
| E16 | Нічна знижка після абонемента, порядок рядків | P=2025-06-10T00:00:00Z · 46 хв · subscriber | timeCharge=5000, discounts=[subscription 2500, night 750], **total=1750** | `tariff.js:46-54` |
| E17 | Нічна знижка після пільгового | P=2025-06-10T00:00:00Z · 30 хв · reduced | timeCharge=2500, discounts=[reduced 1250, night 375], **total=875** | `tariff.js:46-54` (1250 − ⌊1250·70/100⌋ = 375) |
| E18 | Після абонемента платити нічого — рядка night немає | P=2025-06-10T00:00:00Z · 40 хв · subscriber | discounts=[subscription 2500], **total=0** | `tariff.js:50` (`due > 0`) |

## F. Денний ліміт на одну поїздку (без ledger діє `DAY_CAP`=30000)

Усі: станція S01, rider=standard, якщо не вказано інше.

| ID | Що перевіряє | Вхідні дані | Очікування | Джерело |
|---|---|---|---|---|
| F01 | Рівно на ліміті: знижки немає | P=2025-06-10T09:00:00Z · 360 хв · classic | timeCharge=30000, discounts=[], **total=30000** | `tariff.js:57` (`due > allowance`) |
| F02 | На 1 блок більше за ліміт | P=2025-06-10T09:00:00Z · 361 хв · classic | timeCharge=32500, discounts=[day-cap 2500], **total=30000** | `tariff.js:57-60` |
| F03 | Нижче ліміту (ebike) | P=2025-06-10T09:00:00Z · 210 хв · ebike | timeCharge=28000, **total=28000** | `tariff.js:57` |
| F04 | Над лімітом (ebike) | P=2025-06-10T09:00:00Z · 240 хв · ebike | timeCharge=32000, discounts=[day-cap 2000], **total=30000** | `tariff.js:57-60` |
| F05 | Доба поїздки: 1440 хв без збору за неповернення | P=2025-06-10T09:00:00Z · 1440 хв · classic | timeCharge=120000, discounts=[day-cap 90000], fees=[], **total=30000** | `tariff.js:28,107` |
| F06 | Ніч + ліміт, порядок: night, потім day-cap | P=2025-06-10T00:00:00Z · 900 хв · classic | timeCharge=75000, discounts=[night 22500, day-cap 22500], **total=30000** | `tariff.js:50-60` |
| F07 | Абонемент + ліміт | P=2025-06-10T09:00:00Z · 600 хв · ebike · subscriber | timeCharge=80000, discounts=[subscription 19200, day-cap 30800], **total=30000** | `tariff.js:84-85,57-60` |

## G. Денний ліміт із ledger (`createDayCap`)

Усі: classic · standard · S01 · rider.id=`r1`, якщо не вказано інше. Дні — за UTC, як у `dayKey`.

| ID | Що перевіряє | Вхідні дані | Очікування | Джерело |
|---|---|---|---|---|
| G01 | Накопичення за день, три поїздки поспіль (один ledger) | 1) P=2025-06-10T09:00Z · 300 хв; 2) P=2025-06-10T15:00Z · 60 хв; 3) P=2025-06-10T18:00Z · 30 хв | 1) **25000**; 2) **5000** (залишок рівно 5000, знижки немає); 3) discounts=[day-cap 2500], **total=0**. Після кроку 3 `chargedOn("r1","2025-06-10")` = 30000 | `day-cap.js:17-23`, `tariff.js:56-61` |
| G02 | Часткове обрізання залишком | 1) P=2025-06-10T09:00Z · 300 хв; 2) P=2025-06-10T15:00Z · 90 хв | 1) **25000**; 2) timeCharge=7500, discounts=[day-cap 2500], **total=5000** | `tariff.js:56-60` |
| G03 | Інший райдер не залежить від чужих витрат | ledger, де `r1` уже витратив 30000 за 2025-06-10; тепер `r2`, P=2025-06-10T18:00Z · 30 хв | **2500**, discounts=[] | `day-cap.js:12` (ключ `riderId|day`) |
| G04 | Наступний день — новий ліміт | ledger, де `r1` витратив 30000 за 2025-06-10; тепер `r1`, P=2025-06-11T09:00Z · 30 хв | **2500** | `day-cap.js:6-8,12` |
| G05 | Власний `limit` у ledger | `createDayCap({limit: 10000})` · P=2025-06-10T09:00Z · 300 хв | timeCharge=25000, discounts=[day-cap 15000], **total=10000** | `day-cap.js:10,18`, `tariff.js:56` |
| G06 | У ledger записується сума після знижок і без зборів | свіжий ledger · P=2025-06-10T09:00Z · 30 хв · станція X01 | **total=17500** (2500 + збір 15000); `chargedOn("r1","2025-06-10")` = **2500** | `tariff.js:61-66` |
| G07 | У ledger записується сума після знижок для абонемента | свіжий ledger · P=2025-06-10T09:00Z · 46 хв · subscriber | total=2500; `chargedOn` = **2500** | `tariff.js:48,61` |
| G08 | З ledger потрібен `rider.id` | свіжий ledger · rider={type:"standard"} без id · P=2025-06-10T09:00Z · 30 хв | **QuoteError** `rider.id is required with a daily cap ledger`; нічого не записано | `tariff.js:123-126` |
| G09 | Без ledger `rider.id` не потрібен | без ledger · rider={type:"standard"} без id | **2500**, без помилки | `tariff.js:125` |
| G10 ⚠ | «Доба» ліміту за UTC, а не за Києвом: ранок за Києвом ділиться між двома добами | свіжий ledger · 1) P=2025-06-10T20:30Z (23:30 Київ 10.06) · 300 хв; 2) P=2025-06-10T21:30Z (00:30 Київ 11.06, ніч) · 120 хв | 1) **25000**; 2) timeCharge=10000, discounts=[night 3000, day-cap 2000], **total=5000** (код вважає обидві поїздки однією добою 2025-06-10; за київською добою друга була б 7000) | `day-cap.js:6-8` (`toISOString`), `kyiv-time.js` |
| G11 ⚠ | Зворотний випадок: одна київська доба, але різні UTC-доби | свіжий ledger · 1) P=2025-06-10T23:00Z (02:00 Київ 11.06) · 900 хв; 2) P=2025-06-11T00:30Z (03:30 Київ 11.06) · 30 хв | 1) timeCharge=75000, discounts=[night 22500, day-cap 22500], **total=30000**; 2) discounts=[night 750], **total=1750** (код рахує ліміт нового UTC-дня; за київською добою ліміт був би вичерпаний → 0) | `day-cap.js:6-8` |

## H. Збір за повернення поза зоною (X01–X03)

Усі: P=2025-06-10T09:00:00Z, якщо не вказано інше.

| ID | Що перевіряє | Вхідні дані | Очікування | Джерело |
|---|---|---|---|---|
| H01 | Повернення в зоні — без збору | 30 хв · classic · standard · S08 | fees=[], **total=2500** | `zones.js:11`, `tariff.js:107` |
| H02 | Поза зоною (X01) | 30 хв · classic · standard · X01 | fees=[out-of-zone 15000], **total=17500** | `tariff.js:26,107` |
| H03 | X02 та X03 теж поза зоною | 30 хв · classic · standard · X02, потім X03 | в обох випадках fees=[out-of-zone 15000], **total=17500** | `zones.js:13-14` |
| H04 | Збір не залежить від тривалості: безкоштовна поїздка | 1 хв · classic · standard · X01 | timeCharge=0, fees=[out-of-zone 15000], **total=15000** | `tariff.js:63-66` |
| H05 | Пільговий: збір −50% | 30 хв · classic · reduced · X01 | discounts=[reduced 1250], fees=[out-of-zone 7500], **total=8750** | `tariff.js:63-65` |
| H06 | Абонемент без concession — збір повний | 46 хв · classic · subscriber · X01 | discounts=[subscription 2500], fees=[out-of-zone 15000], **total=17500** | `tariff.js:64` (`plan.code === "reduced"`) |
| H07 | Subscriber+concession, переміг абонемент — збір повний | 60 хв · classic · subscriber · concession=true · X01 | discounts=[subscription 2500], fees=[out-of-zone 15000], **total=17500** | `tariff.js:97,64` |
| H08 | Subscriber+concession, переміг reduced — збір −50% | 200 хв · ebike · subscriber · concession=true · X01 | discounts=[reduced 14000], fees=[out-of-zone 7500], **total=21500** | `tariff.js:64` |
| H09 | Пільговий + ніч + поза зоною | P=2025-06-10T00:00:00Z · 30 хв · classic · reduced · X01 | discounts=[reduced 1250, night 375], fees=[out-of-zone 7500], **total=8375** | `tariff.js:46-65` |
| H10 | Збори не входять до денного ліміту | 360 хв · classic · standard · X01 | timeCharge=30000, discounts=[], fees=[out-of-zone 15000], **total=45000** | `tariff.js:56-66` |
| H11 ⚠ | Пільговий, але плата за час нульова: код не знижує збір, бо план — `none` | 1 хв · classic · reduced · X01 | discounts=[], fees=[out-of-zone **15000**], **total=15000** (для пільговика з платною поїздкою збір був би 7500, див. H05) | `tariff.js:46-47,63-65,97` (знижка 0 не обирає `reduced`) |

## I. Збір за неповернений велосипед (> 1440 хв)

Усі: P=2025-06-10T09:00:00Z · classic.

| ID | Що перевіряє | Вхідні дані | Очікування | Джерело |
|---|---|---|---|---|
| I01 | Рівно доба: збору немає (див. також F05) | 1440 хв · standard · S01 | fees=[], total=30000 | `tariff.js:28,108` (`>`) |
| I02 | 1440 хв 29 с → minutes=1440 → збору немає | 86429 с · standard · S01 | minutes=1440, fees=[], total=30000 | `tariff.js:70-72` |
| I03 | 1440 хв 30 с → minutes=1441 → збір | 86430 с · standard · S01 | minutes=1441, fees=[unreturned 200000], total=230000 | `tariff.js:70-72,108` |
| I04 | 1441 хв: ліміт + збір (співпадає з прикладом `formatUah(230000)` = «2 300,00 грн») | 1441 хв · standard · S01 | timeCharge=122500, discounts=[day-cap 92500], fees=[unreturned 200000], **total=230000** | `tariff.js:57-66`, `receipt.js:14` |
| I05 | Обидва збори, порядок: out-of-zone, потім unreturned | 1441 хв · standard · X01 | fees=[out-of-zone 15000, unreturned 200000], **total=245000** | `tariff.js:105-110` |
| I06 | Пільговий: обидва збори −50% | 1500 хв · reduced · X01 | timeCharge=125000, discounts=[reduced 62500, day-cap 32500], fees=[out-of-zone 7500, unreturned 100000], **total=137500** | `tariff.js:63-65` |
| I07 | Пільговий: тільки неповернення | 1500 хв · reduced · S01 | discounts=[reduced 62500, day-cap 32500], fees=[unreturned 100000], **total=130000** | `tariff.js:63-65` |
| I08 | Абонемент без concession — збір повний | 1441 хв · subscriber · S01 | timeCharge=122500, discounts=[subscription 5000, day-cap 87500], fees=[unreturned 200000], **total=230000** | `tariff.js:84,64` |

## J. Валідація входу (усі кидають `QuoteError`; через API — 400)

База: P=2025-06-10T09:00:00Z, 30 хв, classic, standard, S01. Змінено лише названий елемент.

| ID | Що перевіряє | Вхідні дані | Очікування | Джерело |
|---|---|---|---|---|
| J01 | Немає ride | ride=`null` (або відсутній) | `ride is required` | `tariff.js:113` |
| J02 | pickupAt відсутній | ride без `pickupAt` | `pickupAt must be an ISO 8601 date-time with an offset` | `tariff.js:128-131` |
| J03 | Час без зсуву | pickupAt=`2025-06-10T09:00:00` | те саме повідомлення | `tariff.js:31` |
| J04 | Лише дата | returnAt=`2025-06-10` | `returnAt must be an ISO 8601 date-time with an offset` | `tariff.js:31` |
| J05 | Неіснуючий місяць | pickupAt=`2025-13-01T09:00:00Z` | `pickupAt is not a valid date-time` | `tariff.js:132-133` |
| J06 | Повернення раніше | returnAt на 1 хв раніше за pickupAt | `returnAt is before pickupAt` | `tariff.js:116` |
| J07 | Невідомий тип велосипеда | bike=`scooter` | `unknown bike type: scooter` | `tariff.js:117` |
| J08 | Невідома станція | returnStation=`S99` | `unknown station: S99` | `tariff.js:118-119` |
| J09 | Станція не задана | returnStation відсутня | `unknown station: undefined` | `zones.js:21`, `tariff.js:119` |
| J10 | Невідомий тип райдера | rider={type:"vip"} | `unknown rider type: vip` | `tariff.js:124` |
| J11 | Райдер відсутній | rider=`null` | `unknown rider type: undefined` | `tariff.js:124` |
| J12 | Порядок перевірок: ride раніше за rider | bike=`scooter` і rider={type:"vip"} одночасно | `unknown bike type: scooter` | `tariff.js:41-42` |

## K. Квитанція (`receipt.js`)

Ширина рядка — 46 символів. Між назвою і сумою ставляться пробіл, крапки (мінімум 3), пробіл.

| ID | Що перевіряє | Вхідні дані | Очікування | Джерело |
|---|---|---|---|---|
| K01 | Формат суми з пробілом тисяч | `formatUah(230000)` | `2 300,00 грн` | `receipt.js:14-21` |
| K02 | Від'ємна сума | `formatUah(-2500)` | `-25,00 грн` | `receipt.js:16` |
| K03 | Нуль | `formatUah(0)` | `0,00 грн` | `receipt.js:19` |
| K04 | Менше гривні, нуль на початку копійок | `formatUah(5)` | `0,05 грн` | `receipt.js:19` |
| K05 | Мінус при сумі менше гривні | `formatUah(-5)` | `-0,05 грн` | `receipt.js:16-20` |
| K06 | Мільйони | `formatUah(123456789)` | `1 234 567,89 грн` | `receipt.js:18` |
| K07 | Квитанція без знижок і зборів | quote={minutes:30, timeCharge:2500, discounts:[], fees:[], total:2500} | 3 рядки: `Тривалість поїздки: 30 хв`; `Погодинне нарахування` + 14 крапок + `25,00 грн`; `До сплати` + 26 крапок + `25,00 грн` (кожен з двох останніх по 46 символів) | `receipt.js:24-36` |
| K08 | Збір у квитанції | quote для H02 (minutes=30, timeCharge=2500, fees=[out-of-zone 15000], total=17500) | рядки: тривалість; `Погодинне нарахування … 25,00 грн`; `Збір: повернення поза зоною` + 7 крапок + `150,00 грн`; `До сплати` + 25 крапок + `175,00 грн` | `receipt.js:5-12,27` |
| K09 | Знижки показуються від'ємними | quote для B02 (minutes=46, timeCharge=5000, discounts=[subscription 2500], total=2500) | рядки: `Тривалість поїздки: 46 хв`; `Погодинне нарахування` + 14 крапок + `50,00 грн`; `Знижка: абонемент` + 17 крапок + `-25,00 грн`; `До сплати` + 26 крапок + `25,00 грн` | `receipt.js:26` |
| K10 | Порядок рядків: усі знижки, потім усі збори, остання — «До сплати» | quote з discounts=[reduced, night, day-cap] і fees=[out-of-zone, unreturned] | порядок підписів: `Знижка: пільговий тариф`, `Знижка: нічна`, `Денний ліміт`, `Збір: повернення поза зоною`, `Збір: неповернений велосипед`, `До сплати` | `receipt.js:5-12,26-28` |
| K11 | Мінімум 3 крапки при довгому рядку | quote={minutes:0, timeCharge:0, discounts:[], fees:[{code:"unreturned", amount:123456789}], total:123456789}, рядок збору | `Збір: неповернений велосипед ... 1 234 567,89 грн` (рівно 3 крапки, рядок довший за 46) | `receipt.js:34` |
| K12 | Невідомий код — підпис дорівнює коду | quote із fees=[{code:"foo", amount:100}] | рядок `foo` + 33 крапки + `1,00 грн` | `receipt.js:27` (`?? item.code`) |

## L. HTTP-API (`server.js`, виклики `createHandler()` без порту)

| ID | Що перевіряє | Вхідні дані | Очікування | Джерело |
|---|---|---|---|---|
| L01 | Health | `GET /api/health` | 200, `{"status":"ok"}` | `server.js:28-30` |
| L02 | Невідомий шлях | `GET /api/nothing` | 404, `{"error":"not found"}` | `server.js:36` |
| L03 | Метод має значення | `POST /api/health` | 404, `{"error":"not found"}` | `server.js:28,36` |
| L04 | Сторінка | `GET /` з `createHandler({page: () => "<p>x</p>"})` | 200, `text/html; charset=utf-8`, тіло `<p>x</p>` | `server.js:25-27` |
| L05 | Успішний розрахунок | `POST /api/quote`, тіло `{"ride":{"pickupAt":"2025-06-10T09:00:00Z","returnAt":"2025-06-10T09:30:00Z","bike":"classic","returnStation":"S01"},"rider":{"type":"standard"}}` | 200; `quote`={minutes:30, timeCharge:2500, discounts:[], fees:[], total:2500}; `receipt` — 3 рядки як у K07 | `server.js:31-35` |
| L06 | Невалідний JSON | `POST /api/quote`, тіло `{not json` | 400, `{"error":"request body is not valid JSON"}` | `server.js:55-58` |
| L07 | Тіло не об'єкт | `POST /api/quote`, тіло `123` або `null` | 400, `{"error":"request body must be a JSON object"}` | `server.js:59` |
| L08 | Масив проходить перевірку об'єкта, але без ride | `POST /api/quote`, тіло `[]` | 400, `{"error":"ride is required"}` | `server.js:59`, `tariff.js:113` |
| L09 | Завелике тіло | `POST /api/quote`, тіло понад 16384 байти | 400, `{"error":"request body is too large"}` | `server.js:17,50` |
| L10 | Помилка розрахунку → 400 | як L05, але `returnStation:"S99"` | 400, `{"error":"unknown station: S99"}` | `server.js:38` |
| L11 | Непередбачена помилка → 500 | `GET /` з `createHandler({page: () => { throw new Error("x") }})` | 500, `{"error":"internal error"}` | `server.js:39` |
| L12 ⚠ | API не передає ledger: денний ліміт на HTTP не накопичується між запитами | два однакових `POST /api/quote`: rider={type:"standard", id:"r1"}, P=2025-06-10T09:00Z, 300 хв, classic, S01 | обидві відповіді `total=25000`; другий запит не зменшується | `server.js:33` (виклик без `dayCap`) |

---

## Що варто звірити зі специфікацією (⚠)

1. **G10, G11** — «доба» для денного ліміту рахується за UTC (`day-cap.js:6-8`), а нічна знижка — за київським часом. Це може розходитися з тим, що очікує громада, особливо для поїздок біля півночі.
2. **H11** — пільговий райдер із безкоштовною поїздкою не отримує знижку на збір, бо знижка 0 не вибирає план `reduced`.
3. **L12** — сервіс по HTTP не веде облік ліміту по райдеру; ліміт діє лише на одну поїздку.
4. Побічно: у `quote` без ledger ліміт 30000 діє на кожну поїздку окремо (F01–F07), і це зроблено навмисно (`tariff.js:56`).
