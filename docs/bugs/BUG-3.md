# BUG-3: абонент на електровелосипеді отримує 45 безкоштовних хвилин

| Поле | Значення |
|---|---|
| **Правило специфікації** | T4 — «Електровелосипед: знижка 20 % на погодинне нарахування за T3. Безкоштовних хвилин на електровелосипеді немає.» `docs/spec/tariffs.md:76-77` |
| **Середовище** | `main` = `4606c72` (до виправлення, копія `../ws12-main`); після — коміт виправлення; Node v22.22.3; macOS (Darwin 25.6.0) |
| **Серйозність** | висока — кожна поїздка абонента на електровелосипеді: до 45 хв — 0 замість 32 грн, довші — знижка лише на «платні» блоки; систематична втрата виручки |
| **Частота** | завжди для `subscriber` + `ebike` (і для абонента з пільгою, коли через це обирається абонемент) |
| **Знайдено** | `app/test/spec/t4-t5-subscription-reduced.test.js` › `T4: TC-22 …`, `T4: TC-23 …`, `T5: TC-29 …` (`ai-runs/b2-run.txt`) |
| **Виправлення** | `fffb6af fix(T4): e-bike subscription is 20 % off the whole time charge, no free minutes` |

## Кроки відтворення

1. Абонент (`{ type: "subscriber" }`), електровелосипед, станція `S01`.
2. Взяття `2026-09-16T07:00:00Z`, повернення `2026-09-16T07:10:00Z` (10 хв).
3. Викликати `quote()`.

## Очікуваний результат (за специфікацією)

1 блок = 40 грн (T3, `:67`) − 20 % (T4, `:76`) → **`total: 3200`**.

## Фактичний результат

знижка `subscription` 4000, `total: 0`.

## Доказ

```bash
node -e 'import("./app/src/tariff.js").then(({ quote }) => console.log(JSON.stringify(quote({ pickupAt: "2026-09-16T07:00:00Z", returnAt: "2026-09-16T07:10:00Z", bike: "ebike", returnStation: "S01" }, { type: "subscriber" }))))'
```

До виправлення (`cd ../ws12-main && <та сама команда>`, код з `main`):

```text
{"minutes":10,"timeCharge":4000,"discounts":[{"code":"subscription","amount":4000}],"fees":[],"total":0}
```

Після виправлення (у репо):

```text
{"minutes":10,"timeCharge":4000,"discounts":[{"code":"subscription","amount":800}],"fees":[],"total":3200}
```

## Мінімальний вхід

Абонент + `ebike`, будь-яка тривалість > 2 хв. `bike: "classic"` — дефект зникає (45 безкоштовних хв там правильні).

## Додатково

Гіпотеза: `app/src/tariff.js:83-86` — безкоштовні 45 хв віднімаються для обох типів велосипедів. Наявний тест `app/test/unit/tariff.test.js` › `subscribers ride the first 45 minutes free` стверджував це й для `ebike` — оновлено. Тест з коду `ai-runs/b1-from-code/tariff.test.js` › `ebike: 20% off the paid blocks` зафіксував дефект.
