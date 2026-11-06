- Інструмент і модель: Claude Code (розширення VS Code, версія 2.1.318), Claude Opus 5.5 (`claude-opus-5-5`)
- Дата: 2026-11-06
- Що бачила сесія: тимчасова тека `../ws12-d-ci` з копією `app/` і `ci/` з `main` (`diff -r` з `git archive main app ci` відмінностей не показує). За журналом сесії агент читав лише файли цієї теки: `ci/README.md`, усі логи й дифи, `app/src/`, `app/test/` і `app/README.md`. Відтворював прогони на власній копії в scratchpad
- Що було ввімкнено з пам'яті й глобальних правил: записів і файлів правил не було. Тека пам'яті сесії (`~/.claude/projects/c--Users-pikachu-UDC-task-12-ws12-d-ci/memory`) порожня. У журналі сесії немає вмісту жодного `CLAUDE.md` / `AGENTS.md`, і таких файлів у `~/.claude`, домашній теці, `UDC`, `task_12` і `ws12-d-ci` немає (перевірено після сесії, 2026-11-06)
- Звідки взято відповідь: файл записав сам агент (`../ws12-d-ci/ai-runs/d-ci-first.md`) і один раз сам виправив у ньому речення про UTC-добу. Скопійовано без змін, над текстом додано лише цю шапку
- Що агент зробив з власної ініціативи: написав і запустив скрипт `oracle-1144.mjs` у своєму scratchpad. Відтворив smoke-крок 1147 зі стороннім сервером на порту 3000. Знайшов і зупинив (`Stop-Process`) процес, що лишився після цього відтворення: `node src/server.js`, PID 33996. Файли в `ci/` і `app/` копії не змінював
- Промпт (дослівно):

  > У цій теці: ci/ — логи чотирьох невдалих прогонів CI (ci/runs/), зміни, що їх запустили
  > (ci/changes/), і опис пайплайна (ci/README.md); app/ — код застосунку і його тести.
  > Для кожного прогону визнач, чому він упав, і клас падіння: дефект коду, дефект тесту,
  > середовище або нестабільний тест. До кожного — докази (рядок логу, фрагмент diff або
  > команда над файлами цієї теки та її вивід) і що виправити.
  > Запиши відповідь у файл ai-runs/d-ci-first.md. Не змінюй файли в ci/.
  > Уточнювальних питань не став; працюй з тим, що є.

---

# Розбір чотирьох невдалих прогонів CI (19–23.10.2026)

## Підсумок

| Прогін | PR | Що впало | Причина | Клас |
|---|---|---|---|---|
| 1141 | #231 тести DST | `npm test`: `clock-change.test.js:8` | Тест очікує 120 хв за годинником станції, а поїздка тривала 180 хв | **дефект тесту** |
| 1144 | #233 підказка на сторінці | `npm test`: `receipt.test.js:11` | Тест генерує випадкові поїздки й рахує очікувану суму формулою `floor(m/30)+1`. Для 30 і 60 хв ця формула неправильна | **нестабільний тест** (сама формула теж хибна) |
| 1147 | #236 PORT через parseInt | smoke: `EADDRINUSE :::3000` | На раннері з новим образом `20261020.1` порт 3000 уже зайнятий іншим процесом | **середовище** |
| 1152 | #238 спростити feesFor | `npm test`: `tariff.test.js:64` | Після рефакторингу `feesFor` повертає лише перший збір, хоча мають бути обидва | **дефект коду** |

Що в логах **не** є причиною падінь:
- `npm audit` падає з `ENOAUDIT` (EAI_AGAIN у 1144, ETIMEDOUT у 1152), бо дзеркало `npm-mirror.example.net` недоступне. Але крок має `continue-on-error: true`, і в логах далі йде `##[warning]npm audit failed, continue-on-error is set: the job continues`.
- Попередження `Failed to save: Unable to reserve cache` (setup-node не зміг зберегти кеш), `npm cache is not found`, `Unknown project config "always-auth"` і `Node.js 20 actions are deprecated` теж нічого не ламають.
- Кожен `##[error]Process completed with exit code 1`, після якого джоба зупинилася, стоїть одразу після `npm test` (1141, 1144, 1152) або після smoke (1147).

