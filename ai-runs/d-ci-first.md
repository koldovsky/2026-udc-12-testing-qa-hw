- Інструмент і модель: OpenCode, модель GLM-5.3-Flash Free
- Дата: 2026-11-10
- Що бачила сесія: робоча тека `ws12-d-ci` (не git-репозиторій): `ci/` — `README.md`, 4 логи
  (`ci/runs/run-1141.log`, `run-1144.log`, `run-1147.log`, `run-1152.log`) і 4 diff
  (`ci/changes/run-1141.diff`, `run-1144.diff`, `run-1147.diff`, `run-1152.diff`) — тільки читала,
  у `ci/` нічого не змінено; `app/` — вихідний код (`src/`), тести (`test/`), `public/`,
  `package.json`, `README.md` — читала; `ai-runs/d-ci-first.md` — шаблон, у який записана
  відповідь. Експерименти виконувала на копії в тимчасовій теці
  `C:\Users\admin\AppData\Local\Temp\opencode\ws-ci-check\` (копія `app/` + diff-файли +
  три допоміжні скрипти `check-1141.mjs`, `check-1144.mjs`, `check-1147.mjs`); diff-файли
  застосовувала і відкочовувала через `git apply` у копії (Node v26.3.0, git 2.38.1, Windows;
  у CI за логами — Node 24.11.1, Ubuntu 24.04).
- Що було ввімкнено з пам'яті й глобальних правил: нічого — сесія з нуля.
- Промпт (дослівно):

  > У цій теці: ci/ — логи чотирьох невдалих прогонів CI (ci/runs/), зміни, що їх запустили
  >   (ci/changes/), і опис пайплайна (ci/README.md); app/ — код застосунку і його тести.
  >   Для кожного прогону визнач, чому він упав, і клас падіння: дефект коду, дефект тесту,
  >   середовище або нестабільний тест. До кожного — докази (рядок логу, фрагмент diff або
  >   команда над файлами цієї теки та її вивід) і що виправити.
  >   Запиши відповідь у файл ai-runs/d-ci-first.md (в ньому є шаблон). Не змінюй файли в ci/.
  >   Уточнювальних питань не став; працюй з тим, що є

---

# Розбір чотирьох падінь CI (19–23.10.2026)

Методика: прочитала всі логи `ci/runs/` і зміни `ci/changes/`, зіставила їх з кодом і тестами
в `app/`, кожну гіпотезу перевірила командою над копіями цих самих файлів (пайплайн за
`ci/README.md`: `npm ci` → `npm audit` (`continue-on-error`) → `npm test` → smoke
`npm start` + curl).

## Зведення

| Прогін | Крок падіння | Клас | Суть | Що виправляти |
|---|---|---|---|---|
| 1141 | `npm test` | **дефект коду** | `quote()` рахує тривалість за абсолютним часом (180 хв), а правило тарифу — «за станційним годинником» (120 хв) | `src/tariff.js`: хвилини за показами годинника Europe/Kyiv |
| 1144 | `npm test` | **дефект тесту** (проявляється як флейк) | формула очікування `(floor+1)` хибна на рівно 30/60 хв; випадкові дані фабрики дають збій не в кожному прогоні | `test/integration/receipt.test.js` — формула; `test/helpers/factory.js` — `Math.random` |
| 1147 | smoke | **середовище** | порт 3000 на hosted-раннері зайнятий чужим процесом (EADDRINUSE; 404 віддає не наш API), обидві спроби падають | пайплайн: власний порт для smoke + перевірка тіла відповіді |
| 1152 | `npm test` | **дефект коду** | рефакторинг `feesFor` з ранніми `return` губить другий збір (за зону і за добу) | `src/tariff.js`: повернути накопичення обох зборів |

Спільна деталь: у прогонів 1144 і 1152 у самому логу падає `npm audit` з network-помилки
(`EAI_AGAIN`/`ETIMEDOUT` до `npm-mirror.example.net`), але крок має `continue-on-error: true`
(лог сам це пише, наприклад `ci/runs/run-1144.log:143`), тож причина падіння — не аудит,
а `npm test`. Це хибний слід, а не корінь.

---

## Прогін 1141 — PR #231 «Тести: поїздки в ніч переведення годинника»

**Клас: дефект коду** — правило «лічба поїздки за показом станційного годинника» не
реалізоване в `src/tariff.js`; новий тест PR його фіксує, а код дає інший результат.

### Що впало

`npm test`: 21 з 22 ✔, падає новий тест PR
`a ride on the night the clocks go back is billed by the station clock`:

```
ci/runs/run-1141.log:181  test at test/unit/clock-change.test.js:8:1
ci/runs/run-1141.log:183  AssertionError [ERR_ASSERTION]: tariff.quote() miscounts the ride
                          across the DST change
