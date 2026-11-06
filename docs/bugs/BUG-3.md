# BUG-3: абонент на електровелосипеді їздить перші 45 хвилин безкоштовно

| Поле | Значення |
|---|---|
| **Правило специфікації** | T4 — «Електровелосипед: знижка 20 % на погодинне нарахування за T3. Безкоштовних хвилин на електровелосипеді немає.» (`docs/spec/tariffs.md:76–77`); 45 безкоштовних хвилин — лише для класичного велосипеда (`docs/spec/tariffs.md:74–75`) |
| **Середовище** | коміт `5ab575c` (код `app/src/` = `main`), Node v24.16.0, Windows 11 Pro 10.0.26300, Git Bash |
| **Серйозність** | висока — зачіпає кожну поїздку абонента на електровелосипеді: до 45 хв — 0 замість щонайменше 32 грн; довші — дешевше на 1–2 блоки (90 хв: 64 грн замість 96 грн). Крім того, ламається порівняння «абонемент чи пільга» за T5 (`docs/spec/tariffs.md:89–91`): абонент із пільгою на електровелосипеді, 30 хв, платить 0 замість 20 грн |
| **Частота** | завжди для `rider.type = "subscriber"` і `bike = "ebike"` з тривалістю понад 2 хв |
| **Знайдено** | прогоном зі специфікації (`ai-runs/b2-run.txt`): `app/test/spec/tariff-t4-t5.test.js` › `T4: TC-26 to TC-29 — ebike subscriber: no free minutes, −20 % on time charge`; `app/test/spec/tariff-t4-t5.test.js` › `T5: TC-33 to TC-39 — subscriber+concession: cheaper of subscription vs reduced wins`. Прогін з коду — не знайшов (і зафіксував: `ai-runs/b1-from-code/tariff.test.js` › `subscriber 90-min ebike: extra 20% ebike discount on billed portion → 6400`) |
| **Виправлення** | `4b294a8 fix(T4): абонемент на електровелосипеді — без безкоштовних хвилин, лише знижка 20 %` |

## Кроки відтворення

1. З кореня репо в Git Bash викликати `quote` для абонента (`{ type: "subscriber" }`) на
   електровелосипеді, взяття `2026-09-16T10:00:00+03:00`, повернення
   `2026-09-16T10:10:00+03:00` (10 хв), станція `S01` (команда в «Доказ»).
2. Подивитися на знижку `subscription` і `total`.

## Очікуваний результат (за специфікацією)

10 хв → 1 розпочатий блок × 40 грн = 4 000 коп (`docs/spec/tariffs.md:62–67`);
безкоштовних хвилин на електровелосипеді немає, знижка 20 % (`docs/spec/tariffs.md:76–77`)
→ знижка `subscription` 800 → `total` = **3 200 коп**.

## Фактичний результат

`discounts: [{ code: "subscription", amount: 4000 }]`, `total: 0` — поїздка безкоштовна.

## Доказ

До виправлення — на копії початкового коду з `main`:

```bash
rm -rf /c/ws12-runs/ws12-main && mkdir -p /c/ws12-runs/ws12-main && git archive main app | tar -x -C /c/ws12-runs/ws12-main
cd /c/ws12-runs/ws12-main && node -e 'import("./app/src/tariff.js").then(({ quote }) => console.log(JSON.stringify(quote({ pickupAt: "2026-09-16T10:00:00+03:00", returnAt: "2026-09-16T10:10:00+03:00", bike: "ebike", returnStation: "S01" }, { type: "subscriber" }))))'; cd -
```

```text
{"minutes":10,"timeCharge":4000,"discounts":[{"code":"subscription","amount":4000}],"fees":[],"total":0}
```

Після виправлення — та сама команда з кореня репо (коміт `63c2363`):

```text
{"minutes":10,"timeCharge":4000,"discounts":[{"code":"subscription","amount":800}],"fees":[],"total":3200}
```

Тести: `ai-runs/b2-run.txt:185–187` (`TC-26` `0 !== 3200`), `:227–229` (`TC-38`
`0 !== 2000`).

## Мінімальний вхід

`{ pickupAt: "2026-09-16T10:00:00+03:00", returnAt: "2026-09-16T10:10:00+03:00", bike: "ebike", returnStation: "S01" }`,
`{ type: "subscriber" }`. `bike: "classic"` — дефект зникає (0 за T4 правильний);
`type: "standard"` — теж (абонемента немає).

## Додатково

- Місце в коді: `app/src/tariff.js:84` (у `main`) —
  `blocks(Math.max(0, minutes - SUBSCRIPTION_FREE_MINUTES))` віднімає 45 хв для будь-якого
  велосипеда; виправлено: безкоштовні хвилини лише для класичного.
- Наявний тест, що стверджував хибну поведінку: `app/test/unit/tariff.test.js` ›
  `subscribers ride the first 45 minutes free` (40 хв на ebike = 0) — оновлено за
  `docs/spec/tariffs.md:74–77` у тому ж коміті, див. `docs/bugs/README.md` (за рев'ю розділено на два тести: classic і ebike).
