- Інструмент і модель: OpenCode (nemotron-3.5-super-vl-free)
- Дата: 2026-11-09
- Що бачила сесія: репо ws12-b1; код сервісу у app/src/ (tariff.js, day-cap.js, kyiv-time.js, zones.js, receipt.js, server.js); у корені package.json відсутній; тимчасова тека ai-runs/b1-from-code/ для тестів; завдання — читати лише app/src/ і package.json
- Що було ввімкнено з пам'яті й глобальних правил: нічого (початкова сесія, без попереднього контексту)

Промпт (дослівно):

> У цій теці — код сервісу, який рахує вартість поїздок велопрокату громади (app/src/).
> Читай лише файли в app/src/ і package.json у корені теки.
> Напишіть unit-тести для app/src/tariff.js і app/src/day-cap.js на вбудованому раннері Node
> (node:test і node:assert/strict), без npm-залежностей. Поклади їх у теку
> ai-runs/b1-from-code/ у файли *.test.js; модулі імпортуй шляхом ../../app/src/<файл>.js.
> Запустіть тести командою node --test "ai-runs/b1-from-code/*.test.js" і покажіть результат.
> Не змінюйте app/src/. Уточнювальних питань не став; працюйте з тим, що є

Відповідь AI дослівно:

Створила два тестових файли без залежностей від npm (лише вбудовані `node:test` і `node:assert/strict`):

- `ai-runs/b1-from-code/tariff.test.js` — 21 тест модуля `tariff.js`:
  - вартість 30-хвилинної поїздки на clássic (один блок, 2500 kopiyok);
  - округлення угору до блоків по 30 хв (31 хв = 2 блоку);
  - безкоштовні перші 2 хвини (total = 0);
  - тариф ebike (4000 kopiyok за блок);
  - допоміжна функція `discount(amount, percent)` — відніжок округлюється вниз;
  - reduced fare — 50% знижка від ціни по часу;
  - subscription — безкоштовні перші 45 хв, ebike −20%;
  - вибір вигіднішого плану для абонента з concesyon;
  - нічна знижка 30% за поїздки до 06:00 київського часу (через `kyivTime`);
  - немає нічної знижки о 10:00 ранку;
  - плата за виїзд за зону (out-of-zone, 15000);
  - штраф за неповернення > 24 год (unreturned, 200000);
  - day-cap ліджер — ліміт 5000, знижка частини вище залишку, total = 0 після вичерпання;
  - різні дні трекаються окремо;
  - вимога `rider.id` коли подано dayCap (`QuoteError`);
  - `QuoteError` для невідомого типу велосипеду, станції, типу рейсера, некоректної дати, returnAt до pickupAt;
  - передача власного `zones` lookup.

- `ai-runs/b1-from-code/day-cap.test.js` — 9 тестів модуля `day-cap.js`:
  - `dayKey()` повертає YYYY-MM-DD;
  - ліміт за замовчуванням `DAY_CAP = 30000`;
  - `remaining` починається з ліміту;
  - `remaining` зменшується після `record`, не нижче 0;
  - нарахування накопичуються на одному rider+день;
  - різні рейсери і різні дні трекуються незалежно;
  - `chargedOn` повертає 0 коли нічого не записано.

Модулі імпортуються шляхом динамічного `import("../../app/src/<файл>.js")`, оскільки тестові файли — CommonJS `.js` (package.json відсутній, тому `.js` не ESM).

Результат запуску `node --test "ai-runs/b1-from-code/*.test.js"` (Node v26.3.0):

```
▶ day-cap
  ✔ dayKey returns the YYYY-MM-DD of the instant
  ✔ default limit is 30000 kopecks
  ✔ remaining starts at the limit
  ✔ remaining decreases after recording a charge
  ✔ records accumulate on the same rider-day key
  ✔ remaining never goes below zero
  ✔ different riders are tracked independently
  ✔ different days are tracked independently
  ✔ chargedOn returns 0 when nothing was recorded
✔ day-cap
▶ tariff.quote
  ✔ 30-minute classic ride for a standard rider costs one block
  ✔ 31 minutes round up to two blocks
  ✔ ride shorter than 2 minutes is free
  ✔ ebike costs more per block
  ✔ discount() helper: percent off rounded down to the kopeck
  ✔ reduced rider gets 50% off the time charge
  ✔ subscriber pays only for minutes beyond the free 45
  ✔ subscriber with concession on ebike picks the cheaper plan
  ✔ night ride (before 06:00 Kyiv) gets a 30% discount
  ✔ morning ride has no night discount
  ✔ out-of-zone return station adds a fee
  ✔ unreturned bike after 24 hours adds a fee
  ✔ day cap discounts the part above the remaining allowance
  ✔ different days are tracked separately by the day cap
  ✔ requires rider.id when a day cap ledger is given
  ✔ unknown bike type throws
  ✔ returnAt before pickupAt throws
  ✔ unknown station throws
  ✔ invalid date-time throws
  ✔ unknown rider type throws
  ✔ custom zones lookup can be passed in
✔ tariff.quote
ℹ tests 30
ℹ suites 2
ℹ pass 30
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 265.0597
```

app/src/ не змінювалося. Усі 30 тестів пройшли.
