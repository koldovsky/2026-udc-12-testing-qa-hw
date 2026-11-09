# BUG-3: Абонемент на електровелосипед дає 45 безкоштовних хвилин замість 20% знижки

| Поле | Значення |
|---|---|
| **Правило специфікації** | T4 — «Електровелосипед: знижка 20 % на погодинне нарахування за T3. Безкоштовних хвилин на електровелосипеді немає.» `docs/spec/tariffs.md:76-77` |
| **Середовище** | `c3c50a1`, Node v25.3.0, Darwin 25.6.0 |
| **Серйозність** | критична — абонент на e-bike їздить безкоштовно до 45 хв замість сплати зі знижкою; прямі фінансові втрати |
| **Частота** | завжди для абонентів на e-bike |
| **Знайдено** | `app/test/spec/tariff.test.js` › `T4: subscriber ebike 40 min → 2 blocks × 4000 = 8000 − 20% = 6400 (no free minutes)` та `ai-runs/b2-run.txt:29` |
| **Виправлення** | `c3c50a1 fix(T4): ebike subscription has no free minutes, only 20% discount` |

## Кроки відтворення

1. Викликати `quote()` з поїздкою: абонемент, e-bike, 40 хв, станція S01.
2. Подивитися `total` у результаті.

## Очікуваний результат (за специфікацією)

`total = 6400` — 2 блоки × 4000 = 8000, знижка 20% = 1600, до сплати 6400. За T4 (`docs/spec/tariffs.md:76-77`) безкоштовних хвилин на e-bike немає.

## Фактичний результат

`total = 0` — код давав e-bike ті самі 45 безкоштовних хвилин, що й classic.

## Доказ

```bash
node -e 'import("../ws12-main/app/src/tariff.js").then(({ quote }) => console.log(JSON.stringify(quote({ pickupAt: "2026-09-16T07:00:00Z", returnAt: "2026-09-16T07:40:00Z", bike: "ebike", returnStation: "S01" }, { type: "subscriber" }))))'
```

```text
{"minutes":40,"timeCharge":8000,"discounts":[{"code":"subscription","amount":8000}],"fees":[],"total":0}
```

## Мінімальний вхід

Абонемент, ebike, будь-яка тривалість ≤ 45 хв. При 40 хв: очікуване 6400, фактичне 0.

## Додатково

Рядок `app/src/tariff.js:81-87`: функція `subscriptionCharge` обробляла e-bike так само, як classic (45 free min). Виправлення: для e-bike — повна оплата мінус 20%, без безкоштовних хвилин. Наявний тест `app/test/unit/tariff.test.js` › `subscribers ride the first 45 minutes free` тестував ebike в циклі і стверджував хибну поведінку — оновлено в `8fe1d20`.
