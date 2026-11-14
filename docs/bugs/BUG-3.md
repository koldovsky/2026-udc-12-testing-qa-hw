# BUG-3: абонент помилково їде на електровелосипеді безкоштовно

| Поле | Значення |
|---|---|
| **Правило специфікації** | T4: на електровелосипеді абонент має знижку 20 % від T3, без безкоштовних хвилин — `docs/spec/tariffs.md:72-77`. |
| **Середовище** | Початковий код `main` = `4606c72`; Node `v26.9.0`; Darwin. |
| **Серйозність** | Висока: 30-хвилинна електропоїздка абонента безпідставно коштує 0 замість 32 грн. |
| **Частота** | Завжди для наведеного входу. |
| **Знайдено** | `app/test/spec/tariffs.test.js` › `T4: TC-11 electric subscription has no free minutes` у `ai-runs/b2-run.txt`. |
| **Виправлення** | `0eb9ef3` — `fix(T4): apply electric subscription to all billed blocks`. |

## Кроки відтворення

1. Із кореня репо створити копію початкового коду: `mkdir -p ../ws12-main`; `git archive main app | tar -x -C ../ws12-main`.
2. У корені `../ws12-main` виконати команду з розділу «Доказ». Для звіту копія була в `/private/tmp/ws12-main`.

## Очікуваний результат (за специфікацією)

Електровелосипед за 30 хв — один блок 4000 коп. за T3 (`docs/spec/tariffs.md:62-70`). Абонемент зменшує його на 20 % = 800 коп., отже `total=3200` (`docs/spec/tariffs.md:76-77`).

## Фактичний результат до виправлення

`timeCharge=4000`, знижка `subscription=4000`, `total=0`. У початковому `app/src/tariff.js:83-85` 45 безкоштовних хвилин віднімалися і від електропоїздки.

## Доказ

Команда з кореня копії `main`:

```bash
node --input-type=module -e 'import { quote } from "./app/src/tariff.js"; const r=quote({pickupAt:"2026-09-16T10:00:00+03:00",returnAt:"2026-09-16T10:30:00+03:00",bike:"ebike",returnStation:"S02"},{type:"subscriber"}); console.log(JSON.stringify({timeCharge:r.timeCharge,discounts:r.discounts,total:r.total}));'
```

```text
{"timeCharge":4000,"discounts":[{"code":"subscription","amount":4000}],"total":0}
```

На виправленому коді: `{"timeCharge":4000,"discounts":[{"code":"subscription","amount":800}],"total":3200}`.

## Мінімальний вхід

Абонент, електровелосипед, 30 хв, S02, без попередніх нарахувань. Якщо велосипед класичний, 30 хв справді безкоштовні за T4.

## Додатково

Наявний unit-тест `subscribers ride the first 45 minutes free` помилково застосовував безкоштовні хвилини до обох типів. У коміті `0eb9ef3` його збережено як перевірку різних умов для класичного (0) й електровелосипеда (6400 за 40 хв) за T4.
