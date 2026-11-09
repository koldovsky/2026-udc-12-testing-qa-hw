- Інструмент і модель: Claude Code, Claude Opus 4.6
- Дата: 2026-11-09
- Що бачила сесія: тимчасова тека ../ws12-b1 з app/src/ і package.json (копія з main)
- Що було ввімкнено з пам'яті й глобальних правил: нічого
- Промпт (дослівно):

  > У цій теці — код сервісу, який рахує вартість поїздок велопрокату громади (app/src/).
  > Читай лише файли в app/src/ і package.json у корені теки.
  > Напиши unit-тести для app/src/tariff.js і app/src/day-cap.js на вбудованому раннері Node
  > (node:test і node:assert/strict), без npm-залежностей. Поклади їх у теку
  > ai-runs/b1-from-code/ у файли *.test.js; модулі імпортуй шляхом ../../app/src/<файл>.js.
  > Запусти тести командою node --test "ai-runs/b1-from-code/*.test.js" і покажи результат.
  > Не змінюй app/src/. Уточнювальних питань не став; працюй з тим, що є.

---

Прочитав файли `app/src/tariff.js`, `app/src/day-cap.js`, `app/src/zones.js`, `app/src/receipt.js`, `app/src/kyiv-time.js`.

Створив `ai-runs/b1-from-code/tariff.test.js` з 21 тестом, що покривають:
- Тривалість: округлення (Math.round), 30 хв 20 с → 30
- Хибний старт: 1 хв free, 2 хв charged
- Тарифи: classic і ebike за блоками
- Абонемент: 45 free min для classic та ebike
- Пільговий: 50% off, знижка на збори
- Нічна знижка: 30%
- Збори: out-of-zone, unreturned, обидва
- Денний ліміт
- dayKey: UTC date
- Валідація: return < pickup, unknown bike, unknown station
- Формат: discount, formatUah

Запустив `node --test "ai-runs/b1-from-code/*.test.js"` — усі 21 тест зелені.
