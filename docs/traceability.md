# Матриця трасування: правила → тест-кейси → автотести

| Правило | Коротко | Тест-кейси | Автотести (файл › назва) | Статус | Примітка |
|---|---|---|---|---|---|
| T1 | Тривалість: ceil до цілих хвилин | TC-01, TC-02, TC-03, TC-04 | `app/test/spec/tariff.test.js` › `T1: 10:00:00 → 10:12:40 = 13 minutes (ceil)`, `T1: 14:05:00 → 14:41:00 = 36 minutes`, `T1: 30 min 20 sec → 31 minutes (rounded up)`, `T1: exactly 30 min → 30 minutes, 1 block` | покрито | BUG-1 виправлено (`e604ebc`) |
| T2 | Хибний старт ≤ 2 хв безкоштовно | TC-05, TC-06, TC-07, TC-08 | `app/test/spec/tariff.test.js` › `T2: 50 sec ride (1 min after ceil) → free`, `T2: exactly 2 min → free (≤2)`, `T2: 2 min 1 sec → 3 min (ceil) → 1 block = 2500`, `T2: false start with out-of-zone still charges fee` | покрито | BUG-2 виправлено (`c55b738`) |
| T3 | Погодинне нарахування за блоками по 30 хв | TC-09, TC-10, TC-11, TC-12, TC-13, TC-14 | `app/test/spec/tariff.test.js` › `T3: classic 50 min → 2 blocks = 5000`, `T3: ebike 75 min → 3 blocks = 12000`, `T3: classic 30 min → 1 block = 2500`, `T3: classic 31 min → 2 blocks = 5000`, `T3: classic 60 min → 2 blocks = 5000`, `T3: classic 61 min → 3 blocks = 7500` | покрито | — |
| T4 | Абонемент: classic 45 free min, ebike 20% off | TC-15, TC-16, TC-17, TC-18, TC-19, TC-20 | `app/test/spec/tariff.test.js` › `T4: subscriber classic 40 min → free (first 45 min)`, `T4: subscriber classic 100 min → 55 paid → 2 blocks = 5000`, `T4: subscriber classic 45 min → free (boundary)`, `T4: subscriber classic 46 min → 1 paid → 1 block = 2500`, `T4: subscriber ebike 40 min → … 6400 (no free minutes)`, `T4: subscriber ebike 75 min → … 9600` | покрито | BUG-3 виправлено (`c3c50a1`) |
| T5 | Пільга 50% на час, не на збори | TC-21, TC-22, TC-23, TC-24 | `app/test/spec/tariff.test.js` › `T5: reduced classic 40 min → 5000 − 50% = 2500`, `T5: reduced fare does NOT apply to out-of-zone fee`, `T5: subscriber+concession classic 80 min → reduced 3750 < subscription 5000`, `T5: subscriber+concession classic 46 min → equal → subscription wins` | покрито | BUG-4 виправлено (`6aabec8`) |
| T6 | Денний ліміт 300 грн, доба за Києвом | TC-25, TC-26, TC-27 | `app/test/spec/tariff.test.js` › `T6: 3 ebike rides of 80 min → capped at 30000`, `T6: ride pickup at 23:40 Kyiv → belongs to that Kyiv date`, `T6: fees are not limited by the daily cap` | покрито | BUG-5 виправлено (`4ee27ab`) |
| T7 | Збір за повернення поза зоною 150 грн | TC-28, TC-29 | `app/test/spec/tariff.test.js` › `T7: classic 20 min X02 → 2500 + 15000 = 17500`, `T7: classic 20 min S03 (in zone) → no fee` | покрито | — |
| T8 | Збір за неповернений велосипед > 24 год | TC-30, TC-31, TC-32, TC-33 | `app/test/spec/tariff.test.js` › `T8: classic 25 hours → capped time + 200000 = 230000`, `T8: exactly 24 hours (1440 min) → no unreturned fee`, `T8: 24 hours 1 min (1441 min) → unreturned fee`, `T8: >24h + out-of-zone → both fees` | покрито | — |
| T9 | Округлення вниз до копійки, формат грн | TC-34, TC-35, TC-36 | `app/test/spec/tariff.test.js` › `T9: discount rounds down (in user's favor)`, `T9: formatUah 230000 → '2 300,00 грн'`, `T9: formatUah -2500 → '-25,00 грн'` | покрито | — |
| T10 | Нічна знижка 30% (00:00–06:00) | TC-37, TC-38, TC-39 | `app/test/spec/tariff.test.js` › `T10: classic 01:10→01:40 Kyiv → 2500 − 30% = 1750`, `T10: pickup at 05:59 Kyiv → night discount applies`, `T10: pickup at 06:00 Kyiv → no night discount` | покрито | — |

## Підсумок

- Правил покрито тест-кейсами: 10 з 10
- Правил покрито автотестами: 10 з 10
- Відкриті питання: Q-1 (нічна за часом взяття чи поїздки), Q-2 (T5+T10 підсумовуються?), Q-3 (ліміт до/після T10), Q-4 (0 хв поїздка) — не автоматизовано, бо специфікація не дає однозначної відповіді; автоматизовано лише однозначну частину кожного правила