Як я перевіряв: скопіював `app/` і `ci/` у тимчасову теку, зробив там `git init` і по черзі застосовував `git apply ci/changes/run-NNNN.diff`. Локально Node v24.18.0, у CI v24.11.1. Файли в `ci/` і `app/` я не змінював. На `main` без змін: `ℹ tests 20 / ℹ pass 20 / ℹ fail 0`, але `receipt.test.js` іноді падає й там (див. 1144).

---

## Прогін 1141: PR #231 «Тести: поїздки в ніч переведення годинника». Дефект тесту

**Чому впав.** PR додає тільки новий тест `app/test/unit/clock-change.test.js`. Тест вважає, що поїздка з 02:30 до 04:30 «за годинником станції» в ніч переведення годинника триває 120 хв. Насправді минуло 180 хв: о 04:00 EEST годинник переводять на 03:00 EET, тож година 03:00–04:00 минає двічі. `quote()` рахує фактичний час між двома моментами і правильно повертає 180.

**Докази.**

Лог `ci/runs/run-1141.log`:
```
test at test/unit/clock-change.test.js:8:1
✖ a ride on the night the clocks go back is billed by the station clock (5.513908ms)
  AssertionError [ERR_ASSERTION]: tariff.quote() miscounts the ride across the DST change
  180 !== 120
```

Diff `ci/changes/run-1141.diff` (з `src/` нічого не змінено):
```js
+  const result = quote(ride("2026-10-25T02:30:00+03:00", "2026-10-25T04:30:00+02:00"), { type: "standard" });
+  assert.equal(result.minutes, 120, "tariff.quote() miscounts the ride across the DST change");
+  assert.equal(result.timeCharge, 4 * 2500);
```

Перевірка тривалості й моменту переведення:
```
$ node -e '…Date.parse("2026-10-25T02:30:00+03:00") … Date.parse("2026-10-25T04:30:00+02:00")…'
2026-10-24T23:30:00.000Z -> 2026-10-25T02:30:00.000Z 180 min
$ node -e '…toLocaleString("uk-UA",{timeZone:"Europe/Kyiv"})…'
2026-10-25T00:59:00Z 25.10.2026, 3:59:00 GMT+3
2026-10-25T01:00:00Z 25.10.2026, 3:00:00 GMT+2
```

Локально з цим PR, за `TZ=UTC`, падіння таке саме: `180 !== 120`. На `main` усе зелене.

**Що виправити.** Виправити тест у PR #231, а не `tariff.js`. Тривалість поїздки — це різниця між моментами, а не між показами годинника. Тому має бути `result.minutes === 180` і `result.timeCharge === 6 * 2500` (6 блоків по 30 хв). Повідомлення «quote() miscounts…» і назву тесту теж слід переписати, наприклад так: «a ride across the clock change is billed by the time actually ridden». Специфікацію `docs/spec/tariffs.md` у цій теці я не знайшов. Якщо вона справді вимагає білінгу за показами годинника станції, це буде вимога змінити код, а не дефект тесту. Тоді питання треба вирішувати окремо, а цей PR лишити червоним до рішення.

---

## Прогін 1144: PR #233 «Сторінка: підказка про збір за поїздку понад добу». Нестабільний тест

**Чому впав.** PR змінює лише `public/index.html`: додає CSS-клас `.hint`, абзац `#return-hint` і `aria-describedby`. Жоден тест цей файл не читає (`server.test.js` підставляє власну `page`). Упав інтеграційний тест `receipt.test.js`. Він бере 10 випадкових поїздок тривалістю 5–89 хв (`Math.random()` у `test/helpers/factory.js`) і рахує очікувану суму формулою `Math.floor(minutes / 30) + 1`. Тариф же рахує блоки як `Math.ceil(minutes / 30)`. Ці формули дають різне лише при 30 і 60 хв. Цього разу випала поїздка на 60 хв: тест чекав 3 блоки (75 грн), код правильно нарахував 2 (50 грн). Перезапуск того самого коміту пройшов (`ci/README.md`: «2 (перезапуск того самого коміту) — успішно»).

**Докази.**

