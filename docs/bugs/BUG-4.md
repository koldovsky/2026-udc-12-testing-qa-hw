# BUG-4: Пільгова знижка 50% застосовується до зборів

| Поле | Значення |
|---|---|
| **Правило специфікації** | T5 — «Пільга не поширюється на збори (T7, T8).» `docs/spec/tariffs.md:87` |
| **Середовище** | `6aabec8`, Node v25.3.0, Darwin 25.6.0 |
| **Серйозність** | висока — збір за повернення поза зоною зменшується вдвічі (з 150 до 75 грн); фінансові втрати |
| **Частота** | завжди для пільгових з out-of-zone або unreturned fee |
| **Знайдено** | `app/test/spec/tariff.test.js` › `T5: reduced fare does NOT apply to out-of-zone fee` та `ai-runs/b2-run.txt:32` |
| **Виправлення** | `6aabec8 fix(T5): reduced fare discount must not apply to fees` |

## Кроки відтворення

1. Викликати `quote()` з поїздкою: пільговий, classic, 40 хв, повернення на X01 (поза зоною).
2. Подивитися `fees[0].amount` у результаті.

## Очікуваний результат (за специфікацією)

`fees[0].amount = 15000`, `total = 17500` — за T5 (`docs/spec/tariffs.md:87`) пільга не поширюється на збори; збір T7 = 150 грн повністю.

## Фактичний результат

`fees[0].amount = 7500`, `total = 10000` — код застосовував знижку 50% і до зборів.

## Доказ

```bash
node -e 'import("../ws12-main/app/src/tariff.js").then(({ quote }) => console.log(JSON.stringify(quote({ pickupAt: "2026-09-16T07:00:00Z", returnAt: "2026-09-16T07:40:00Z", bike: "classic", returnStation: "X01" }, { type: "reduced" }))))'
```

```text
{"minutes":40,"timeCharge":5000,"discounts":[{"code":"reduced","amount":2500}],"fees":[{"code":"out-of-zone","amount":7500}],"total":10000}
```

## Мінімальний вхід

Пільговий, будь-яка тривалість > 2 хв, повернення на X01. При standard — збір 15000 (правильно). При reduced — збір 7500 (баг).

## Додатково

Рядок `app/src/tariff.js:63-65`: код застосовував `discount()` до результату `feesFor()`. Виправлення: збори обчислюються без знижки. Наявний тест `app/test/unit/tariff.test.js` › `reduced fare for a ride returned outside the zone` стверджував хибну поведінку — оновлено в `8fe1d20`.
