# Матриця трасування: правила → тест-кейси → автотести

Джерело вимог — [специфікація тарифів v3](spec/tariffs.md). ID посилаються на [тест-кейси](test-cases.md). Кожен TC-01–TC-37 має тест у `app/test/spec/tariffs.test.js`; нижче наведено точні назви ключових автотестів для кожного правила. Результат першого прогону — `ai-runs/b2-run.txt`; після виправлень `npm test` — 57/57.

| Правило | Коротко | Тест-кейси | Автотести (файл › назва) | Статус | Примітка |
|---|---|---|---|---|---|
| T1 | Фактична тривалість, округлення вгору | TC-01, TC-02, TC-03, TC-05, TC-09, TC-32 | `app/test/spec/tariffs.test.js` › `T1, T3: TC-02 30 minutes and one second`; `T1: TC-32 invalid request is rejected with an explanation` | покрито | 12:40 → 13 хв, 30:01 → 31 хв; некоректний порядок часу |
| T2 | До 2 хв без погодинної плати | TC-03, TC-04, TC-05, TC-24 | `app/test/spec/tariffs.test.js` › `T2: TC-04 exactly two minutes`; `T7, T2: TC-24 false start still pays zone fee` | покрито | Межа 2 хв; збір поза зоною лишається |
| T3 | Блоки по 30 хв, ставки 2500/4000 | TC-01, TC-02, TC-05, TC-06, TC-07, TC-17, TC-33 | `app/test/spec/tariffs.test.js` › `T3: TC-06 exactly one classic block`; `T3: TC-07 three electric blocks` | покрито | Обидва типи велосипеда й межа блока |
| T4 | Абонемент: 45 хв класичного або 20 % електро | TC-08, TC-09, TC-10, TC-11, TC-13, TC-14, TC-15 | `app/test/spec/tariffs.test.js` › `T4: TC-08 45 subscription minutes`; `T4: TC-11 electric subscription has no free minutes` | покрито | Поєднання з T10 — Q-3 |
| T5 | Пільга 50 %, вибір із абонементом | TC-12, TC-13, TC-14, TC-15, TC-16, TC-34 | `app/test/spec/tariffs.test.js` › `T5, T4: TC-14 subscription wins a tie`; `T5, T7: TC-16 student pays the full zone fee` | покрито | Пільга не зменшує збір; поєднання з T10 — Q-3 |
| T6 | 30000 коп. на користувача і київську дату взяття | TC-17, TC-18, TC-19, TC-20, TC-21, TC-22, TC-25, TC-26, TC-27, TC-36, TC-37 | `app/test/spec/tariffs.test.js` › `T6: TC-18 daily ledger by rider and Kyiv pickup date`; `T6, T10: TC-36 daily ledger by rider and Kyiv pickup date`; `T6, T10: TC-37 daily ledger by rider and Kyiv pickup date` | покрито | Частковий залишок, нова дата, перетин півночі, незалежні користувачі, різниця Kyiv/UTC |
| T7 | Збір 15000 поза зоною | TC-16, TC-19, TC-23, TC-24, TC-27, TC-30, TC-35 | `app/test/spec/tariffs.test.js` › `T7: TC-23 outside-zone return`; `T5, T7: TC-16 student pays the full zone fee` | покрито | Не зменшується пільгою, нічною знижкою або лімітом |
| T8 | Понад 24 год + 200000 коп., незалежно від T7 | TC-25, TC-26, TC-27, TC-28 | `app/test/spec/tariffs.test.js` › `T8, T6: TC-25 exactly 24 hours`; `T8, T7, T6: TC-27 both independent fees` | покрито | Межа 24 год, обидва збори |
| T9 | Цілі копійки, формат і рядки чека | TC-28 | `app/test/spec/tariffs.test.js` › `T9, T8: TC-28 integer kopecks and itemised receipt` | частково | Досяжний чек перевірено; приклад дробової копійки T9 не задає досяжної поїздки; Q-4, Q-5 |
| T10 | Нічна знижка 30 % | TC-29, TC-30, TC-31, TC-36, TC-37 | `app/test/spec/tariffs.test.js` › `T10: TC-29 fully nighttime ride`; `T10, T7: TC-30 night discount excludes fee` | частково | Однозначна повністю нічна поїздка; перетини і поєднання — Q-1–Q-5 |

## Підсумок

- Правил із принаймні одним тест-кейсом: **10 з 10**; повністю покрито однозначну частину 8 правил, T9 і T10 частково.
- Правил із принаймні одним автотестом: **10 з 10**; T9 і T10 частково через описані межі специфікації.
- Відкриті питання: **Q-1–Q-5** (Q-5 додано за наслідками Task C). Спірні комбінації не автоматизувати до відповіді власника продукту; перевіряти лише однозначну частину.
