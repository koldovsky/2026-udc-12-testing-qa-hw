# BUG-4: пільговий тариф знижує й збори — 150 грн за повернення поза зоною стають 75 грн

| Поле | Значення |
|---|---|
| **Правило специфікації** | T5 — «Пільга не поширюється на збори (T7, T8)» (`docs/spec/tariffs.md:87`) |
| **Середовище** | `main` = `4606c72` (до виправлення); Node v22.14.0; Windows 11 Pro, Git Bash |
| **Серйозність** | висока. Громада недоотримує половину зборів від кожного пільговика, у якого спрацювала пільга: 75 грн за повернення поза зоною, 1 000 грн за неповернений велосипед (у разі T7 + T8 — 1 075 грн з однієї поїздки) |
| **Частота** | завжди, коли застосовано план «пільга» (пільговий, або абонент із правом на пільгу, якщо пільга вигідніша) і є збір |
| **Знайдено** | `app/test/spec/t04-t05-discounts.test.js` › `T5: TC-30 reduced fare does not apply to the out-of-zone fee: 2500 + 15000`, `T5: TC-31 reduced, classic 25 h …` (`ai-runs/b2-run.txt`) |
| **Виправлення** | `c7fcec5 fix(T5): the reduced fare no longer discounts fees` — збори з `feesFor` додаються без знижки (`app/src/tariff.js:63-64` після виправлення) |

## Кроки відтворення

1. `git archive main app | tar -x -C ../ws12-main && cd ../ws12-main`
2. Розрахувати поїздку пільгового користувача (`{ type: "reduced" }`), класичний, 16.09.2026 10:00 → 10:40 (Київ), повернення на `X01`.

## Очікуваний результат (за специфікацією)

2 блоки = 5000 − 50 % = 2500 (T5, `:93`) + збір T7 15000 без знижки (`:87`, `:112`) → **17500**.

## Фактичний результат

`fees: [{ code: "out-of-zone", amount: 7500 }]`, `total: 10000`.

## Доказ

```bash
node -e 'import("./app/src/tariff.js").then(({ quote }) => console.log(JSON.stringify(quote({ pickupAt: "2026-09-16T10:00:00+03:00", returnAt: "2026-09-16T10:40:00+03:00", bike: "classic", returnStation: "X01" }, { type: "reduced" }))))'
```

```text
# ../ws12-main (main, до виправлення)
{"minutes":40,"timeCharge":5000,"discounts":[{"code":"reduced","amount":2500}],"fees":[{"code":"out-of-zone","amount":7500}],"total":10000}
# репо після c7fcec5
{"minutes":40,"timeCharge":5000,"discounts":[{"code":"reduced","amount":2500}],"fees":[{"code":"out-of-zone","amount":15000}],"total":17500}
```

## Мінімальний вхід

Пільговий, поїздка 3 хв, повернення на `X01`. Якщо поїздка — хибний старт (≤ 2 хв), план «пільга» не обирається
(знижка 0), і збір нараховується повністю: дефект зникає. Тому на хибному старті його не видно.

## Додатково

- Місце в коді: `app/src/tariff.js:63-65` (до виправлення) — `plan.code === "reduced" ? … discount(fee.amount, REDUCED_PERCENT)`.
- Наявний тест `app/test/unit/tariff.test.js` › `reduced fare for a ride returned outside the zone` стверджував
  `total` 10000 і збір 7500. Оновлено за T5 — див. `docs/bugs/README.md`.
- Тести AI «з коду» `ai-runs/b1-from-code/tariff.test.js` › `reduced fare halves fees too` і
  `both fees together, halved for reduced` зафіксували цей дефект (`ai-runs/b1-rerun.txt`).
