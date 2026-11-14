# BUG-1: неповна хвилина поїздки не округлюється вгору

| Поле | Значення |
|---|---|
| **Правило специфікації** | T1: «Неповна хвилина рахується як повна» — `docs/spec/tariffs.md:45-47`. |
| **Середовище** | Початковий код `main` = `4606c72`; Node `v26.9.0`; Darwin. |
| **Серйозність** | Висока: на межі 30-хвилинного блока сервіс бере 25 грн замість 50 грн за класичний велосипед. |
| **Частота** | Завжди для наведеного входу. |
| **Знайдено** | `app/test/spec/tariffs.test.js` › `T1, T3: TC-02 30 minutes and one second`; також TC-05 і TC-09 у `ai-runs/b2-run.txt`. |
| **Виправлення** | `afe457c` — `fix(T1): round partial ride minutes upward`. |

## Кроки відтворення

1. Із кореня репо створити копію початкового коду: `mkdir -p ../ws12-main`; `git archive main app | tar -x -C ../ws12-main`.
2. У корені `../ws12-main` виконати команду з розділу «Доказ». Для звіту той самий `git archive main app` розгорнуто в `/private/tmp/ws12-main`.

## Очікуваний результат (за специфікацією)

30 хв 1 с округлюється до 31 хв за T1 (`docs/spec/tariffs.md:45-47`), тобто два розпочаті блоки класичного велосипеда по 2500 коп. за T3 (`docs/spec/tariffs.md:62-69`): `minutes=31`, `timeCharge=5000`, `total=5000`.

## Фактичний результат до виправлення

`minutes=30`, `timeCharge=2500`, `total=2500`: поїздка недооцінена на 2500 коп. Причина в `Math.round` у початковому `app/src/tariff.js:70-72`.

## Доказ

Команда з кореня копії `main` (`/private/tmp/ws12-main`):

```bash
node --input-type=module -e 'import { quote } from "./app/src/tariff.js"; const r=quote({pickupAt:"2026-09-16T10:00:00+03:00",returnAt:"2026-09-16T10:30:01+03:00",bike:"classic",returnStation:"S02"},{type:"standard"}); console.log(JSON.stringify({minutes:r.minutes,timeCharge:r.timeCharge,total:r.total}));'
```

```text
{"minutes":30,"timeCharge":2500,"total":2500}
```

Та сама команда на виправленому коді: `{"minutes":31,"timeCharge":5000,"total":5000}`. Початковий тест також показав `30/2500` проти `31/5000` у `ai-runs/b2-run.txt` (TC-02).

## Мінімальний вхід

Стандартний користувач, класичний велосипед, станція S02, рівно 30 хв 1 с. При рівно 30 хв розбіжність зникає.

## Додатково

Наявний `app/test/unit/tariff.test.js` › `a ride of 30 min 20 s is billed as one block` стверджував хибну поведінку. У коміті `afe457c` його збережено, перейменовано та очікування виправлено за T1/T3 на 31 хв і 5000 коп. Флакі-тест із `app/test/integration/` не змінено.