ci/runs/run-1141.log:185    180 !== 120
```

### Докази

1. **PR змінює тільки тести** — `ci/changes/run-1141.diff` додає лише
   `app/test/unit/clock-change.test.js`, prod-коду не торкається. У тесті зафіксоване правило
   і поїздка:

   ```js
   // On 25.10.2026 the clocks in Kyiv go back at 04:00 (EEST +03:00 → EET +02:00).
   // 02:30 → 04:30 on the station clock
   const result = quote(ride("2026-10-25T02:30:00+03:00", "2026-10-25T04:30:00+02:00"), …);
   assert.equal(result.minutes, 120, "tariff.quote() miscounts the ride across the DST change");
   assert.equal(result.timeCharge, 4 * 2500);
   ```

   Другий тест того ж PR («a ride the evening before the change is not affected») зелений —
   падає саме ніч переведення годинника, а не загальна арифметика блоків.

2. **Відтворення на копії файлів цієї теки** (локально Node 26, у CI — Node 24; результат
   однаковий, падіння детерміноване):

   ```
   $ git apply run-1141.diff ; node --test app/test/unit/clock-change.test.js
   test at app\test\unit\clock-change.test.js:8:1
     AssertionError [ERR_ASSERTION]: tariff.quote() miscounts the ride across the DST change
     180 !== 120
   ```

3. **Арифметика.** Вивід `check-1141.mjs` (скрипт над копією `app/`):

   ```
   pickup  as instant: 2026-10-24T23:30:00.000Z
   return  as instant: 2026-10-25T02:30:00.000Z
   rideMinutes() today (real time): 180 min -> 6 blocks
   pickup  on the station clock: 2026-10-25 02:30:00 (+03:00)
   return  on the station clock: 2026-10-25 04:30:00 (+02:00)
   minutes by the station clock: 120 min -> 4 blocks
   ```

   Корінь — `src/tariff.js:70–72`:

   ```js
   function rideMinutes(pickup, returned) {
     return Math.round((returned - pickup) / 60_000);
   }
   ```

   — просто різниця двох абсолютних міток; переведення годинника вона не бачить. Реально
   минуло 180 хв (вночі годину відмотують назад), а за показами станційного годинника
   02:30→04:30 — 120 хв = 4 блоки, як вимагає правило з коментаря тесту й назви PR.
   Замітка: `docs/spec/tariffs.md` (на нього посилається шапка `src/tariff.js:1`) у цій копії
   теки відсутній, тож правило я беру з коментаря тесту, гілки `tests/clock-change-night` і
   назви PR — і відзначаю, що другий тест PR внутрішньо послідовний (120 хв ⇒ рівно
   4 блоки × 2500) і не суперечить жодному вже зеленому тесту набору.

### Що виправити

Код, не тест. Оплачувані хвилини рахувати за показами станційного годинника (Europe/Kyiv),
а не за різницею абсолютних міток: у `kyiv-time.js` уже є форматер Kyiv (`h23`) — додати туди
`kyivMinutesBetween(fromInstant, toInstant)` (кожен момент → рядок «YYYY-MM-DDTHH:mm» у Kyiv,
різниця цих «псевдо-міток»), і в `src/tariff.js` у `readRide()` використати її замість
`rideMinutes()`; перевірку «returnAt is before pickupAt» залишити на абсолютних мітках, як
зараз. За цим правилом ніч 25.10.2026 нараховує 2 год по годиннику незалежно від відмотаної
години. Окремо треба закріпити в `docs/spec/tariffs.md` крайній випадок весняного «переводу
вперед» (тоді показ годинника дає понад реальний час: 02:45→04:45 по годиннику — 120 хв
проти 60 реальних). Після фікса обидва нові тести зелені, регресій у суміжних кейсах
(45 хв, 30 хв 20 с, нічна знижка) за арифметикою блоків немає.

---

## Прогін 1144 — PR #233 «Сторінка: підказка про збір за поїздку понад добу»

**Клас: дефект тесту**, який на рівні CI виглядає як нестабільний прогін (флейк): перша
спроба — помилка, перезапуск того самого коміту — успіх (ci/README.md:30). Код застосунку
тут правильний.

### Що впало

`npm test`: 19 з 20, падає рівно один тест
`every receipt of a week of rides ends with the amount due` (`test/integration/receipt.test.js:11`):

```
ci/runs/run-1144.log:185  test at test/integration/receipt.test.js:11:1
ci/runs/run-1144.log:187    AssertionError: classic, 60 min from 2026-09-21T08:14:00.000Z:
                            got "До сплати .......................... 50,00 грн", expected 75,00 грн
