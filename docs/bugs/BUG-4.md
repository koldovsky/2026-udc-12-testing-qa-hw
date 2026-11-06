# BUG-4: пільговику збір за повернення поза зоною і за неповернений велосипед знижено вдвічі

| Поле | Значення |
|---|---|
| **Правило специфікації** | T5 — «Користувачі з правом на пільгу (студенти, пенсіонери) отримують знижку 50 % на погодинне нарахування. Пільга не поширюється на збори (T7, T8).» (`docs/spec/tariffs.md:86–87`) |
| **Середовище** | коміт `5ab575c` (код `app/src/` = `main`), Node v24.16.0, Windows 11 Pro 10.0.26300, Git Bash |
| **Серйозність** | висока — зачіпає всіх пільговиків (і абонентів з пільгою, коли обрано пільгу): збір T7 75 грн замість 150 грн, збір T8 1 000 грн замість 2 000 грн. Збори компенсують перевезення і втрату велосипеда — громада недоотримує до 1 075 грн з поїздки; суму в чеку теж показано неправильно (T9) |
| **Частота** | завжди, коли за T5 застосовано пільговий тариф (`rider.type = "reduced"` або абонент з `concession: true`, для якого пільга дешевша) і до поїздки застосовано хоча б один збір T7 / T8 |
| **Знайдено** | прогоном зі специфікації (`ai-runs/b2-run.txt`): `app/test/spec/tariff-t4-t5.test.js` › `T5: TC-32 — reduced fare does not apply to out-of-zone fee`; `app/test/spec/tariff-t4-t5.test.js` › `T5: TC-40 — reduced fare + T6 cap + T8 fee: fee not discounted`; `app/test/spec/tariff-t9.test.js` › `T9: TC-68 — receipt for reduced fare + out-of-zone: fee is 150,00 грн, total 162,50 грн`. Прогін з коду — не знайшов (і зафіксував: `ai-runs/b1-from-code/tariff.test.js` › `reduced rider gets 50% off the out-of-zone fee`) |
| **Виправлення** | `6f9bc58 fix(T5): пільга не поширюється на збори T7 і T8` |

## Кроки відтворення

1. З кореня репо в Git Bash викликати `quote` для пільговика (`{ type: "reduced" }`),
   класичний велосипед, взяття `2026-09-16T10:00:00+03:00`, повернення
   `2026-09-16T10:20:00+03:00` (20 хв), станція повернення `X02` — поза зоною
   (`docs/spec/tariffs.md:175`) (команда в «Доказ»).
2. Подивитися на `fees` і `total`.

## Очікуваний результат (за специфікацією)

20 хв → 1 блок 2 500 коп (`docs/spec/tariffs.md:62–66`) − 50 % пільги = 1 250
(`docs/spec/tariffs.md:86`); збір за повернення поза зоною 15 000 (`docs/spec/tariffs.md:111–112`)
без знижки (`docs/spec/tariffs.md:87`) → `fees: [{ code: "out-of-zone", amount: 15000 }]`,
`total` = **16 250 коп** (у чеку «162,50 грн»).

## Фактичний результат

`fees: [{ code: "out-of-zone", amount: 7500 }]`, `total: 8750` — збір знижено на 50 %.

## Доказ

До виправлення — на копії початкового коду з `main`:

```bash
rm -rf /c/ws12-runs/ws12-main && mkdir -p /c/ws12-runs/ws12-main && git archive main app | tar -x -C /c/ws12-runs/ws12-main
cd /c/ws12-runs/ws12-main && node -e 'import("./app/src/tariff.js").then(({ quote }) => console.log(JSON.stringify(quote({ pickupAt: "2026-09-16T10:00:00+03:00", returnAt: "2026-09-16T10:20:00+03:00", bike: "classic", returnStation: "X02" }, { type: "reduced" }))))'; cd -
```

```text
{"minutes":20,"timeCharge":2500,"discounts":[{"code":"reduced","amount":1250}],"fees":[{"code":"out-of-zone","amount":7500}],"total":8750}
```

Після виправлення — та сама команда з кореня репо (коміт `63c2363`):

```text
{"minutes":20,"timeCharge":2500,"discounts":[{"code":"reduced","amount":1250}],"fees":[{"code":"out-of-zone","amount":15000}],"total":16250}
```

Тести: `ai-runs/b2-run.txt:206–208` (`TC-32: total (1250 + 15000)` `8750 !== 16250`),
`:248–250` (`TC-40: total (30000 + 200000)` `130000 !== 230000` — збір T8 теж
знижено), `:332` (`TC-68: out-of-zone fee 150,00 грн`).

## Мінімальний вхід

`{ pickupAt: "2026-09-16T10:00:00+03:00", returnAt: "2026-09-16T10:20:00+03:00", bike: "classic", returnStation: "X02" }`,
`{ type: "reduced" }`. `returnStation: "S01"` (без збору) або `type: "standard"` — дефект
зникає.

## Додатково

- Місце в коді: `app/src/tariff.js:63–65` (у `main`) — `feesFor(...).map(...)` зменшує
  кожен збір на `REDUCED_PERCENT`, коли `plan.code === "reduced"`; виправлено: збори
  беруться з `feesFor` без змін.
- Наявний тест, що стверджував хибну поведінку: `app/test/unit/tariff.test.js` › `reduced
  fare for a ride returned outside the zone` (збір 7 500, разом 10 000) — оновлено за
  `docs/spec/tariffs.md:87` у тому ж коміті, див. `docs/bugs/README.md`.
