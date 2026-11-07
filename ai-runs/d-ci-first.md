- Tool and model: Claude Code 2.1.301, `claude -p` (non-interactive), Claude Opus 5.5 (`claude-opus-5-5`). The session result also lists `claude-haiku-5-5` usage.
- Date: 2026-11-07
- What the session saw: temporary folder `../ws12-d-ci` with `app/` and `ci/` from `main` (`git archive main app ci`, `docs/walkthrough.md`, Task D step 4). No specification, no `docs/`, no `CLAUDE.md` or `AGENTS.md`, no `.claude/`. The tool log shows a `find` over the folder and a `cat` of `ci/README.md`, the four logs and the four diffs (read back in two parts from the session's saved tool output), then `app/README.md`, `app/package.json`, `app/src/tariff.js`, `kyiv-time.js`, `day-cap.js`, `receipt.js`, `server.js`, `app/test/helpers/factory.js`, `app/test/integration/receipt.test.js`, `app/test/unit/day-cap.test.js`, `app/test/unit/server.test.js`, lines 55-80 of `app/test/unit/tariff.test.js`, an `ls -la` of `app/` and one Grep in `app/`.
- Enabled from memory and global rules: nothing. There is no `~/.claude/CLAUDE.md` and no `CLAUDE.md` or `AGENTS.md` in the parent folders. User settings (plugins, hooks) were not loaded (`--setting-sources project`), auto-memory was off, no MCP servers were loaded (`--strict-mcp-config`), skills were off (`--disable-slash-commands`). Only Claude Code's built-in plugins were present.
- How it ran: a new session with no history, started from the terminal by the participant's main agent session. Read, Glob, Grep, Write, Edit and the commands `npm test`, `npm --prefix app test`, `node --test`, `git apply`, `ls` and `mkdir` were allowed without approval; read-only shell commands (`find`, `cat`, `sed`) also ran. Eight commands were denied. Two were compound reads (one with a `for` loop, one with `ls -la ..` outside the folder); it re-ran both in an allowed form. Six were attempts to reproduce the runs: copying `app/` into its own scratchpad and applying the diffs there (`cp`, `cd … && git apply`, `patch`), running two check scripts it had written into its scratchpad, and a `node --input-type=module` probe of `quote()`. It therefore applied no diff and ran no test on a changed copy; the one test command it ran is `npm test` on the `main` copy (`tests 20`, `pass 20`, `fail 0`). It wrote `ai-runs/d-ci-first.md` and then edited one sentence in it. `diff -r` against a fresh `git archive main app ci` shows `ci/` and `app/` unchanged. Its final message summarised the file in a table and said that it had run only `npm test` on `main`. The text below the line is the file, unchanged.
- Prompt (verbatim):

  > У цій теці: ci/ — логи чотирьох невдалих прогонів CI (ci/runs/), зміни, що їх запустили
  > (ci/changes/), і опис пайплайна (ci/README.md); app/ — код застосунку і його тести.
  > Для кожного прогону визнач, чому він упав, і клас падіння: дефект коду, дефект тесту,
  > середовище або нестабільний тест. До кожного — докази (рядок логу, фрагмент diff або
  > команда над файлами цієї теки та її вивід) і що виправити.
  > Запиши відповідь у файл ai-runs/d-ci-first.md. Не змінюй файли в ci/.
  > Уточнювальних питань не став; працюй з тим, що є.

---

# Розбір падінь CI, 19–23.10.2026

| Прогін | PR | Де впало | Клас | Коротко |
|---|---|---|---|---|
| 1141 | #231 тести DST | `npm test`, новий тест `clock-change.test.js` | **дефект тесту** | тест чекає 120 хв, а поїздка реально тривала 180 хв |
| 1144 | #233 підказка на сторінці | `npm test`, `integration/receipt.test.js` | **нестабільний тест** | випадкові дані + хибна формула очікування в тесті; перезапуск пройшов |
| 1147 | #236 PORT через parseInt | smoke (`npm start` + `curl`) | **середовище** | порт 3000 на раннері вже зайнятий чужим процесом; перезапуск теж впав |
| 1152 | #238 спростити feesFor | `npm test`, `unit/tariff.test.js:64` | **дефект коду** | рефакторинг повертає лише один збір замість двох |

Що я перевірив сам: `npm test` у `app/` на `main` (локально, Node v24.21.0) — `tests 20, pass 20, fail 0`.
Отже, всі три падіння `npm test` (1141, 1144, 1152) з'являються лише зі змінами з PR або
залежать від випадкових даних, а не від поламаного `main`.
Запустити node-скрипти й `git apply` у копії теки мені не дали права доступу в цій сесії.
Тому команди в розділах нижче — це відтворення для читача, а висновки спираються на лог,
diff, код і арифметику, наведену поруч.

---

## 1141 — дефект тесту

**Причина.** Новий тест у PR #231 рахує тривалість поїздки за показами настінного годинника
станції. Насправді поїздка через нічне переведення годинника тривала на годину довше.

**Докази.**

- Лог (`ci/runs/run-1141.log`):
  ```
  test at test/unit/clock-change.test.js:8:1
  ✖ a ride on the night the clocks go back is billed by the station clock
    AssertionError [ERR_ASSERTION]: tariff.quote() miscounts the ride across the DST change
    180 !== 120
  ```
- Diff (`ci/changes/run-1141.diff`) — тест додано в цьому PR, коду він не змінює:
  ```js
  // On 25.10.2026 the clocks in Kyiv go back at 04:00 (EEST +03:00 → EET +02:00).
  // 02:30 → 04:30 on the station clock
  quote(ride("2026-10-25T02:30:00+03:00", "2026-10-25T04:30:00+02:00"), ...)
  assert.equal(result.minutes, 120, ...)
  assert.equal(result.timeCharge, 4 * 2500);
  ```
- Арифметика: `02:30+03:00` = `2026-10-24T23:30Z`, `04:30+02:00` = `2026-10-25T02:30Z`,
  тобто між ними **180 хв**. Інтервал 03:00–04:00 цієї ночі на годиннику повторюється
  двічі. Велосипед був у користувача 3 години, а не 2.
- Код рахує тривалість за реальними моментами часу, а не за показами годинника
  (`app/src/tariff.js:70`): `Math.round((returned - pickup) / 60_000)`.
  `Date.parse` враховує зсув з ISO-рядка, тож 180 — правильна відповідь.
  Контракт `quote` (шапка `tariff.js`) приймає «ISO 8601 date-time with Z or an offset»,
  тобто саме моменти часу.
- Другий тест із PR («evening before the change») пройшов, а `main` зелений.

Відтворити: `git apply ci/changes/run-1141.diff && (cd app && node --test test/unit/clock-change.test.js)`.

**Що виправити.** Виправити тест у PR #231, код не чіпати: очікувати `minutes === 180` і
`timeCharge === 6 * 2500`. Друга можливість — лишити 120 хв, але взяти поїздку, яка
справді триває 2 години, наприклад `02:30+03:00 → 03:30+02:00`. Назву тесту варто змінити на
«billed by the real duration». Одне застереження: специфікації `docs/spec/tariffs.md` у цій теці немає.
Якщо вона прямо вимагає тарифікувати за годинником станції, це вже дефект коду, і рішення
приймає власник тарифів. Але брати з користувача оплату за 2 години, коли поїздка тривала 3,
виглядає помилкою саме тесту.

---

## 1144 — нестабільний тест (корінь — хибне очікування в тесті)

**Причина.** `integration/receipt.test.js` генерує 10 випадкових поїздок і рахує
очікувану суму формулою `(Math.floor(minutes / 30) + 1) * PRICE`. Для тривалостей, кратних
30 хв, формула дає на один блок більше, ніж правило тарифу (кількість блоків `ceil(minutes / 30)`).
Тож тест падає лише тоді, коли генератор випадково видає рівно 30 або 60 хв.

**Докази.**

- Лог (`ci/runs/run-1144.log`):
  ```
  test at test/integration/receipt.test.js:11:1
  AssertionError: classic, 60 min from 2026-09-21T08:14:00.000Z:
    got "До сплати .......................... 50,00 грн", expected 75,00 грн
  ```
  60 хв — це 2 блоки по 30 хв × 25 грн = 50 грн, тож код правий. Тест чекав 3 блоки.
- Код: `app/src/tariff.js` → `blocks = Math.ceil(minutes / BLOCK_MINUTES)`.
  Тест: `app/test/integration/receipt.test.js:15` → `Math.floor(minutes / 30) + 1`.
  Формули розходяться лише при `minutes % 30 === 0`.
- Випадковість: `app/test/helpers/factory.js:15` → `between(5, 89)` з `Math.random()`, без seed.
  Збій дають 2 значення з 85 (30 і 60). Імовірність падіння прогону з 10 поїздками:
  1 − (83/85)^10 ≈ **21 %**.
- Diff PR #233 змінює лише `app/public/index.html`: CSS-клас і `<p id="return-hint">`.
  Цей файл не імпортують ні `tariff.js`, ні `receipt.js`, ні тест.
- README: «2 (перезапуск того самого коміту) — успішно».
- Шум у лозі, який не впливає на результат: `npm audit` впав через `getaddrinfo EAI_AGAIN
  npm-mirror.example.net`, але `continue-on-error is set: the job continues`.
  Попередження `Failed to save: Unable to reserve cache` теж ні на що не вплинуло.

Відтворити: запускати `node --test test/integration/receipt.test.js` у циклі. Приблизно
кожен п'ятий запуск має падати і на `main`, бо PR тут ні до чого.

**Що виправити.** Тест, не код і не PR #233:

1. Виправити формулу: `Math.ceil(minutes / 30) * PRICE[ride.bike]`. Варто також окремо
   врахувати правило безкоштовного старту, `< 2 хв`.
2. Прибрати недетермінізм: дати генератору seed (наприклад, `mulberry32(seed)` і друкувати seed у
   повідомленні про помилку). Або додати фіксовані межові випадки 29/30/31/59/60/61 хв
   окремим тестом.
3. PR #233 можна зливати. Падіння вже є на `main`, тож перезапуском його лише маскують.

---

## 1147 — середовище

**Причина.** Тести пройшли (`pass 20, fail 0`), упав крок smoke. На момент `npm start`
порт 3000 на раннері вже слухав чужий процес. Наш сервер завершився з `EADDRINUSE`,
а `curl` отримував 404 від того чужого процесу.

**Докази.**

- Лог (`ci/runs/run-1147.log`):
  ```
  Error: listen EADDRINUSE: address already in use :::3000
      at file:///home/runner/work/veloprokat/veloprokat/app/src/server.js:74:33
  curl: (22) The requested URL returned error: 404    (×5)
  ```
  Наш процес упав одразу, тож 404 на `/api/health` віддавав хтось інший. Наш сервер на
  цей шлях завжди відповідає 200 (`app/src/server.js`, гілка `/api/health`).
- Порт займає не наш тестовий крок: тести порт не відкривають
  (`app/src/server.js:7`, `app/test/unit/server.test.js:6` — «tests never open a port»).
- Зміна образу раннера: у 1141 і 1144 `Version: 20261013.1`, у 1147 (і 1152)
  `Version: 20261020.1`. Пайплайн і крок smoke не змінювалися.
- Перезапуск того самого коміту теж упав (README), тобто збій детермінований для цього
  середовища, а не випадковий.
- Diff PR #236 при незаданому `PORT` поводиться так само, як до змін:
  `Number(undefined ?? 3000)` = 3000 і `Number.parseInt("", 10) || 3000` = 3000.
  Решта змін стосується тексту в `console.log`. У кроці `env:` логу задано лише `CI: true`.

Діагностика на раннері (додати перед `npm start`):
`ss -ltnp 'sport = :3000' || true; curl -si http://127.0.0.1:3000/ | head -5`.
Так видно, хто тримає порт.

**Що виправити.** Пайплайн:

1. Запускати smoke на окремому порту: `PORT=38080 npm start &` і
   `curl -fsS http://127.0.0.1:38080/api/health`. Або спершу перевіряти, що порт вільний.
2. Посилити smoke: падати одразу, якщо процес сервера помер (`kill -0 $!`), і перевіряти тіло
   відповіді `{"status":"ok"}`, а не лише код. Тоді чужий сервіс не дасть хибного «зеленого».
3. Повідомити про регресію образу `ubuntu-24.04` 20261020.1 (сервіс на :3000) або закріпити
   попередню версію образу.

Зауваження до PR #236, не причина падіння. Нова версія змінює крайні випадки:
`PORT=""` раніше давав `Number("")` = 0 (випадковий порт), тепер 3000.
`PORT=0` раніше означав випадковий порт, тепер `0 || 3000` дає 3000.
Якщо `PORT=0` десь використовують, краще писати `Number.isInteger(n) && n >= 0 ? n : 3000`.

---

## 1152 — дефект коду

**Причина.** Рефакторинг `feesFor` у PR #238 замінив накопичення зборів на ранні `return`.
Поїздка поза зоною, яка до того ж триває понад 24 год, тепер отримує лише збір
`out-of-zone` і втрачає `unreturned` (2000 грн).

**Докази.**

- Лог (`ci/runs/run-1152.log`):
  ```
  test at test/unit/tariff.test.js:64:1
  ✖ a bike kept over a day and left outside the zone pays both fees
    1 !== 2   (actual: 1, expected: 2)
  ```
- Diff (`ci/changes/run-1152.diff`):
  ```diff
  -  const fees = [];
  -  if (zone === "out") fees.push({ code: "out-of-zone", amount: OUT_OF_ZONE_FEE });
  -  if (minutes > UNRETURNED_AFTER_MINUTES) fees.push({ code: "unreturned", amount: UNRETURNED_FEE });
  -  return fees;
  +  if (zone === "out") return [fee("out-of-zone", OUT_OF_ZONE_FEE)];
  +  if (minutes > UNRETURNED_AFTER_MINUTES) return [fee("unreturned", UNRETURNED_FEE)];
  +  return [];
  ```
  Тест (`app/test/unit/tariff.test.js:64-66`) бере 48 год і станцію `X03` (поза зоною). Він
  чекає обидва збори, як і обіцяє коментар у самому PR: «T7 out of zone, T8 over 24 h».
- На `main` цей тест зелений (локальний `npm test`: 20/20). Падіння спричиняє саме diff.
- Шум, що не вплинув на результат: `npm audit` → `connect ETIMEDOUT 192.0.2.41:443`,
  `continue-on-error`.

Відтворити: `git apply ci/changes/run-1152.diff && (cd app && npm test)`.

**Що виправити.** Код у PR #238. Збори мають накопичуватися, а не виключати один одного:

```js
/** Fees of a ride: T7 out of zone, T8 over 24 h. */
function feesFor(minutes, zone) {
  const fees = [];
  if (zone === "out") fees.push(fee("out-of-zone", OUT_OF_ZONE_FEE));
  if (minutes > UNRETURNED_AFTER_MINUTES) fees.push(fee("unreturned", UNRETURNED_FEE));
  return fees;
}
```

Тест правильний, послаблювати його не можна. Він і зловив регресію.

---

## Спільне для всіх прогонів (не причина падінь)

- `npm audit` залежить від `npm-mirror.example.net`, який двічі за тиждень був недоступний
  (`EAI_AGAIN`, `ETIMEDOUT`). Крок має `continue-on-error`, тому лише додає шуму й 36 секунд
  у 1152. Варто прибрати ретраї або винести audit в окремий плановий job.
- `Node.js 20 actions are deprecated … actions/setup-node@v4` — оновити `setup-node`
  до версії на Node 24.
- `npm warn Unknown project config "always-auth"` — прибрати `always-auth` з `.npmrc`.
