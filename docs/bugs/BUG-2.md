# BUG-2: поїздка рівно 2 хвилини платна, хоча має бути безкоштовною (T2)

| Поле | Значення |
|---|---|
| **Правило специфікації** | T2: «Поїздка тривалістю не більше 2 хвилин (за T1) — без погодинного нарахування.» (`docs/spec/tariffs.md`, рядок 54) |
| **Середовище** | коміт `4606c72` (до виправлення), Node `v26.3.0`, Windows (PowerShell) |
| **Серйозність** | середня — стосується лише поїздок рівно 2 хвилини (крайній випадок BVA); переплата 25 грн за таку поїздку |
| **Частота** | за умови поїздки саме 120 с (2 хвилини) |
| **Знайдено** | `app/test/spec/tariff.test.js` › `T2: 120 с = 2 хв; ≤ 2 хв → погодинне нарахування 0 грн (TC-03)`; прогін `ai-runs/b2-run.txt` |
| **Виправлення** | `c1535fd` — `fix(T2): a ride of up to 2 minutes is free (<=, not <)` |

## Кроки відтворення

1. Запустити команду з кореня репо (виправлений код):
   ```bash
   node -e "import('./app/src/tariff.js').then(({quote}) => console.log(JSON.stringify(quote({pickupAt:'2026-09-16T10:00:00Z',returnAt:'2026-09-16T10:02:00Z',bike:'classic',returnStation:'S01'},{type:'standard'}),null,2)))"
   ```
2. Запустити ту ж саму команду на початковому коді з `main`:
   ```bash
   node -e "import('../ws12-main/app/src/tariff.js').then(({quote}) => console.log(JSON.stringify(quote({pickupAt:'2026-09-16T10:00:00Z',returnAt:'2026-09-16T10:02:00Z',bike:'classic',returnStation:'S01'},{type:'standard'}),null,2)))"
   ```

## Очікуваний результат (за специфікацією)

Взяття 10:00:00, повернення 10:02:00 → 120 с = 2 хв → 2 ≤ 2 → без погодинного нарахування → `timeCharge = 0`, `total = 0`.

## Фактичний результат (до виправлення, код з main)

```json
{
  "minutes": 2,
  "timeCharge": 2500,
  "discounts": [],
  "fees": [],
  "total": 2500
}
```

`timeCharge = 2500` (1 блок по 25 грн) замість 0 — поїздка рівно 2 хвилини помилково платна.

## Доказ

```bash
# Виправлений код (поточний, коміт c1535fd):
node -e "import('./app/src/tariff.js').then(({quote}) => console.log(JSON.stringify(quote({pickupAt:'2026-09-16T10:00:00Z',returnAt:'2026-09-16T10:02:00Z',bike:'classic',returnStation:'S01'},{type:'standard'}),null,2)))"
```
```json
{
  "minutes": 2,
  "timeCharge": 0,
  "discounts": [],
  "fees": [],
  "total": 0
}
```

```bash
# Початковий код з main (до виправлення):
node -e "import('../ws12-main/app/src/tariff.js').then(({quote}) => console.log(JSON.stringify(quote({pickupAt:'2026-09-16T10:00:00Z',returnAt:'2026-09-16T10:02:00Z',bike:'classic',returnStation:'S01'},{type:'standard'}),null,2)))"
```
```json
{
  "minutes": 2,
  "timeCharge": 2500,
  "discounts": [],
  "fees": [],
  "total": 2500
}
```

## Мінімальний вхід

Поїздка рівно 120 секунд (2 хвилини). Після заміни `minutes < FREE_START_MINUTES` на `minutes <= FREE_START_MINUTES` у `chargeFor` (`app/src/tariff.js:79`) дефект зникає.

## Додатково

Хибне місце (гіпотеза): `app/src/tariff.js:79` — `if (minutes < FREE_START_MINUTES)` має бути `if (minutes <= FREE_START_MINUTES)`, де `FREE_START_MINUTES = 2`. Пов'язані тести: TC-03.
