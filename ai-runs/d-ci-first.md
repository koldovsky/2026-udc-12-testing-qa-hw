- Інструмент і модель: Claude Code 2.1.168, headless-сесія `claude -p`; модель claude-sonnet-4-6
- Дата: 2026-11-05
- Що бачила сесія: тимчасова тека `C:/ws12-runs/ws12-d-ci` — `app/` і `ci/` з `main` (`git archive main app ci`)
- Що було ввімкнено з пам'яті й глобальних правил: нічого — `--setting-sources project,local` (без `~/.claude/CLAUDE.md` і user settings), `--disable-slash-commands` (без skills), `--strict-mcp-config` (без MCP), `--settings '{"autoMemoryEnabled":false}'` (без пам'яті); тека поза `C:\Users\Haspe`, тому батьківські `CLAUDE.md` не підвантажувались. Перевірено пробною сесією з тими самими прапорцями.
- Примітка: у копії був локальний git (`git init` + коміт base), щоб перевірити, що агент не змінив `ci/`: `git status` після прогону — лише новий `ai-runs/d-ci-first.md`.
- Промпт (дослівно):

  > У цій теці: ci/ — логи чотирьох невдалих прогонів CI (ci/runs/), зміни, що їх запустили
  > (ci/changes/), і опис пайплайна (ci/README.md); app/ — код застосунку і його тести.
  > Для кожного прогону визнач, чому він упав, і клас падіння: дефект коду, дефект тесту,
  > середовище або нестабільний тест. До кожного — докази (рядок логу, фрагмент diff або
  > команда над файлами цієї теки та її вивід) і що виправити.
  > Запиши відповідь у файл ai-runs/d-ci-first.md. Не змінюй файли в ci/.
  > Уточнювальних питань не став; працюй з тим, що є.

---

# Аналіз чотирьох невдалих прогонів CI (тиждень 19–23.10.2026)

---

## Прогін 1141 — #231 `tests/clock-change-night`

**Клас:** дефект коду

**Що впало**

```
✖ a ride on the night the clocks go back is billed by the station clock (5.513908ms)
  AssertionError: tariff.quote() miscounts the ride across the DST change
  180 !== 120
  at test/unit/clock-change.test.js:11
```

**Докази**

PR додає `clock-change.test.js`. Тест перевіряє поїздку з 02:30+03:00 до 04:30+02:00 — ніч переведення годинника 25.10.2026 (EEST→EET):

```diff
+  const result = quote(ride("2026-10-25T02:30:00+03:00", "2026-10-25T04:30:00+02:00"), { type: "standard" });
+  assert.equal(result.minutes, 120, "tariff.quote() miscounts the ride across the DST change");
```

`app/src/tariff.js:70–72`:
```js
function rideMinutes(pickup, returned) {
  return Math.round((returned - pickup) / 60_000);
}
```

`readRide` передає сюди Unix-мілісекунди з `Date.parse()`:
- `Date.parse("2026-10-25T02:30:00+03:00")` → `2026-10-24T23:30:00Z`
- `Date.parse("2026-10-25T04:30:00+02:00")` → `2026-10-25T02:30:00Z`
- Різниця: 10 800 000 мс = **180 хв** (UTC-elapsed)

Тест очікує **120 хв** (02:30 → 04:30 за годинником на станції). Код правильно обробляє Z-рядки, але не враховує, що при зворотному переведенні годинника UTC-тривалість більша за wall-clock тривалість.

**Що виправити**

`rideMinutes` повинна рахувати wall-clock різницю, використовуючи зміщення з рядків:

```js
// app/src/tariff.js — rideMinutes
function rideMinutes(pickupStr, returnStr) {
  const wallMs = (s) => {
    const off = s.match(/([+-])(\d{2}):(\d{2})$/);
    if (!off) return Date.parse(s);
    const sign = off[1] === "+" ? 1 : -1;
    return Date.parse(s) + sign * (Number(off[2]) * 60 + Number(off[3])) * 60_000;
  };
  return Math.round((wallMs(returnStr) - wallMs(pickupStr)) / 60_000);
}
```