Лог `ci/runs/run-1144.log`:
```
test at test/integration/receipt.test.js:11:1
✖ every receipt of a week of rides ends with the amount due (6.768314ms)
  AssertionError [ERR_ASSERTION]: classic, 60 min from 2026-09-21T08:14:00.000Z: got "До сплати .......................... 50,00 грн", expected 75,00 грн
```

Формула в тесті (`app/test/integration/receipt.test.js:15`) і в коді (`app/src/tariff.js`, `blocks()`):
```js
const expected = (Math.floor(minutes / 30) + 1) * PRICE[ride.bike];   // тест
return Math.ceil(minutes / BLOCK_MINUTES);                              // код
```

Мій скрипт `oracle-1144.mjs` прогнав саме цю поїздку з логу через `quote()` і `formatReceipt()`, а потім перебрав усі тривалості, які може згенерувати фабрика:
```
ride from log: До сплати .......................... 50,00 грн
oracle != quote() at minutes: 30, 60 (2 of 85)
P(fail) for 10 rides: 0.212
```

Я 40 разів запустив `node --test test/integration/receipt.test.js`:
```
main:   7 of 40 runs failed
pr1144: 8 of 40 runs failed
```
Тобто тест падає приблизно в кожному п'ятому прогоні й на `main` без цього PR. До змін у PR падіння не має стосунку.

**Що виправити.** PR #233 правити не треба, його можна мержити. Виправити треба тест, окремим PR:
1. Рахувати очікувану суму так само, як тариф: `Math.ceil(minutes / BLOCK_MINUTES) * RATES[bike]` (константи імпортувати з `src/tariff.js`, а не дублювати `PRICE`).
2. Прибрати випадковість, щоб падіння відтворювалось: або фіксований набір поїздок, або генератор із фіксованим seed, який виводиться в повідомленні. Окремо додати межові випадки 29/30/31 і 59/60/61 хв.
3. Дрібниця: назва тесту «a week of rides» не відповідає даним, бо всі поїздки фабрика ставить на 21.09.2026.

---

## Прогін 1147: PR #236 «server: PORT через parseInt, коротший рядок запуску». Середовище

**Чому впав.** `npm test` пройшов (`ℹ pass 20 / ℹ fail 0`). Впав smoke-крок: `npm start` не зміг слухати порт 3000, бо його вже зайняв інший процес на раннері. Наш сервер завершився з `EADDRINUSE`, а `curl` до `127.0.0.1:3000/api/health` п'ять разів отримав **404** від того чужого процесу. Наш сервер на `/api/health` відповідає 200 `{"status":"ok"}`, а 404 дає тільки на невідомий шлях. Отже, відповідав не він. Перезапуск теж упав, тобто збій стабільний. Цей прогін і 1152 — перші на новому образі раннера `ubuntu24/20261020.1`. Прогони 1141 і 1144 ішли на `20261013.1`, але до smoke в них не дійшло. У 1152 smoke також не запускався, бо впали тести.

**Докази.**

Лог `ci/runs/run-1147.log`:
```
Error: listen EADDRINUSE: address already in use :::3000
    at file:///home/runner/work/veloprokat/veloprokat/app/src/server.js:74:33
  code: 'EADDRINUSE', … port: 3000
curl: (22) The requested URL returned error: 404      (×5)
##[error]Process completed with exit code 1.
```

Версії образу раннера (`grep -E "Version:" ci/runs/*.log`):
```
run-1141: Version: 20261013.1      run-1144: Version: 20261013.1
run-1147: Version: 20261020.1      run-1152: Version: 20261020.1
```

Я відтворив smoke-крок із PR #236 локально:
- Порт 3000 зайнятий сервером, що на все відповідає 404. Результат як у CI:
  `Error: listen EADDRINUSE: address already in use :::3000`, далі `curl: (22) The requested URL returned error: 404` і `SMOKE FAILED`.
- Порт 3000 вільний. Smoke проходить: `{"status":"ok"}`, `smoke ok=1`, у лозі сервера `Велопрокат громади слухає порт 3000`.

Зміна в PR на цей збій не впливає. Коли `PORT` не задано (так у CI: у `env:` є лише `CI: true`), і старий, і новий код слухають 3000.

