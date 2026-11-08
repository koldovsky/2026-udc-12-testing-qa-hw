- Інструмент і модель: Claude Code 2.1.319 (headless `claude -p`), claude-opus-5-5
- Дата: 2026-11-07
- Що бачила сесія: тимчасова тека `../ws12-d-ci` поруч із репо — `git archive main app ci` (коміт 4606c72): `app/src/`, `app/test/` (unit, integration, helpers), `app/public/`, `app/package.json`, `app/package-lock.json`, `app/README.md` (без `node_modules`), `ci/runs/run-1141.log`, `run-1144.log`, `run-1147.log`, `run-1152.log`, `ci/changes/run-1141.diff` … `run-1152.diff`, `ci/README.md`; у копії немає AGENTS.md/CLAUDE.md/`*.mdc`/copilot-instructions.md (у `main` немає `app/AGENTS.md`); сесію запущено з цієї теки з `--restricted` (файлові інструменти обмежені текою); інструменти Read, Write, Edit, Glob, Grep, Bash; з Bash дозволено лише `grep`, `node`, `npm test`, `npm --prefix app test`, `npm --prefix app run`, `git`, `diff`, `cp`, `mkdir`, `cd` (інші команди відхиляються автоматично, `--permission-prompts none`; read-only команди Claude Code пропускає як безпечні); режим `acceptEdits`
- Що було ввімкнено з пам'яті й глобальних правил: нічого з користувацьких/проєктних налаштувань — `--safe-mode` і `--restricted` (CLAUDE.md/AGENTS.md, користувацькі skills, plugins, hooks, output styles, MCP вимкнено) і `--strict-mcp-config` (у init `mcp_servers` порожній); глобальний `~/.claude/CLAUDE.md` порожній (0 байт); у батьківських теках над `../ws12-d-ci` (`ai_training`, `projects`, `~`) немає CLAUDE.md/AGENTS.md; пам'ять: авто-пам'ять для нової теки порожня (тека проєкту в `~/.claude/projects/` до прогону не існувала, у init-події `memory_paths` немає), `output_style` default. Лишилися лише вбудовані в Claude Code plugins (4, `@builtin`) і bundled skills (17) — жоден не викликано
- Дії агента (з журналу stream-json): Bash `find . -type f | grep -v node_modules | head -100 && cat ci/README.md`; Bash цикл `for f in ci/runs/*.log …; cat $f` + `ci/changes/*.diff` — **відхилено автоматично**; Read ci/runs/run-1141.log, Read ci/changes/run-1141.diff, Read ci/runs/run-1144.log, Read ci/changes/run-1144.diff, Read ci/runs/run-1147.log, Read ci/changes/run-1147.diff, Read ci/runs/run-1152.log, Read ci/changes/run-1152.diff, Read app/src/tariff.js, Read app/README.md, Read app/test/integration/receipt.test.js, Read app/test/helpers/factory.js, Read app/src/server.js, Read app/test/unit/tariff.test.js, Read app/test/unit/server.test.js, Read app/package.json, Read app/src/kyiv-time.js, Grep `(?i)dst|перевед|годинник|clock|wall|тривал|duration|3000|PORT` (без `**/runs/**`); Bash `rm -rf /tmp/ci-verify && mkdir -p /tmp/ci-verify && cp -R …/app /tmp/ci-verify/app && … git apply …/ci/changes/run-1141.diff && … node --test test/unit/clock-change.test.js` — **відхилено автоматично** (тека `/tmp/ci-verify` не створювалася); Bash `node -e` (різниця хвилин 02:30+03:00 → 04:30+02:00); Bash `node --input-type=module -e` (`quote()` з `app/src/tariff.js` для ночі переведення і поїздки поза зоною, порівняння формул блоків, імовірність падіння); Bash `node -e` (модель нового `feesFor` і розбір `PORT`); Bash `node --test app/test/unit/ app/test/integration/ | grep …`; Bash `npm --prefix <абсолютний шлях>/app test | grep …` — **відхилено автоматично**; Write ai-runs/d-ci-first.md. Усі шляхи виконаних викликів — у межах `../ws12-d-ci`. `ci/` не змінено (shasum усіх 9 файлів до і після збігаються); `app/` не змінено; єдиний створений файл у копії — `ai-runs/d-ci-first.md`
- Метрики прогону: 136.890 с (API 134.416 с), ходів 28, токени: вхід 26 + кеш-запис 64402 + кеш-читання 580712, вихід 11666; вартість $0.8648
- Промпт (дослівно):

  > У цій теці: ci/ — логи чотирьох невдалих прогонів CI (ci/runs/), зміни, що їх запустили
  > (ci/changes/), і опис пайплайна (ci/README.md); app/ — код застосунку і його тести.
  > Для кожного прогону визнач, чому він упав, і клас падіння: дефект коду, дефект тесту,
  > середовище або нестабільний тест. До кожного — докази (рядок логу, фрагмент diff або
  > команда над файлами цієї теки та її вивід) і що виправити.
  > Запиши відповідь у файл ai-runs/d-ci-first.md. Не змінюй файли в ci/.
  > Уточнювальних питань не став; працюй з тим, що є.

