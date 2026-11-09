# BUG-4: Пільговий тариф зменшує збори за повернення поза зоною і за неповернений велосипед

| Поле | Значення |
|---|---|
| **Правило специфікації** | T5 — «Пільга не поширюється на збори (T7, T8).» (`docs/spec/tariffs.md:87-88`) |
| **Середовище** | `main` (початковий код) і коміт `a0d317d` (після виправлення); Node v26.13.0; Darwin 25.6.0 |
| **Серйозність** | висока — недобір зборів: 75 грн замість 150 грн (T7) і 1000 грн замість 2000 грн (T8) з кожного пільговика; збір призначений для покриття перевезення |
| **Частота** | завжди для пільгового користувача (і абонента з правом на пільгу, коли обрано пільгу) зі збором |
| **Знайдено** | `app/test/spec/discounts.test.js` › `T5: TC-33 reduced fare does not apply to the out-of-zone fee`, `T5: TC-34 reduced fare, 25 h: …` (`ai-runs/b2-run.txt`) |
| **Виправлення** | коміт `a0d317d` (`git log --oneline -1 a0d317d`) |

## Кроки відтворення

1. З кореня репо виконати команду з розділу «Доказ» — на копії початкового коду з `main` (`mkdir -p ../ws12-main && git archive main app | tar -x -C ../ws12-main && cd ../ws12-main`).
2. Порівняти вивід з очікуваним.
3. Виконати ту саму команду в репо після виправлення (`a0d317d`) — вивід збігається з очікуваним.

## Очікуваний результат (за специфікацією)

пільговий, класичний, 20 хв, `X01` → 2500 − 50 % = 1250 + збір 15000 = 16250 коп (`docs/spec/tariffs.md:87`, `:111`).

## Фактичний результат

`fees: [{out-of-zone, 7500}]`, `total: 8750`: збір зменшено на 50 %. Для 25 год — 130000 замість 230000.

## Доказ

```bash
node -e 'import("./app/src/tariff.js").then(({ quote }) => console.log(JSON.stringify(quote(
  { pickupAt: "2026-09-16T09:00:00Z", returnAt: "2026-09-16T09:20:00Z", bike: "classic", returnStation: "X01" },
  { type: "reduced" }))))'
```

До виправлення (початковий код з `main`):

```text
{"minutes":20,"timeCharge":2500,"discounts":[{"code":"reduced","amount":1250}],"fees":[{"code":"out-of-zone","amount":7500}],"total":8750}
```

Після виправлення (`a0d317d`):

```text
{"minutes":20,"timeCharge":2500,"discounts":[{"code":"reduced","amount":1250}],"fees":[{"code":"out-of-zone","amount":15000}],"total":16250}
```

## Мінімальний вхід

пільговий, будь-яка поїздка на `X01` (або понад 24 год).

## Додатково

Тести з коду, що стверджували хибну поведінку (3): `ai-runs/b1-from-code/tariff.test.js` › `out-of-zone fee is halved when the reduced fare is the plan`, `out-of-zone fee is halved for a conceding subscriber when reduced wins`, `reduced rider gets the unreturned fee halved too`. Наявний `app/test/unit/tariff.test.js` › `reduced fare for a ride returned outside the zone` (`7500`, `10000`) — оновлено за `tariffs.md:87` (15000, 17500). Гіпотеза: `app/src/tariff.js:63-65`.