**Що виправити.** Потрібна зміна в CI, а не в коді:
1. Перед запуском сервера з'ясувати, хто займає порт: `ss -ltnp 'sport = :3000'`. Якщо це сервіс, який з'явився в образі `20261020.1`, зупинити його в джобі або повідомити власникам образу.
2. Не прив'язувати smoke до 3000: `PORT=4173 npm start &` і `curl` на той самий `$PORT`. Новий `parseInt` у PR цьому не заважає.
3. Зробити так, щоб падіння сервера було видно одразу. Зберегти `pid=$!` і в циклі перевіряти `kill -0 "$pid"`, інакше `curl` до чужого процесу маскує справжню помилку. `curl` бажано пускати на `/api/health` з перевіркою тіла `{"status":"ok"}`.

Після виправлення CI PR #236 можна перезапустити. Окреме зауваження до цього PR, не пов'язане з падінням: `Number.parseInt(…) || 3000` перетворює `PORT=0` (випадковий вільний порт) і `PORT=""` на 3000. Перевірка `old vs new`: `"0" old: 0 new: 3000`. Якщо `PORT=0` десь використовують, наприклад у тестах, краще `Number.isInteger(n) && n >= 0 ? n : 3000`.

---

## Прогін 1152: PR #238 «tariff: спростити feesFor». Дефект коду

**Чому впав.** Рефакторинг змінив поведінку. Раніше `feesFor` накопичувала збори в масиві, тож поїздка поза зоною і довша за 24 год отримувала обидва: `out-of-zone` і `unreturned`. Після рефакторингу функція робить ранній `return` після першої умови і повертає тільки `out-of-zone`. Збір 2 000 грн за неповернений велосипед губиться. Новий JSDoc «T7 out of zone, T8 over 24 h» описує саме два незалежні збори.

**Докази.**

Лог `ci/runs/run-1152.log`:
```
test at test/unit/tariff.test.js:64:1
✖ a bike kept over a day and left outside the zone pays both fees (7.741812ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  1 !== 2
```

Diff `ci/changes/run-1152.diff`:
```js
-  const fees = [];
-  if (zone === "out") fees.push({ code: "out-of-zone", amount: OUT_OF_ZONE_FEE });
-  if (minutes > UNRETURNED_AFTER_MINUTES) fees.push({ code: "unreturned", amount: UNRETURNED_FEE });
-  return fees;
+  if (zone === "out") return [fee("out-of-zone", OUT_OF_ZONE_FEE)];
+  if (minutes > UNRETURNED_AFTER_MINUTES) return [fee("unreturned", UNRETURNED_FEE)];
+  return [];
```

Тест `app/test/unit/tariff.test.js:64-67` перевіряє 48-годинну поїздку з поверненням на `X03` (зона `out`) і очікує `fees.length === 2`. Локально з цим PR: `test at test\unit\tariff.test.js:64:1 … 1 !== 2`. Без PR тест зелений.

**Що виправити.** У PR #238 повернути незалежні умови. Хелпер `fee()` можна лишити:
```js
function feesFor(minutes, zone) {
  const fees = [];
  if (zone === "out") fees.push(fee("out-of-zone", OUT_OF_ZONE_FEE));
  if (minutes > UNRETURNED_AFTER_MINUTES) fees.push(fee("unreturned", UNRETURNED_FEE));
  return fees;
}
```
Тест правильний, чіпати його не треба. Можна посилити: перевіряти коди й суми зборів, а не лише їхню кількість.

---

## Попутні зауваження (не причини цих падінь)

- `app/test/unit/tariff.test.js`, тест «a 45-minute classic ride costs 50 UAH», перевіряє `mock.fn`, що повертає захардкоджену відповідь, а `quote()` не викликає зовсім. Цей тест нічого не перевіряє.
- `app/src/day-cap.js` бере день поїздки з UTC (`toISOString().slice(0, 10)`), а не з київського часу. Тому поїздки, що почалися між 00:00 і 01:59 за Києвом узимку (00:00–02:59 улітку), рахуються в денний ліміт попередньої доби. `kyivTime()` для цього в коді вже є. Варто звірити зі специфікацією T6.