---

# Розбір падінь CI 19–23.10.2026

| Прогін | PR | Де впав | Причина | Клас |
|---|---|---|---|---|
| 1141 | #231 тести для ночі переведення годинника | `npm test`, новий `clock-change.test.js` | тест чекає 120 хв, а за годинником станції 02:30 → 04:30 у ніч переходу (+03 → +02) реально минає 180 хв | **дефект тесту** |
| 1144 | #233 підказка на сторінці | `npm test`, `receipt.test.js` | випадкові дані + хибна формула еталона: `floor(m/30)+1` ≠ `ceil(m/30)`, коли m = 30 або 60 | **нестабільний тест** (сам тест написано з помилкою) |
| 1147 | #236 PORT через parseInt | smoke (`npm start` + `curl`) | порт 3000 на раннері (образ 20261020.1) уже зайнятий сторонньою службою: `EADDRINUSE`, а на `curl` відповідає чужа служба з 404 | **середовище** |
| 1152 | #238 спростити feesFor | `npm test`, `tariff.test.js:64` | рефакторинг повертає лише перший збір: ранній `return` губить другий | **дефект коду** |

Збої `npm audit` (1144: `EAI_AGAIN`, 1152: `ETIMEDOUT` до `npm-mirror.example.net`) лежать
поза зоною відповідальності PR. Але жоден із прогонів через них не впав: у кроку є
`continue-on-error`, і в лозі після них стоїть `##[warning]npm audit failed, continue-on-error is set: the job continues`.
Те саме з `Failed to save: Unable to reserve cache` (це post-крок, лише попередження)
і з попередженням про Node.js 20 у actions.

---

## Прогін 1141: дефект тесту

**Що впало.** Новий тест із PR:

```
test at test/unit/clock-change.test.js:8:1
✖ a ride on the night the clocks go back is billed by the station clock
  AssertionError [ERR_ASSERTION]: tariff.quote() miscounts the ride across the DST change
  180 !== 120
```

Решта 21 тест зелена. PR додає лише тест (`ci/changes/run-1141.diff`, `new file mode`),
код не змінює.

**Чому це помилка тесту, а не коду.** Мітки в тесті подано зі зсувами:
`2026-10-25T02:30:00+03:00` → `2026-10-25T04:30:00+02:00`. О 04:00 EEST годинник
переводять на 03:00 EET, тож за годинником станції між 02:30 і 04:30 минає 3 години, а не 2:

```
$ node -e 'const a=Date.parse("2026-10-25T02:30:00+03:00"),b=Date.parse("2026-10-25T04:30:00+02:00");console.log((b-a)/60000, new Date(a).toISOString(), new Date(b).toISOString())'
180 2026-10-24T23:30:00.000Z 2026-10-25T02:30:00.000Z
```

`quote()` рахує тривалість як різницю моментів часу (`rideMinutes`:
`Math.round((returned - pickup) / 60_000)`, `app/src/tariff.js:70`). Для оренди за часом
так і має бути: велосипед був у користувача 180 хвилин. Еталон 120 хв (і `4 * 2500`)
насправді є різницею показів годинника, яка в ніч переходу на зимовий час недоплачує за годину.

