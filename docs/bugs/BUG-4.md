# BUG-4: пільговий тариф зменшує вдвічі збори за повернення поза зоною і за неповернений велосипед

| Поле | Значення |
|---|---|
| **Правило специфікації** | T5 — «Пільга не поширюється на збори (T7, T8).» `docs/spec/tariffs.md:87` |
| **Середовище** | `main` = `4606c72` (до виправлення, копія `../ws12-main`); після — коміт виправлення; Node v22.22.3; macOS (Darwin 25.6.0) |
| **Серйозність** | висока — пільговик (і абонент із пільгою, коли обрано пільгу) платить 75 грн замість 150 грн за T7 і 1 000 грн замість 2 000 грн за T8 |
| **Частота** | завжди, коли застосовано знижку `reduced` і є збір |
| **Знайдено** | `app/test/spec/t4-t5-subscription-reduced.test.js` › `T5, T7: TC-30 …`, `T5, T7: TC-31 …`; `app/test/spec/t7-t8-fees.test.js` › `T8, T5: TC-47 …`; `app/test/spec/t9-amounts-receipt.test.js` › `T9: TC-51 …` (`ai-runs/b2-run.txt`) |
| **Виправлення** | `d0cda4a fix(T5): reduced fare does not apply to out-of-zone and unreturned fees` |

## Кроки відтворення

1. Пільговий користувач (`{ type: "reduced" }`), класичний велосипед.
2. Взяття `2026-09-16T07:00:00Z`, повернення `2026-09-16T07:20:00Z` на станцію `X02` (поза зоною).
3. Викликати `quote()`.

## Очікуваний результат (за специфікацією)

25 грн − 50 % = 12,50 грн (T5, `:86`) + збір 150 грн без знижки (T7, `:112`; T5, `:87`) → **`total: 16250`**, збір `15000`.

## Фактичний результат

збір `out-of-zone` = `7500`, `total: 8750`.

## Доказ

```bash
node -e 'import("./app/src/tariff.js").then(({ quote }) => console.log(JSON.stringify(quote({ pickupAt: "2026-09-16T07:00:00Z", returnAt: "2026-09-16T07:20:00Z", bike: "classic", returnStation: "X02" }, { type: "reduced" }))))'
```

До виправлення (`cd ../ws12-main && <та сама команда>`, код з `main`):

```text
{"minutes":20,"timeCharge":2500,"discounts":[{"code":"reduced","amount":1250}],"fees":[{"code":"out-of-zone","amount":7500}],"total":8750}
```

Після виправлення (у репо):

```text
{"minutes":20,"timeCharge":2500,"discounts":[{"code":"reduced","amount":1250}],"fees":[{"code":"out-of-zone","amount":15000}],"total":16250}
```

## Мінімальний вхід

Пільговий + будь-який збір. `returnStation: "S01"` або `type: "standard"` — дефект зникає.

## Додатково

Гіпотеза: `app/src/tariff.js:63-65` — збори множаться на 50 %, коли план `reduced`. Наявний тест `app/test/unit/tariff.test.js` › `reduced fare for a ride returned outside the zone` стверджував `total 10000`, збір `7500` — оновлено. Тест з коду `ai-runs/b1-from-code/tariff.test.js` › `reduced plan halves fees` зафіксував дефект.