`readRide` (рядок 112) має передавати рядки, а не розпарсені мілісекунди:

```js
return { pickup, minutes: rideMinutes(ride.pickupAt, ride.returnAt), zone };
```

---

## Прогін 1144 — #233 `ui/return-hint`

**Клас:** нестабільний тест (причина — дефект тесту)

**Що впало**

```
✖ every receipt of a week of rides ends with the amount due (6.768314ms)
  AssertionError: classic, 60 min from 2026-09-21T08:14:00.000Z:
    got "До сплати .......................... 50,00 грн", expected 75,00 грн
  at test/integration/receipt.test.js:20
```

**Докази**

Diff PR змінює лише `public/index.html` (підказка про 24 год) — до `tariff.js` і тестів він не торкається. Тест впав через вже наявний дефект формули в `receipt.test.js:15`:

```js
// app/test/integration/receipt.test.js:14–15
const minutes = (Date.parse(ride.returnAt) - Date.parse(ride.pickupAt)) / 60_000;
const expected = (Math.floor(minutes / 30) + 1) * PRICE[ride.bike];
```

Справжній код (`tariff.js:74–80`):
```js
function blocks(minutes) { return Math.ceil(minutes / BLOCK_MINUTES); }
function chargeFor(minutes, bike) { return blocks(minutes) * RATES[bike]; }
```

Порівняння при `minutes = 60`:
| Формула | Результат |
|---|---|
| Тест: `(Math.floor(60/30) + 1) * 2500` | `3 * 2500 = 7500` → 75,00 грн |
| Код: `Math.ceil(60/30) * 2500` | `2 * 2500 = 5000` → 50,00 грн |

`Math.floor(n/30) + 1 ≠ Math.ceil(n/30)` коли `n` кратне 30 (формула додає зайвий блок).

Фабрика генерує поїздки від 5 до 89 хвилин (`factory.js:16`: `between(5, 89)`). Кратні 30 значення — це 30 і 60, тобто 2 з 85 можливих → ймовірність спрацювання ≈ 2,4% за поїздку. З 10 поїздками за прогін ймовірність падіння ≈ 21%, тому тест нестабільний.

Прогін 1 — помилка (seed потрапив на 60 хв), прогін 2 (перезапуск) — успішно (seed не потрапив).

**Що виправити**

Замінити неправильну формулу в `receipt.test.js:15`:

```js
// було
const expected = (Math.floor(minutes / 30) + 1) * PRICE[ride.bike];
// треба
const expected = Math.ceil(minutes / 30) * PRICE[ride.bike];
```

---

## Прогін 1147 — #236 `chore/port-parsing`

**Клас:** середовище

**Що впало**

```
Error: listen EADDRINUSE: address already in use :::3000
    at Server.setupListenHandle [as _listen2] (node:net:2009:16)
    at app/src/server.js:74:33
...
curl: (22) The requested URL returned error: 404   (×5)
```

**Докази**

Усі 20 тестів пройшли (pass 20, fail 0). Збій стався лише у кроці smoke:

```
> veloprokat@3.2.0 start
> node src/server.js

node:events:487
      throw er; // Unhandled 'error' event
Error: listen EADDRINUSE: address already in use :::3000
```

`curl` після цього повертає HTTP 404 — тобто порт 3000 **вже зайнятий якимось процесом**, який відповідає на HTTP але не має `/api/health`. `server.js` навіть не стартував.

Прогін 1147 виконується на образі `ubuntu24/20261020.1` (оновлений у порівнянні з 20261013.1 у прогонах 1141 і 1144). На старому образі жоден прогін не досягав smoke-кроку, тому порівняти напряму неможливо, але два послідовних перезапуски того самого коміту (`1 — помилка; 2 — помилка`) відтворюють збій стабільно — ознака інфраструктурного, а не випадкового збою.

Код diff (зміна `server.js`):

```diff
-  const port = Number(process.env.PORT ?? 3000);
+  const port = Number.parseInt(process.env.PORT ?? "", 10) || 3000;
```