**Що виправити** (у PR #231, тест):
- очікувати `minutes === 180` і `timeCharge === 6 * 2500`; поїздка о 02:30 нічна, тому
  `total` дорівнюватиме 10500 (перевірено: `{"minutes":180,"timeCharge":15000,"discounts":[{"code":"night","amount":4500}],...,"total":10500}`);
- виправити коментар «02:30 → 04:30 on the station clock» на «3 години реального часу»
  і назву/повідомлення, що звинувачує `tariff.quote()`;
- якщо команда справді хоче тарифікувати за показами годинника, спершу треба змінити
  специфікацію `docs/spec/tariffs.md` (її в цій теці немає), а вже потім код. Поки що
  перекладати вину на код у тесті підстав немає.

## Прогін 1144: нестабільний тест (з помилкою в еталоні)

**Що впало.**

```
test at test/integration/receipt.test.js:11:1
✖ every receipt of a week of rides ends with the amount due
  AssertionError [ERR_ASSERTION]: classic, 60 min from 2026-09-21T08:14:00.000Z: got "До сплати .......................... 50,00 грн", expected 75,00 грн
```

**Чому це не PR.** Diff (`ci/changes/run-1144.diff`) змінює лише `app/public/index.html`
(CSS-клас `.hint`, `aria-describedby` і абзац з підказкою). Тести сторінку не
завантажують: `server.test.js` підставляє `page: () => "<!doctype html>..."`. Перезапуск того
самого коміту `e3dc84e` пройшов успішно (`ci/README.md`, стовпець «Спроби»). Отже, той
самий код дав різний результат.

**Звідки нестабільність.**
- `test/helpers/factory.js` генерує поїздки через `Math.random()` без seed:
  `const minutes = between(5, 89);`.
- Еталон у тесті: `const expected = (Math.floor(minutes / 30) + 1) * PRICE[ride.bike];`
  (`receipt.test.js:15`), а тариф рахує `Math.ceil(minutes / BLOCK_MINUTES)` (`tariff.js:75`).
  Формули розходяться рівно на кратних 30 хвилинах:

```
$ node --input-type=module -e '...for (const m of [29,30,31,59,60,61]) ...'
29 test-expects 2500 tariff 2500
30 test-expects 5000 tariff 2500 MISMATCH
31 test-expects 5000 tariff 5000
59 test-expects 5000 tariff 5000
60 test-expects 7500 tariff 5000 MISMATCH
61 test-expects 7500 tariff 7500
P(fail per run)= 0.212
```

Код рахує правильно: 60 хв — це 2 блоки по 30 хв, тобто 50,00 грн. Це підтверджує тест
«a ride of 30 min 20 s is billed as one block». Ймовірність, що серед 10 випадкових
поїздок трапиться 30 або 60 хв, становить 1 − (83/85)¹⁰ ≈ 21 %. Тест падає приблизно в
кожному п'ятому прогоні на будь-якому PR.

**Що виправити** (окремим PR у тестах):
- еталон: `Math.ceil(minutes / 30) * PRICE[ride.bike]`, а краще не дублювати формулу
  тарифу, а звіряти рядок чека з `uah(quote.total)`;
- зробити дані детермінованими: seed-ований PRNG у `factory.js` або явний перелік
  граничних тривалостей (29, 30, 31, 59, 60, 61, 89). Seed виводити в повідомлення
  про помилку, щоб падіння можна було відтворити;
- зелений перезапуск 1144 не означає, що все гаразд. Дефект лишається в `main`.

## Прогін 1147: середовище (порт 3000 на раннері зайнятий)

**Що впало.** Тести пройшли (`ℹ pass 20`, `ℹ fail 0`), упав smoke-крок:

```
> node src/server.js
Error: listen EADDRINUSE: address already in use :::3000
    at file:///home/runner/work/veloprokat/veloprokat/app/src/server.js:74:33
curl: (22) The requested URL returned error: 404      (×5)
##[error]Process completed with exit code 1.
```

**Чому це середовище, а не PR.**
- Наш сервер не запустився: `EADDRINUSE`. Проте `curl` до `127.0.0.1:3000` отримує
  **HTTP-відповідь** 404, а не `connection refused`. Отже, на порту 3000 вже працює
  сторонній процес. Наш застосунок на `/api/health` завжди віддає 200 `{status:"ok"}`
  (`server.js:28-30`).
- У тестах порти не відкриваються (`server.test.js`: «tests never open a port»), тож порт
  не займає попередній крок нашого ж пайплайна.
- Образ раннера змінився: у 1141/1144 стоїть `Version: 20261013.1`, у 1147 уже
  `Version: 20261020.1`. Перезапуск того самого коміту теж упав, отже проблема стабільна,
  а не випадкова.
- Зміна PR у сценарії CI нічого не міняє. Змінна `PORT` у кроці не задана (у `env:`
  тільки `CI: true`), і стара та нова формули дають той самий порт:

```
$ node -e '...old=Number(env ?? 3000), new=Number.parseInt(env ?? "",10)||3000...'
PORT= undefined old: 3000 new: 3000
PORT= "3000" old: 3000 new: 3000
PORT= "" old: 0 new: 3000
PORT= "8080" old: 8080 new: 8080
```

  Навіть з `PORT=""`, де формули розходяться, стара версія слухала б випадковий порт, а
  `curl` на 3000 так само потрапив би на чужу службу з 404.

Застереження: прогонів `main` на образі 20261020.1, які дійшли б до smoke, у теці немає
(1152 на тому ж образі впав ще на тестах). Тому версія «образ 20261020.1 займає порт 3000»
вкрай імовірна, але в цих логах прямо не підтверджена. Перевірити можна одним кроком
`sudo ss -ltnp 'sport = :3000'` на раннері.

**Що виправити** (у workflow, не в PR #236; PR можна мержити після зеленого smoke):
- запускати smoke на гарантовано вільному порту: `PORT=3917 npm start &` і `curl` на той
  самий порт, або спершу знайти вільний порт;
- зробити smoke чутливим до власного процесу: зберігати PID, перевіряти, що процес
  живий, і вважати успіхом лише тіло `{"status":"ok"}`, а не будь-яку відповідь на порту;
- закріпити версію образу раннера або стежити за release notes, щоб зміни образу не
  ламали збірки непомітно;
- бажано (код): обробити `server.on("error")` у `server.js` і виводити зрозуміле
  повідомлення, а не `Unhandled 'error' event`.

## Прогін 1152: дефект коду

**Що впало.**

```
test at test/unit/tariff.test.js:64:1
✖ a bike kept over a day and left outside the zone pays both fees
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  1 !== 2
```

**Причина.** Рефакторинг `feesFor` у `ci/changes/run-1152.diff` замінив накопичення
на ранній вихід:

```diff
-  const fees = [];
-  if (zone === "out") fees.push({ code: "out-of-zone", amount: OUT_OF_ZONE_FEE });
-  if (minutes > UNRETURNED_AFTER_MINUTES) fees.push({ code: "unreturned", amount: UNRETURNED_FEE });
-  return fees;
+  if (zone === "out") return [fee("out-of-zone", OUT_OF_ZONE_FEE)];
+  if (minutes > UNRETURNED_AFTER_MINUTES) return [fee("unreturned", UNRETURNED_FEE)];
+  return [];
```

Коли поїздка довша за добу і велосипед повернуто поза зоною, збір T8 «unreturned»
(2000 грн) губиться. Навіть коментар, доданий у тому ж diff («T7 out of zone, T8 over 24 h»),
описує два незалежні збори. Перевірка (логіка нової функції, тривалість 2880 хв, зона `out`)
у порівнянні з поточним `main`:

```
1152 new feesFor(2880,out): [{"code":"out-of-zone","amount":15000}]
main fees:                  [{"code":"out-of-zone","amount":15000},{"code":"unreturned","amount":200000}]
```

Тест правильний. Падіння audit у цьому ж прогоні (`ETIMEDOUT`) на результат не впливає,
див. вище.

**Що виправити** (у PR #238): залишити хелпер `fee()`, але збирати обидва збори,
наприклад:

```js
function feesFor(minutes, zone) {
  const fees = [];
  if (zone === "out") fees.push(fee("out-of-zone", OUT_OF_ZONE_FEE));
  if (minutes > UNRETURNED_AFTER_MINUTES) fees.push(fee("unreturned", UNRETURNED_FEE));
  return fees;
}
```

Також варто посилити тест: перевіряти коди та суми зборів, а не лише `fees.length`.

---

## Як перевірялося і чого перевірити не вдалося

- Прочитано всі 4 логи, 4 diff-и, `ci/README.md`, вихідний код і тести в `app/`.
- Обчислення вище виконано через `node -e` / `node --input-type=module -e`. Вони
  імпортують `app/src/tariff.js` з поточного `main` (1141, 1144, 1152-main) або відтворюють
  логіку з diff (1152-new, 1147).
- Запустити `git apply ci/changes/*.diff` у тимчасовій копії та `npm test` у цій сесії
  не вдалося: середовище заблокувало ці команди, бо вимагало підтвердження, а підтвердити
  було нікому. Щоб перевірити повністю локально:
  `git apply ci/changes/run-NNNN.diff && (cd app && npm test); git apply -R ci/changes/run-NNNN.diff`.
  Для 1144 тест варто прогнати кілька разів (`for i in $(seq 20); do node --test test/integration/receipt.test.js; done`):
  очікувано він падає приблизно в 1 із 5 запусків.
- Файли в `ci/` не змінювались.
