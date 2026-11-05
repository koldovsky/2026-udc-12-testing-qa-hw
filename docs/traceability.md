# Матриця трасування: правила → тест-кейси → автотести

> Task A (тест-кейси з `docs/test-cases.md`) і Task B (автотести з `app/test/spec/`).

| Правило | Коротко | Тест-кейси | Автотести (файл › назва) | Статус | Примітка |
|---|---|---|---|---|---|
| T1 | тривалість — фактичний час, хвилини вгору | TC-01…TC-05 | `app/test/spec/t01-t03-duration-and-hourly.test.js` › `T1: TC-01 10:00:00–10:12:40 → 13 min, 1 block`, `T1: TC-02 …`, `T1: TC-03 30 min 20 s → 31 min, 2 blocks`, `T1: TC-04 exactly 30 min → 1 block`, `T1: TC-05 return 1 s before pickup is rejected …` (5) | покрито | TC-05 — §4 (повернення раніше взяття) |
| T2 | ≤ 2 хв — без погодинного; збори T7 — так | TC-06…TC-10 | `app/test/spec/t01-t03-duration-and-hourly.test.js` › `T2: TC-06 50 s → 1 min → 0`, `T2: TC-07 exactly 2:00 → 2 min → 0`, `T2: TC-08 2:01 → 3 min → 1 block`, `T2: TC-09 3:00 → 3 min → 1 block`, `T2: TC-10 false start returned out of zone …` (5) | покрито | — |
| T3 | блок 30 хв: класичний 25 грн, електро 40 грн | TC-11…TC-15 | `app/test/spec/t01-t03-duration-and-hourly.test.js` › `T3: TC-11 classic 50 min → 2 blocks`, `T3: TC-12 e-bike 75 min → 3 blocks`, `T3: TC-13 classic 60 min / 61 min …`, `T3: TC-14 e-bike 30 min / 31 min …`, `T3: TC-15 unknown bike type …` (7) | покрито | TC-15 — §4 (невідомий велосипед) |
| T4 | абонемент: класичний — 45 хв безкоштовно; електро — −20 % | TC-16…TC-23 | `app/test/spec/t04-t05-discounts.test.js` › `T4: TC-16 subscriber, classic 40 min → 0` … `T4: TC-22 subscriber, e-bike 75 min → 12000 − 20 %`, `T4: TC-23 unknown rider category …` (9) | покрито | TC-23 — §4 (невідома категорія) |
| T5 | пільга −50 %; не на збори; з абонементом — менша сума, при рівності абонемент | TC-24…TC-31 | `app/test/spec/t04-t05-discounts.test.js` › `T5: TC-24 reduced, classic 40 min → 5000 − 50 %` … `T5: TC-29 …`, `T5: TC-27 equal amounts → the subscription is applied`, `T5: TC-30 reduced fare does not apply to the out-of-zone fee …`, `T5: TC-31 reduced, classic 25 h …` (9) | покрито | поєднання з нічною — Q-2, Q-3 (не автоматизовано) |
| T6 | ліміт 300 грн на добу (Київ) за датою взяття; збори поза лімітом | TC-32…TC-37 | `app/test/spec/t06-day-cap.test.js` › `T6: TC-32 three 80-min e-bike rides on one day: 12000, 12000, 6000` … `T6: TC-37 standard, classic, 25 h …` (6) | покрито | порядок заповнення ліміту — Q-6 (не автоматизовано) |
| T7 | повернення поза зоною — збір 150 грн | TC-38…TC-41 | `app/test/spec/t07-t08-fees.test.js` › `T7: TC-38 classic 20 min returned to X01 → 17500`, `T7: TC-39 … X02 / X03`, `T7: TC-40 … S01…S08 → 2500` (8 рядків таблиці), `T7: TC-41 station S09 … is rejected …` (12) | покрито | TC-41 — §4 (невідома станція) |
| T8 | понад 24 год — збір 2 000 грн; T7 і T8 разом | TC-42…TC-45 | `app/test/spec/t07-t08-fees.test.js` › `T8: TC-42 classic exactly 24:00:00 → no fee`, `T8: TC-43 classic 24:00:01 → fee 200000`, `T8: TC-44 classic 25 h → 30000 + 200000`, `T8: TC-45 classic 25 h returned to X03 → both fees` (4) | покрито | — |
| T9 | копійки, округлення вниз; формат чека | TC-46…TC-49 | `app/test/spec/t09-t10-receipt-night.test.js` › `T9: TC-46 30 % off 1235 kopecks → 864 to pay, discount 371`, `T9: TC-47 receipt for a 25 h ride …`, `T9: TC-48 receipt for the night ride …`, `T9: TC-49 receipt for 20 min out of zone …` (4) | частково | рядки чека абонента — Q-5; округлення при кількох знижках — Q-4 |
| T10 | нічна знижка 30 % (00:00–06:00) | TC-50…TC-53 | `app/test/spec/t09-t10-receipt-night.test.js` › `T10: TC-50 00:00–00:30 → 1750`, `T10: TC-51 06:00–06:30 → 2500`, `T10: TC-52 e-bike 01:00–02:15 → 12000 − 30 %`, `T10: TC-53 01:10–01:40 → 1750` (4) | частково | лише поїздки, що повністю вночі, і лише стандартний користувач; решта — Q-1, Q-2 |

## Підсумок

- Правил покрито тест-кейсами: 10 з 10
- Правил покрито автотестами: 10 з 10 (65 тестів у `app/test/spec/`; T9 і T10 — частково, див. питання)
- Відкриті питання:
  - Q-1, Q-2, Q-3 (нічна знижка: частково нічні поїздки, поєднання з T4/T5, порівняння в T5) — не автоматизовано;
  - Q-4 (округлення при кількох знижках) — не автоматизовано; T9 перевірено лише на одній знижці (TC-46);
  - Q-5 (рядки чека абонента) — не автоматизовано; чек перевірено лише для стандартного користувача;
  - Q-6 (порядок заповнення ліміту) — автоматизовано лише однозначну частину: поїздки в порядку взяття (TC-32).
