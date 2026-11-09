- Інструмент і модель: Claude Code, Claude Opus 4.6
- Дата: 2026-11-09
- Що бачила сесія: тимчасова тека ../ws12-a1 з app/src/ (копія з main)
- Що було ввімкнено з пам'яті й глобальних правил: нічого
- Промпт (дослівно):

  > У цій теці — код сервісу, який рахує вартість поїздок велопрокату громади (app/src/).
  > Читай лише файли в app/src/.
  > Склади набір тест-кейсів для розрахунку вартості поїздки. Для кожного кейсу: ID; що
  > перевіряє; вхідні дані (усе, від чого залежить результат); очікуваний результат у
  > копійках; звідки взято це очікування.
  > Запиши відповідь у файл ai-runs/a1-from-code.md. Нічого іншого не створюй і не змінюй.
  > Уточнювальних питань не став; працюй з тим, що є.

---

# Тест-кейси для розрахунку вартості поїздки (з коду)

Прочитав файли: `app/src/tariff.js`, `app/src/day-cap.js`, `app/src/zones.js`, `app/src/receipt.js`, `app/src/kyiv-time.js`, `app/src/server.js`.

## Тест-кейси

| ID | Що перевіряє | Вхідні дані | Очікуваний результат (копійки) | Звідки |
|---|---|---|---|---|
| A1-01 | Тривалість: округлення хвилин (30 хв 20 с → 30 хв) | pickup 07:00:00Z, return 07:30:20Z, classic, S01, standard | minutes=30, timeCharge=2500, total=2500 | `tariff.js:71` — `Math.round` |
| A1-02 | Тривалість: рівно 60 хв | pickup 07:00:00Z, return 08:00:00Z, classic, S01, standard | minutes=60, timeCharge=5000, total=5000 | `tariff.js:71,74-75` |
| A1-03 | Хибний старт: 1 хв безкоштовно | pickup 07:00:00Z, return 07:01:00Z, classic, S01, standard | minutes=1, timeCharge=0, total=0 | `tariff.js:79` — `minutes < 2` → 0 |
| A1-04 | Хибний старт: 2 хв нараховуються | pickup 07:00:00Z, return 07:02:00Z, classic, S01, standard | minutes=2, timeCharge=2500, total=2500 | `tariff.js:79` — `2 < 2` = false → blocks(2)=1 → 2500 |
| A1-05 | E-bike тариф: 75 хв | pickup 07:00:00Z, return 08:15:00Z, ebike, S01, standard | minutes=75, timeCharge=12000, total=12000 | `tariff.js:18` — RATES.ebike=4000, blocks(75)=3 |
| A1-06 | Абонемент classic: 40 хв безкоштовно | pickup 07:00:00Z, return 07:40:00Z, classic, S01, subscriber | minutes=40, total=0 | `tariff.js:84` — 40−45 < 0 → charge=0 |
| A1-07 | Абонемент classic: 100 хв → 55 платних | pickup 07:00:00Z, return 08:40:00Z, classic, S01, subscriber | minutes=100, total=5000 | `tariff.js:84` — 100−45=55 → blocks(55)=2 → 5000 |
| A1-08 | Абонемент ebike: 40 хв безкоштовно | pickup 07:00:00Z, return 07:40:00Z, ebike, S01, subscriber | minutes=40, total=0 | `tariff.js:84` — 40−45 < 0 → charge=0, потім −20% |
| A1-09 | Абонемент ebike: 100 хв зі знижкою 20% | pickup 07:00:00Z, return 08:40:00Z, ebike, S01, subscriber | minutes=100, discount=subscription, total < 12000 | `tariff.js:84-85` — 100−45=55 → blocks(55)=2 → 8000 − 20% = 6400 |
| A1-10 | Пільговий: 50% знижка на погодинне | pickup 07:00:00Z, return 07:40:00Z, classic, S01, reduced | minutes=40, total=2500 | `tariff.js:94-96` — timeCharge=5000, −50% = 2500 |
| A1-11 | Пільговий: знижка на збори теж | pickup 07:00:00Z, return 07:40:00Z, classic, X01, reduced | total=10000 | `tariff.js:63-64` — timeCharge=5000−50%=2500, fee out-of-zone=15000−50%=7500, total=10000 |
| A1-12 | Нічна знижка: 30% | pickup 22:10:00Z (01:10 Kyiv), return 22:40:00Z (01:40 Kyiv), classic, S01, standard | total=1750 | `tariff.js:50-51` — hour < 6 → −30% |
| A1-13 | Повернення поза зоною: збір 150 грн | pickup 07:00:00Z, return 07:20:00Z, classic, X02, standard | fees=[{out-of-zone, 15000}], total=17500 | `tariff.js:107` |
| A1-14 | Неповернений велосипед: збір 2000 грн | pickup 07:00:00Z, return +25 год, classic, S01, standard | fees=[{unreturned, 200000}], total > 200000 | `tariff.js:108` |
| A1-15 | Обидва збори: поза зоною і неповернений | pickup 07:00:00Z, return +48 год, classic, X03, standard | fees.length=2 | `tariff.js:107-108` |
| A1-16 | Денний ліміт: 300 грн | три поїздки ebike по 80 хв за одну добу, standard | третя поїздка обмежена, сума ≤ 30000 | `day-cap.js:3` — DAY_CAP=30000 |
| A1-17 | День визначається за UTC | pickup 23:30:00Z (02:30 Kyiv), standard | dayKey = дата за UTC | `day-cap.js:7` — toISOString().slice(0,10) |
| A1-18 | Валідація: returnAt < pickupAt → помилка | return перед pickup | QuoteError: "returnAt is before pickupAt" | `tariff.js:116` |
| A1-19 | Валідація: невідомий bike → помилка | bike: "scooter" | QuoteError: "unknown bike type: scooter" | `tariff.js:117` |
| A1-20 | Валідація: невідома станція → помилка | returnStation: "Z99" | QuoteError: "unknown station: Z99" | `tariff.js:119` |
| A1-21 | Абонент з пільгою: менший варіант | pickup 07:00:00Z, return 08:20:00Z, classic, S01, subscriber+concession | subscriber: 80−45=35→blocks(35)=2→5000; reduced: blocks(80)=3→7500−50%=3750 → reduced менше | `tariff.js:89-97` |
| A1-22 | Знижка round down (T9): kopecks | discount(1235, 30) → 1235 − floor(1235×70/100) = 1235 − 864 = 371 | `tariff.js:101-102` |
| A1-23 | Чек формат: суми в UAH | formatUah(230000) → "2 300,00 грн" | `receipt.js:15-21` |
