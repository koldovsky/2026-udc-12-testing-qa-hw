- Інструмент і модель: GitHub Copilot CLI 1.0.96, окремий sub-agent `general-purpose` (модель sub-agent'а — за замовчуванням harness; головна сесія — Claude Opus 5.5), запущений головним агентом як нова сесія без історії
- Дата: 2026-11-04
- Що бачила сесія: тимчасова тека `../ws12-d-ci` — `git archive main app ci` (main = 4606c72, тобто код до моїх виправлень з Task B), без `docs/` (специфікації не було), без мого `app/AGENTS.md`
- Що було ввімкнено з пам'яті й глобальних правил: не вимикалося. Sub-agent стартував із CLI, відкритого в репо, тож у його системному контексті могли бути `AGENTS.md` / `CLAUDE.md` кореня репо і пам'ять Copilot. До промпта додано одне службове речення (англійською) з робочою текою.
- Промпт (дослівно):

  > Your working directory is /Users/sergii.osadchyi-external/IdeaProjects/udc-worksop/ws12-d-ci — work only inside it (all paths below are relative to it).
  >
  > У цій теці: ci/ — логи чотирьох невдалих прогонів CI (ci/runs/), зміни, що їх запустили
  > (ci/changes/), і опис пайплайна (ci/README.md); app/ — код застосунку і його тести.
  > Для кожного прогону визнач, чому він упав, і клас падіння: дефект коду, дефект тесту,
  > середовище або нестабільний тест. До кожного — докази (рядок логу, фрагмент diff або
  > команда над файлами цієї теки та її вивід) і що виправити.
  > Запиши відповідь у файл ai-runs/d-ci-first.md. Не змінюй файли в ci/.
  > Уточнювальних питань не став; працюй з тим, що є.

---

# Тріаж падінь CI, 19–23.10.2026 (перша відповідь AI)

Джерела: `ci/README.md`, `ci/runs/run-*.log`, `ci/changes/run-*.diff`, `app/`.
Перевірка локально: Node v22.22.3, копія `app/` з накладеним diff (`git apply -p2 ci/changes/run-NNNN.diff`),
`node --test --test-reporter=spec "test/**/*.test.js"`. Файли в `ci/` не змінювались.

## Підсумок

| Прогін | PR | Де впав | Причина | Клас |
|---|---|---|---|---|
| 1141 | #231 тести на ніч переведення годинника | `npm test`, новий `clock-change.test.js` | тест очікує різницю «настінного» часу (120 хв), а поїздка реально тривала 180 хв | **дефект тесту** |
| 1144 | #233 підказка на сторінці | `npm test`, `integration/receipt.test.js` | випадкові дані + хибний оракул `floor(m/30)+1` (неправильний для рівно 30/60 хв) | **нестабільний тест** (корінь — дефект тесту) |
| 1147 | #236 PORT через parseInt | smoke (`npm start` + `curl`) | порт 3000 на раннері вже зайнятий іншим процесом (`EADDRINUSE`, `curl` отримує 404 від чужого сервера) | **середовище** |
| 1152 | #238 спростити feesFor | `npm test`, `unit/tariff.test.js:64` | рефакторинг з раннім `return` губить другий збір (T7 + T8) | **дефект коду** (регресія в PR) |

Шум, який **не** є причиною падінь: `npm audit` у 1144/1152 падає через недоступне дзеркало
(`EAI_AGAIN` / `ETIMEDOUT 192.0.2.41:443`), але крок має `continue-on-error`
(`##[warning]npm audit failed, continue-on-error is set: the job continues`); попередження
`Node.js 20 actions are deprecated`, `Failed to save: Unable to reserve cache`, `Unknown project config "always-auth"` —
теж не впливають на результат.

---

## Run 1141 — дефект тесту

**Що впало.** Новий тест із PR:
```
run-1141.log:150  ✖ a ride on the night the clocks go back is billed by the station clock
run-1141.log:183    AssertionError [ERR_ASSERTION]: tariff.quote() miscounts the ride across the DST change
run-1141.log:194    actual: 180,
run-1141.log:195    expected: 120,
```

**Доказ, що помиляється тест, а не код.** Diff додає лише файл тесту:
```diff
+  // 02:30 → 04:30 on the station clock
+  const result = quote(ride("2026-10-25T02:30:00+03:00", "2026-10-25T04:30:00+02:00"), { type: "standard" });
+  assert.equal(result.minutes, 120, ...);
+  assert.equal(result.timeCharge, 4 * 2500);
```
`02:30+03:00` = `2026-10-24T23:30Z`, `04:30+02:00` = `2026-10-25T02:30Z` — між ними **3 години** реального часу
(о 04:00 EEST годинник переводять на 03:00, година 03:00–04:00 проходить двічі). Тест сам це визнає
коментарем «clocks go back», але очікує різницю показів годинника (2 год). `tariff.js` рахує тривалість з
абсолютних моментів: `Math.round((returned - pickup) / 60_000)` → 180 хв, 6 блоків. Клієнт справді
користувався велосипедом 180 хв, тож 120 хв недоплачувало б годину. Вихідний код у PR не змінювався,
інші тести зелені (`run-1141.log:173 ℹ fail 1`).

Відтворення: з накладеним diff — `✖ ... actual: 180, expected: 120` (решта 21 тест зелені).

**Що виправити.** У `app/test/unit/clock-change.test.js` очікувати `minutes === 180` і
`timeCharge === 6 * 2500` (і перейменувати тест: «billed by the time actually ridden»), або вибрати
інтервал, де відповідь однозначна. Застереження: специфікація (`docs/spec/tariffs.md`, не входить у цю теку)
— остаточний арбітр; якщо вона явно вимагає рахувати «за годинником станції», клас змінюється на дефект коду.

## Run 1144 — нестабільний тест

**Що впало.**
```
run-1144.log:185  test at test/integration/receipt.test.js:11:1
run-1144.log:186  ✖ every receipt of a week of rides ends with the amount due
run-1144.log:187    AssertionError: classic, 60 min from 2026-09-21T08:14:00.000Z: got "До сплати ... 50,00 грн", expected 75,00 грн
```
За `ci/README.md` перезапуск **того самого коміту** (`e3dc84e`) пройшов успішно.

**Доказ.**
1. Diff змінює лише `app/public/index.html` (CSS-клас `.hint` і `<p id="return-hint">`); жоден тест не
   читає цю розмітку (`grep -rn "return-hint\|hint" app/test` — порожньо). Зміна не могла вплинути на `quote()`.
2. Тест генерує випадкові поїздки (`test/helpers/factory.js`: `Math.random()`, тривалість `between(5, 89)` хв)
   і рахує очікування власною формулою `(Math.floor(minutes / 30) + 1) * PRICE[bike]`. Для рівно 30 і 60 хв
   вона дає на блок більше, ніж правило блоків по 30 хв (`Math.ceil`) у `tariff.js`:
   ```
   $ node -e 'for(const x of [30,60])console.log(x,"oracle",Math.floor(x/30)+1,"code",Math.ceil(x/30))'
   30 oracle 2 code 1
   60 oracle 3 code 2
   ```
   60 хв класичного = 2 блоки = 50,00 грн — це правильно; тест чекав 75,00 грн.
3. Імовірність: 10 поїздок, 2 «погані» значення з 85 → `1 − (83/85)^10 ≈ 0,21`. Локально 200 прогонів
   незміненого `app/`: **36/200** падінь, усі — саме цей тест.

**Що виправити.** У `app/test/integration/receipt.test.js` прибрати `Math.random()` (фіксовані поїздки або
seed) і явно включити межові тривалості 30 і 60 хв; оракул — `Math.ceil(minutes / 30)` (або фіксовані
очікувані суми з таблиці). Додатково `randomRider()` у тесті «outside the zone» теж зробити детермінованим.

## Run 1147 — середовище

**Що впало.** Тести зелені (`ℹ pass 20`, `ℹ fail 0`), падає smoke-крок:
```
run-1147.log:189  > node src/server.js
run-1147.log:195  Error: listen EADDRINUSE: address already in use :::3000
run-1147.log:214–218  curl: (22) The requested URL returned error: 404   (×5)
run-1147.log:219  ##[error]Process completed with exit code 1.
```
Наш сервер не стартував, а на `127.0.0.1:3000` уже відповідає **інший** процес (404 на `/api/health`,
тоді як наш `server.js` має цей маршрут і тест `GET / serves the page and GET /api/health answers` зелений).
Перезапуск того самого коміту — знову помилка, тобто стабільно на цьому раннері.

**Чому не код PR.** Diff міняє лише обчислення порту і текст повідомлення. Без `PORT` обидві версії дають 3000:
```
$ env -u PORT node -e '…old: Number(process.env.PORT ?? 3000), new: Number.parseInt(process.env.PORT ?? "",10)||3000'
unset old 3000 new 3000
```
У кроці smoke `PORT` не задано (блок `env:` містить лише `CI: true`). Зміна образу раннера: у 1147
`Image Release: ubuntu24/20261020.1`, у 1141/1144 — `ubuntu24/20261013.1`; 1152 теж на новому образі, але до
smoke не дійшов (впав на тестах). Припущення: у новому образі щось займає порт 3000.

**Що виправити (пайплайн).** У smoke задавати вільний порт (`PORT=3123 npm start &`, `curl …:3123`), перед
стартом перевіряти, що порт вільний (`ss -ltnp | grep :$PORT` — і показувати, хто його тримає), і
перевіряти, що наш процес живий (`kill -0 $!`), щоб `EADDRINUSE` давав зрозумілу помилку, а не 404 від
чужого сервера. Код PR можна мерджити. Побічне зауваження до PR (не причина падіння): нова версія змінює
поведінку для `PORT=0` (раніше — випадковий вільний порт, тепер 3000) і мовчки приймає `PORT=3000abc`.

## Run 1152 — дефект коду (регресія)

**Що впало.**
```
run-1152.log:185  test at test/unit/tariff.test.js:64:1
run-1152.log:186  ✖ a bike kept over a day and left outside the zone pays both fees
run-1152.log:200    actual: 1,
run-1152.log:201    expected: 2,
```
**Доказ — diff:**
```diff
-  const fees = [];
-  if (zone === "out") fees.push({ code: "out-of-zone", amount: OUT_OF_ZONE_FEE });
-  if (minutes > UNRETURNED_AFTER_MINUTES) fees.push({ code: "unreturned", amount: UNRETURNED_FEE });
-  return fees;
+  if (zone === "out") return [fee("out-of-zone", OUT_OF_ZONE_FEE)];
+  if (minutes > UNRETURNED_AFTER_MINUTES) return [fee("unreturned", UNRETURNED_FEE)];
+  return [];
```
Ранній `return` для поза-зонного повернення не дає додати збір за неповернення (T7 і T8 мають
накопичуватися — це прямо пише і новий JSDoc-коментар «T7 out of zone, T8 over 24 h»). Тест
(`ride 2026-09-16T07:00Z → 2026-09-18T07:00Z`, станція `X03`) очікує 2 збори й отримує 1 — тобто
клієнт недоплачує 2 000 грн. Відтворення з накладеним diff: `actual: 1, expected: 2`; без diff тест зелений.
`npm audit` з `ETIMEDOUT` у цьому лозі — шум (`continue-on-error`).

**Що виправити.** Повернути накопичення зборів у `feesFor` (масив + `push`, можна зберегти хелпер `fee()`).
Тест коректний — не чіпати; за бажання додати випадок «поза зоною, < 24 год» і «у зоні, > 24 год».
