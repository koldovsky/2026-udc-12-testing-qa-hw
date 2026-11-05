# BUG-3: абонент на електровелосипеді отримує 45 безкоштовних хвилин — короткі поїздки безкоштовні

| Поле | Значення |
|---|---|
| **Правило специфікації** | T4 — «Електровелосипед: знижка 20 % на погодинне нарахування за T3. Безкоштовних хвилин на електровелосипеді немає» (`docs/spec/tariffs.md:76-77`) |
| **Середовище** | `main` = `4606c72` (до виправлення); Node v22.14.0; Windows 11 Pro, Git Bash |
| **Серйозність** | висока. Кожна поїздка абонента на електровелосипеді недоплачена: до 45 хв — безкоштовна замість 32 грн за блок; довші — на 1–2 блоки дешевші. Для абонента з правом на пільгу через це ще й обирає абонемент замість вигіднішої за специфікацією пільги (тест `T5: TC-29`) |
| **Частота** | завжди: абонент + електровелосипед |
| **Знайдено** | `app/test/spec/t04-t05-discounts.test.js` › `T4: TC-21 subscriber, e-bike 40 min → 8000 − 20 %`, `T4: TC-22 subscriber, e-bike 75 min → 12000 − 20 %`, `T5: TC-29 subscriber+concession, e-bike 40 min …` (`ai-runs/b2-run.txt`) |
| **Виправлення** | `f9bb9b1 fix(T4): e-bike subscription is 20 % off, without free minutes` — для електровелосипеда `subscriptionCharge` бере повне нарахування T3 і знімає 20 % (`app/src/tariff.js:82-86` після виправлення) |

## Кроки відтворення

1. `git archive main app | tar -x -C ../ws12-main && cd ../ws12-main`
2. Розрахувати поїздку абонента (`{ type: "subscriber" }`) на електровелосипеді, 16.09.2026 10:00 → 10:40 (Київ), `S01`.

## Очікуваний результат (за специфікацією)

40 хв → 2 блоки × 40 грн = 8000 (T3, `:62-67`); абонемент на електровелосипеді — −20 % без безкоштовних
хвилин (`:76-77`) → знижка 1600, **до сплати 6400**.

## Фактичний результат

`discounts: [{ code: "subscription", amount: 8000 }]`, `total: 0`.

## Доказ

```bash
node -e 'import("./app/src/tariff.js").then(({ quote }) => console.log(JSON.stringify(quote({ pickupAt: "2026-09-16T10:00:00+03:00", returnAt: "2026-09-16T10:40:00+03:00", bike: "ebike", returnStation: "S01" }, { type: "subscriber" }))))'
```

```text
# ../ws12-main (main, до виправлення)
{"minutes":40,"timeCharge":8000,"discounts":[{"code":"subscription","amount":8000}],"fees":[],"total":0}
# репо після f9bb9b1
{"minutes":40,"timeCharge":8000,"discounts":[{"code":"subscription","amount":1600}],"fees":[],"total":6400}
```

## Мінімальний вхід

Абонент, електровелосипед, будь-яка тривалість від 3 хв (не хибний старт). Класичний велосипед — дефекту немає.

## Додатково

- Місце в коді: `app/src/tariff.js:84` (до виправлення) — `blocks(Math.max(0, minutes - SUBSCRIPTION_FREE_MINUTES))` для обох типів велосипедів.
- Наявний тест `app/test/unit/tariff.test.js` › `subscribers ride the first 45 minutes free` стверджував 0 для
  електровелосипеда. Оновлено за T4 — див. `docs/bugs/README.md`.
- Тест AI «з коду» `ai-runs/b1-from-code/tariff.test.js` › `ebike gets an extra 20% off the billable part`
  зафіксував цей дефект (`ai-runs/b1-rerun.txt`).
