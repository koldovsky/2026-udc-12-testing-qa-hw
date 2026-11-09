# BUG-5: Денний ліміт рахує дату за UTC, а не за київським часом

| Поле | Значення |
|---|---|
| **Правило специфікації** | T6 — «Поїздка належить до тієї доби, на яку припадає момент її взяття за київським часом» `docs/spec/tariffs.md:101` |
| **Середовище** | `4ee27ab`, Node v25.3.0, Darwin 25.6.0 |
| **Серйозність** | середня — ліміт хибно зараховує поїздки до іншої доби вночі; зачіпає лише поїздки між 00:00 і 03:00 за Києвом |
| **Частота** | за умови — коли UTC-дата і Kyiv-дата різняться (взяття між 00:00 і 02:59 Kyiv літом або 00:00–01:59 зимою) |
| **Знайдено** | `app/test/unit/day-cap.test.js` › `the day of a ride is the Kyiv date of its pickup` та `app/test/spec/tariff.test.js` › `T6: ride pickup at 23:40 Kyiv → belongs to that Kyiv date` |
| **Виправлення** | `4ee27ab fix(T6): dayKey must use Kyiv timezone, not UTC` |

## Кроки відтворення

1. Викликати `dayKey("2026-09-16T22:00:00Z")` — це 01:00 17.09 за Києвом (UTC+3 влітку).
2. Подивитися результат.

## Очікуваний результат (за специфікацією)

`"2026-09-17"` — за T6 (`docs/spec/tariffs.md:37,101`) доба визначається за київським часом. 22:00 UTC = 01:00 Kyiv 17.09.

## Фактичний результат

`"2026-09-16"` — код використовував `toISOString()`, що повертає UTC-дату.

## Доказ

```bash
node -e 'import("../ws12-main/app/src/day-cap.js").then(({ dayKey }) => console.log(dayKey("2026-09-16T22:00:00Z")))'
```

```text
2026-09-16
```

## Мінімальний вхід

`dayKey("2026-09-16T22:00:00Z")` — UTC 22:00 = Kyiv 01:00 наступного дня. Якщо взяти `dayKey("2026-09-16T08:00:00Z")` — UTC і Kyiv в одній добі, баг не проявляється.

## Додатково

Рядок `app/src/day-cap.js:7`: було `new Date(pickupAt).toISOString().slice(0, 10)`, виправлено на `Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" })`. Наявний тест `app/test/unit/day-cap.test.js` › `the day of a ride is the Kyiv date of its pickup` — оновлено в `8fe1d20` з додатковим assert для нічного часу.
