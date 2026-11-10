# BUG-1: тривалість поїздки округляється до найближчої хвилини замість вгору (T1)

| Поле | Значення |
|---|---|
| **Правило специфікації** | T1: «Неповна хвилина рахується як повна: тривалість округляється вгору до цілих хвилин.» (`docs/spec/tariffs.md`, рядки 46–47) |
| **Середовище** | коміт `4606c72` (до виправлення), Node `v26.3.0`, Windows (PowerShell) |
| **Серйозність** | висока — кожна поїздка з нецілим числом хвилин зайво нараховується або недонараховується; користувач платить не ту суму |
| **Частота** | для поїздок із дробовою частиною хвилини, яку `Math.round` округлює вниз |
| **Знайдено** | `app/test/spec/tariff.test.js` › `T1: 121 с → 3 хв; … (TC-02)` і `… (TC-04)`; прогін `ai-runs/b2-run.txt` |
| **Виправлення** | `dcdd76b` — `fix(T1): round ride duration up to whole minutes (Math.ceil, not Math.round)` |

## Кроки відтворення

1. Запустити команду з кореня репо (виправлений код):
   ```bash
   node -e "import('./app/src/tariff.js').then(({quote}) => console.log(JSON.stringify(quote({pickupAt:'2026-09-16T10:00:00Z',returnAt:'2026-09-16T10:02:01Z',bike:'classic',returnStation:'S01'},{type:'standard'}),null,2)))"
   ```
2. Запустити ту ж саму команду на початковому коді з `main`:
   ```bash
   node -e "import('../ws12-main/app/src/tariff.js').then(({quote}) => console.log(JSON.stringify(quote({pickupAt:'2026-09-16T10:00:00Z',returnAt:'2026-09-16T10:02:01Z',bike:'classic',returnStation:'S01'},{type:'standard'}),null,2)))"
   ```

## Очікуваний результат (за специфікацією)

Взяття 10:00:00, повернення 10:02:01 → 121 с → округлюється вгору до 3 хв → `ceil(3/30) = 1` блок → 25 грн = 2500 kop.

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

`minutes = 2` (`Math.round(121_000 / 60_000) = Math.round(2.016…) = 2`) замість 3.

## Доказ

```bash
# Виправлений код (поточний, коміт dcdd76b):
node -e "import('./app/src/tariff.js').then(({quote}) => console.log(JSON.stringify(quote({pickupAt:'2026-09-16T10:00:00Z',returnAt:'2026-09-16T10:02:01Z',bike:'classic',returnStation:'S01'},{type:'standard'}),null,2)))"
```
```json
{
  "minutes": 3,
  "timeCharge": 2500,
  "discounts": [],
  "fees": [],
  "total": 2500
}
```

```bash
# Початковий код з main (до виправлення):
node -e "import('../ws12-main/app/src/tariff.js').then(({quote}) => console.log(JSON.stringify(quote({pickupAt:'2026-09-16T10:00:00Z',returnAt:'2026-09-16T10:02:01Z',bike:'classic',returnStation:'S01'},{type:'standard'}),null,2)))"
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

Поїздка 121 секунда (2 хв 1 с, тобто більше 2 хв). Після заміни `Math.round` на `Math.ceil` у `rideMinutes` (`app/src/tariff.js:71`) дефект зникає.

## Додатково

Хибне місце (гіпотеза): `app/src/tariff.js:71` — `Math.round((returned - pickup) / 60_000)` має бути `Math.ceil`. Пов'язані тести: TC-02 і TC-04.