```

### Докази

1. **Тест і код сперечаються лише на рівно кратних 30 хвилинах.** Тест
   (`app/test/integration/receipt.test.js:14–15`) рахує очікування так:

   ```js
   const minutes = (Date.parse(ride.returnAt) - Date.parse(ride.pickupAt)) / 60_000;
   const expected = (Math.floor(minutes / 30) + 1) * PRICE[ride.bike];
   ```

   Код же (`src/tariff.js:70–76`) спочатку округлює хвилини, потім бере `ceil` до блоків:
   45 хв → обидва варіанти дають 2 блоки (збігається з назвою тесту «a 45-minute classic ride
   costs 50 UAH»), 30 хв 20 с → 1 блок (уніт-тест `tariff.test.js:24–28` «…is billed as one
   block» зелений у всіх чотирьох логах і фіксує саме цю поведінку), рівно 60 хв → код: 2
   блоки, тест: 3 блоки. Формула `(floor+1)` збігається з прийнятим правилом скрізь, окрім
   точних кратних 30 — там вона налічує один зайвий блок. Це дефект самого тесту, не коду.

2. **Дані випадкові — тому прогін нестабільний.** `test/helpers/factory.js:10–15`:

   ```js
   const between = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
   const minutes = between(5, 89);
   ```

   Збій виникає лише тоді, коли хоча б одна з 10 випадкових поїздок має тривалість рівно
   30 або 60 хв: 2/85 ≈ 2,4 % на поїздку ⇒ ≈ 21 % на прогін. У логу впала саме 60-хвилинна.

3. **Відтворення випадку з логу.** Вивід `check-1144.mjs` (ride 08:14Z → 09:14Z, 60 хв):

   ```
   receipt last line: До сплати .......................... 50,00 грн   ← той самий рядок, що в логу
   minutes = 60
   expectation by formula of the test: 3 blocks = 7500 kopecks = 75.00 UAH   ← і «75,00» у логу
   actually by the code (rounded minutes, then ceil): 2 blocks = 5000 kopecks
   the rule of the unit suite -- for 45 min: 2 blocks; for 30 min 20 s: 1 block; for exactly 60 min: 2 blocks
   ```

   І ще 30 підряд локальних запусків цього інтеграційного тесту (дані кожного разу нові,
   бо `Math.random` у фабриці):

   ```
   $ foreach ($i in 1..30) { node --test app/test/integration/receipt.test.js }
   runs: 30, failed: 2, passed: 28
   ```

   — іноді падає, іноді ні: класичний візерунок флейку на випадкових даних, що узгоджується
   з «спроба 1 — помилка / спроба 2 — успіх» у ci/README.md.

4. **Зміна PR до падіння не стосується:** `ci/changes/run-1144.diff` — тільки
   `app/public/index.html` (абзац-підказка про збір за поїздку понад 24 години +
   `aria-describedby`); JS і тести не торкнуті.

5. Падіння `npm audit` (EAI_AGAIN) у цьому прогоні — не причина: `continue-on-error`
   (`ci/runs/run-1144.log:143`), job дійшов до `npm test` і впав на ньому.

### Що виправити

Тест, не код: замінити формулу очікування на ту, яку фіксують уніт-тести —
`Math.ceil(minutes / 30) * PRICE[ride.bike]` (для цілих хвилин фабрики еквівалентно, а на
30/60 хв тепер правильно). Далі: не будувати property-тест на `Math.random` без сиду —
зафіксувати сид/статичний набір або винести крайові точки (30, 60 хв) в окремі
детерміновані кейси. «Самопройдений» з другого разу флейк ще й маскує проблему: іншим разом
перша спроба пройшла б, і хибне очікування лишилося б непоміченим. Переписувати prod-код
під формулу тесту не можна — вона суперечить усім зеленим уніт-тестам.

---

## Прогін 1147 — PR #236 «server: PORT через parseInt, коротший рядок запуску»

**Клас: середовище** — код і тести PR не винні: `npm test` зелений (20/20), падіння — у
smoke-кроці; на порту 3000 hosted-раннера вже щось слухає, і це «щось» відповідає 404.
Обидві спроби того самого коміту впали однаково (ci/README.md:31).

### Що впало

```
ci/runs/run-1147.log:191      node:events:487  throw er; // Unhandled 'error' event
ci/runs/run-1147.log:195      Error: listen EADDRINUSE: address already in use :::3000
ci/runs/run-1147.log:199          at file:///…/app/src/server.js:74:33
ci/runs/run-1147.log:214–218  curl: (22) The requested URL returned error: 404   (5 разів)
ci/runs/run-1147.log:219      ##[error]Process completed with exit code 1.
```

Наш сервер запустився, спробував `listen(3000)` і впав — порт уже зайнятий чужим процесом.
Далі всі 5 curl потрапляють до того чужого сервера й отримують 404 (наш API на `/api/health`
відповідає 200 `{"status":"ok"}` — перевірено нижче). Тобто на порту 3000 запущеної
VM-раннера уже слухає якийсь HTTP-сервіс.

### Докази

1. **Тести зелені:** `ci/runs/run-1147.log:168–171` (`tests 20 / pass 20 / fail 0`), впав
   тільки smoke (`:176–219`) — тож ані тестовий набір, ані тарифна логіка тут ні до чого.

2. **Diff PR не міг спричинити EADDRINUSE.** Зміна (`ci/changes/run-1147.diff:10`):

   ```diff
   -  const port = Number(process.env.PORT ?? 3000);
   +  const port = Number.parseInt(process.env.PORT ?? "", 10) || 3000;
   ```

   У CI змінну `PORT` не задано; обидва варіанти обчислюються однаково (`check-1147.mjs`):

   ```
   PORT = undefined | before: 3000 | after: 3000
   PORT = "3000"   | before: 3000 | after: 3000
   PORT = ""       | before: 0    | after: 3000
   PORT = "abc"    | before: NaN  | after: 3000
   ```

   Відмінності лише на крайніх значеннях (""/не-число), до яких у CI справи не доходить;
   новий варіант навіть коректніший. Тобто падіння не спричинене зміною порту.

3. **Наш сервер сам справляється, коли порт вільний** (локально над копією `app/`):

   ```
   $ PORT=4977 node app/src/server.js &          # у фоні
   $ curl -s http://127.0.0.1:4977/api/health
   Велопрокат громади: http://localhost:4977
   {"status":"ok"}
   ```

   — здорова пара «сервер + curl» на вільному порті проходить smoke; отже, 404 у логу з
   чужого джерела, не з нашого стека.

4. **Косвенний натяк на середовище:** у run-1144 (20.10) образ раннера `Version: 20261013.1`,
   у run-1147 (22.10) — `Version: 20261020.1` (поле «Runner Image» обох логів); перший збій
   smoke за тиждень припадає на перший прогін на новому образі й повторюється на
   перезапуску. Саме по собі це не доказ, але разом із чужою 404-відповіддю вказує на
   оновлення образу/раннера як джерело.

### Що виправити

Пайплайн (код застосунку й тести не чіпати; `PORT` застосунок уже підтримує):

- не прив'язуватись до дефолтного порту 3000: у smoke-кроці підняти застосунок на власному
  порту й curl-ити саме його — `PORT=4977 npm start &` … `curl -fsS
  http://127.0.0.1:4977/api/health`, з перевіркою **тіла** відповіді (`{"status":"ok"}`), а
  не лише статусу — тоді чужий сервіс на будь-якому порті не зможе пройти smoke;
