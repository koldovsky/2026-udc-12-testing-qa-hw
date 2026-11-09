# BUG-1: Тривалість поїздки округлюється до найближчого, а не вгору

| Поле | Значення |
|---|---|
| **Правило специфікації** | T1 — «Неповна хвилина рахується як повна: тривалість округлюється вгору до цілих хвилин.» `docs/spec/tariffs.md:46` |
| **Середовище** | `e604ebc`, Node v25.3.0, Darwin 25.6.0 |
| **Серйозність** | висока — занижує тривалість і, як наслідок, вартість поїздки для кожного користувача з неповною хвилиною |
| **Частота** | завжди, коли тривалість має неповну хвилину |
| **Знайдено** | `app/test/spec/tariff.test.js` › `T1: 30 min 20 sec → 31 minutes (rounded up)` та `ai-runs/b2-run.txt:13` |
| **Виправлення** | `e604ebc fix(T1): use Math.ceil for ride duration rounding` |

## Кроки відтворення

1. Викликати `quote()` з поїздкою тривалістю 30 хв 20 с (pickup 07:00:00, return 07:30:20).
2. Подивитися значення `minutes` у результаті.

## Очікуваний результат (за специфікацією)

`minutes = 31` — за T1 (`docs/spec/tariffs.md:46`) неповна хвилина рахується як повна, тобто `ceil(30.333) = 31`.

## Фактичний результат

`minutes = 30` — код використовував `Math.round`, який округлює 30.333 до 30.

## Доказ

```bash
mkdir -p ../ws12-main && git archive main app | tar -x -C ../ws12-main
node -e 'import("../ws12-main/app/src/tariff.js").then(({ quote }) => console.log(JSON.stringify(quote({ pickupAt: "2026-09-16T07:00:00Z", returnAt: "2026-09-16T07:30:20Z", bike: "classic", returnStation: "S01" }, { type: "standard" }))))'
```

```text
{"minutes":30,"timeCharge":2500,"discounts":[],"fees":[],"total":2500}
```

## Мінімальний вхід

Будь-яка поїздка з неповною хвилиною. Мінімальний: 30 хв 1 с (30:01) — `Math.round(30.0167) = 30`, а `Math.ceil = 31`. Якщо тривалість ціла (30:00) — дефект не проявляється.

## Додатково

Рядок `app/src/tariff.js:69`: було `Math.round(...)`, виправлено на `Math.ceil(...)`. Наявний тест `app/test/unit/tariff.test.js` › `a ride of 30 min 20 s is billed as one block` стверджував хибну поведінку — оновлено в коміті `8fe1d20`.