Зміна не могла сама по собі зайняти порт — вона лише впливає на вибір порту. Якщо в CI-середовищі встановлено `PORT=0`, стара логіка давала `Number(0) = 0` (ОС призначає довільний порт), тоді як нова `0 || 3000 = 3000` — фіксовано 3000. У такому разі smoke-крок, що всегда curl'ить :3000, до PR'а міг проходити через збіг (на :3000 щось є, відповідає 200) або взагалі не тестувався через попередні збої. Але головна причина — зовнішній сервіс на порту 3000 у runner-образі.

**Що виправити**

1. Повідомити команду інфраструктури про конфлікт порту в образі `20261020.1`.
2. Як тимчасовий обхід — запускати smoke на іншому порту:
   ```yaml
   - run: PORT=14321 npm start & …
              curl -fsS http://127.0.0.1:14321/api/health …
   ```
3. Розглянути заміну `|| 3000` на явну перевірку, щоб `PORT=0` не трактувалось як «не задано»:
   ```js
   const port = process.env.PORT !== undefined && process.env.PORT !== ""
     ? Number.parseInt(process.env.PORT, 10)
     : 3000;
   ```

---

## Прогін 1152 — #238 `refactor/fees`

**Клас:** дефект коду

**Що впало**

```
✖ a bike kept over a day and left outside the zone pays both fees (7.741812ms)
  AssertionError: Expected values to be strictly equal:
  1 !== 2
  at test/unit/tariff.test.js:66
```

**Докази**

Diff замінює `feesFor` у `app/src/tariff.js`:

```diff
 function feesFor(minutes, zone) {
-  const fees = [];
-  if (zone === "out") fees.push({ code: "out-of-zone", amount: OUT_OF_ZONE_FEE });
-  if (minutes > UNRETURNED_AFTER_MINUTES) fees.push({ code: "unreturned", amount: UNRETURNED_FEE });
-  return fees;
+  if (zone === "out") return [fee("out-of-zone", OUT_OF_ZONE_FEE)];
+  if (minutes > UNRETURNED_AFTER_MINUTES) return [fee("unreturned", UNRETURNED_FEE)];
+  return [];
 }
```

Тест (рядок 64–67):
```js
test("a bike kept over a day and left outside the zone pays both fees", () => {
  const result = quote(ride("2026-09-16T07:00:00Z", "2026-09-18T07:00:00Z", { returnStation: "X03" }), standard);
  assert.equal(result.fees.length, 2);  // ← очікує 2, отримує 1
});
```

Поїздка 48 год, станція поза зоною → мають нараховуватись обидва збори: `out-of-zone` і `unreturned`. Стара реалізація накопичувала їх у масив. Нова повертає ранньо при першій спрацьованій умові (`zone === "out"`) і ніколи не перевіряє другу.

**Що виправити**

Відновити адитивну логіку, зберігши допоміжну функцію `fee()`:

```js
function feesFor(minutes, zone) {
  const fees = [];
  if (zone === "out") fees.push(fee("out-of-zone", OUT_OF_ZONE_FEE));
  if (minutes > UNRETURNED_AFTER_MINUTES) fees.push(fee("unreturned", UNRETURNED_FEE));
  return fees;
}
```

---

## Зведення

| Прогін | Гілка | Крок | Клас | Коротко |
|---|---|---|---|---|
| 1141 | `tests/clock-change-night` | `npm test` | дефект коду | `rideMinutes` рахує UTC-різницю замість wall-clock; поїздка через DST-перехід завжди на 60 хв довша |
| 1144 | `ui/return-hint` | `npm test` | нестабільний тест | формула `Math.floor(n/30)+1` у `receipt.test.js` неправильна для кратних 30 значень; проявляється з ймовірністю ≈21% |
| 1147 | `chore/port-parsing` | smoke | середовище | порт 3000 зайнятий у runner-образі `20261020.1`; два перезапуски поспіль — той самий результат |
| 1152 | `refactor/fees` | `npm test` | дефект коду | ранній `return` у `feesFor` скасовує другий збір, коли обидві умови (поза зоною + понад добу) виконані одночасно |