- при падінні smoke залишати діагностику в логу (`ss -ltnp`, `lsof -i :3000`), щоб наступним
  разом одразу було видно, хто тримає порт;
- повідомити в підтримку runner-images про порт 3000, зайнятий на образі `20261020.1`, або
  тимчасово перевести job на інший образ.

---

## Прогін 1152 — PR #238 «tariff: спростити feesFor»

**Клас: дефект коду** — регресія рефакторингу: із двох незалежних зборів рання версія
`feesFor` залишає тільки один.

### Що впало

`npm test`: 19 з 20, падає
`a bike kept over a day and left outside the zone pays both fees` (`test/unit/tariff.test.js:64`):

```
ci/runs/run-1152.log:185  test at test/unit/tariff.test.js:64:1
ci/runs/run-1152.log:186  ✖ a bike kept over a day and left outside the zone pays both fees
ci/runs/run-1152.log:189    1 !== 2
```

Тест (`app/test/unit/tariff.test.js:64–67`): поїздка з `2026-09-16T07:00:00Z` на
`2026-09-18T07:00:00Z` (48 год > 24 год ⇒ збір «неповернений») із поверненням на X03
(поза зоною ⇒ збір «out-of-zone») — має бути `fees.length === 2`.

### Докази

1. **Diff показує саме регресію** (`ci/changes/run-1152.diff:13–18`): до PR обидві умови
   накопичують в один масив, після PR — ранні `return`, і друга умова просто не
   перевіряється:

   ```diff
   -  const fees = [];
   -  if (zone === "out") fees.push({ code: "out-of-zone", amount: OUT_OF_ZONE_FEE });
   -  if (minutes > UNRETURNED_AFTER_MINUTES) fees.push({ code: "unreturned", amount: UNRETURNED_FEE });
   -  return fees;
   +  if (zone === "out") return [fee("out-of-zone", OUT_OF_ZONE_FEE)];
   +  if (minutes > UNRETURNED_AFTER_MINUTES) return [fee("unreturned", UNRETURNED_FEE)];
   +  return [];
   ```

   Поїздка «і поза зоною, і > 24 год» отримує тільки `out-of-zone` ⇒ `1 !== 2` — збігається
   з логом дослівно.

2. **Відтворення на копії файлів цієї теки:**

   ```
   $ node --test app/test/unit/tariff.test.js          # без патча
   ℹ tests 11   ℹ pass 11   ℹ fail 0                   # зелено

   $ git apply run-1152.diff ; node --test app/test/unit/tariff.test.js
   ✖ a bike kept over a day and left outside the zone pays both fees
     AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
     1 !== 2                                           # той самий збій, що в CI

   $ git apply -R run-1152.diff ; node --test app/test/unit/tariff.test.js
   ℹ pass 11   ℹ fail 0                                # відкочувати — знову зелено
   ```

3. `npm audit` ETIMEDOUT на початку прогону — знову не причина (`continue-on-error`,
   `ci/runs/run-1152.log:143`).

### Що виправити

Код у `src/tariff.js` (`feesFor`, у копії рядки 105–110): повернути накопичення обох умов
(вони незалежні); хелпер `fee()` з PR можна зберегти:

```js
function feesFor(minutes, zone) {
  const fees = [];
  if (zone === "out") fees.push(fee("out-of-zone", OUT_OF_ZONE_FEE));
  if (minutes > UNRETURNED_AFTER_MINUTES) fees.push(fee("unreturned", UNRETURNED_FEE));
  return fees;
}
```

Уніт-тест PR якраз фіксує цю регресію — після виправлення всі 20 тестів зелені.

---

## Коротко про уроки цих чотирьох прогонів

- Нові уніт-тести на крайові дати (ніч переведення годинника, межа «більше доби») швидко
  розкривають незакріплені правила тарифу: у 1141 — не реалізоване правило станційного
  годинника, у 1152 — рефакторинг тихо змінив поведінку саме там, де старий тест це ловив.
- Property-тест на `Math.random` (1144) перетворив детермінований дефект очікування на
  флейк: сид або фіксовані крайові кейси — обов'язкові, інакше «зеленіються» хибні формули.
- Smoke «дефолтний порт 3000 + перевірка лише статусу» (1147) крихкий і не доводить, що
  відповідав саме наш застосунок; порт — власний із середовища, перевірка — за тілом
  відповіді.
- `npm audit` може впасти на мережі; у цих пайплайнах він ходить із `continue-on-error` —
  не плутати його з причиною падіння.
