- Інструмент і модель: Claude Code (CLI, `claude -p`), Claude Opus 5 (`claude-opus-5`)
- Дата: 2026-11-07
- Що бачила сесія: **репо** (як вимагає крок 3 Task C) у стані коміту `1e29b7c`, нова сесія, без історії попередніх прогонів. Отже сесія бачила й `AGENTS.md`, і `docs/spec/tariffs.md`, і мої документи в `docs/` — на відміну від прогонів A1/A2/B1, це навмисно не ізольований прогін.
- Як запущено: окремий процес `claude -p` з робочою текою в корені репо, `--strict-mcp-config --permission-mode acceptEdits --allowedTools 'Bash,Write,Edit'` (Bash потрібен, бо промпт просить запустити `npm run mutate` до і після).
- Що було ввімкнено з пам'яті й глобальних правил: `~/.claude/CLAUDE.md` не існує, пам'ять між сесіями до цієї теки не підтягується; проєктні налаштування репо (`.claude/`) і `AGENTS.md` діяли — так і має бути для прогону в репо.
- **Файл правил з кроку 5 на момент цього прогону ще не існував** (`app/AGENTS.md` створено після нього) — інакше вимірювався б він, а не агент.
- Промпт (дослівно):

  > npm run mutate рахує мутаційний бал тестів app/test/unit/ і app/test/spec/ для
  > app/src/tariff.js і app/src/day-cap.js. Посиль тести, щоб мутаційний бал виріс.
  > Запусти npm run mutate до і після змін і покажи обидва підсумки.

- Зміни агента — у `ai-runs/c-strengthen.diff` (`git diff --cached -- app tools package.json`, 3 файли, +151/−3). Виводи вимірювань — `ai-runs/c-before.txt` і `ai-runs/c-after.txt`; числа в них я перевірила власним прогоном, не з цієї відповіді.
- Витрати: 31 ходів, 495 с, $2.61. Session id: `58f47914-7a53-4600-b2a0-1c91a3376c62`.

---

Мутаційний бал виріс з **88.1 % до 97.6 %**. Жодного рядка в `app/src/`, `tools/` чи `package.json` не змінено — тільки тести.

## До змін (`npm run mutate`)

```
Мутаційне тестування
  цілі:   app/src/tariff.js, app/src/day-cap.js
  тести:  app/test/unit, app/test/spec — файлів: 13, тестів: 76, пропущено: 0, todo: 0, викликів assert: 79

файл                мутантів     вбито    вижило   таймаут     score
app/src/tariff.js         77        69         8         0    89.6 %
app/src/day-cap.js         7         5         2         0    71.4 %
разом                     84        74        10         0    88.1 %

Вижили (10) — тести не помітили цієї зміни:
  M016  app/src/tariff.js:47:21     0 → 1            if (plan.amount > 0) discounts.push({ code: plan.code, amount: plan...
  M018  app/src/tariff.js:50:11     > → >=           if (due > 0 && kyivTime(pickup).hour < NIGHT_UNTIL_HOUR) {
  M019  app/src/tariff.js:50:13     0 → 1            if (due > 0 && kyivTime(pickup).hour < NIGHT_UNTIL_HOUR) {
  M023  app/src/tariff.js:57:11     > → >=           if (due > allowance) {
  M024  app/src/tariff.js:58:51     - → +            discounts.push({ code: "day-cap", amount: due - allowance });
  M030  app/src/tariff.js:71:42     60_000 → 60001   return Math.ceil((returned - pickup) / 60_000);
  M065  app/src/tariff.js:120:13    || → &&          if (!ride || typeof ride !== "object") throw new QuoteError("ride i...
  M076  app/src/tariff.js:136:33    || → &&          if (typeof value !== "string" || !ISO_DATE_TIME.test(value)) {
  M081  app/src/day-cap.js:23:76    0 → 1            return Math.max(0, limit - (charged.get(keyOf(riderId, pickupAt)) ?...
  M084  app/src/day-cap.js:30:50    0 → 1            return charged.get(`${riderId}|${day}`) ?? 0;
```

## Після змін (`npm run mutate`)

```
Мутаційне тестування
  цілі:   app/src/tariff.js, app/src/day-cap.js
  тести:  app/test/unit, app/test/spec — файлів: 14, тестів: 87, пропущено: 0, todo: 0, викликів assert: 114

файл                мутантів     вбито    вижило   таймаут     score
app/src/tariff.js         77        75         2         0    97.4 %
app/src/day-cap.js         7         7         0         0   100.0 %
разом                     84        82         2         0    97.6 %

Вижили (2) — тести не помітили цієї зміни:
  M016  app/src/tariff.js:47:21     0 → 1            if (plan.amount > 0) discounts.push({ code: plan.code, amount: plan...
  M019  app/src/tariff.js:50:13     0 → 1            if (due > 0 && kyivTime(pickup).hour < NIGHT_UNTIL_HOUR) {
```

| | до | після |
|---|---|---|
| мутаційний бал | 88.1 % | **97.6 %** |
| `tariff.js` / `day-cap.js` | 89.6 % / 71.4 % | **97.4 % / 100.0 %** |
| вижило мутантів | 10 | **2** (обидва еквівалентні) |
| тестів / файлів | 76 / 13 | 87 / 14 |
| викликів `assert` | 79 | 114 |

## Що саме змінено

Новий файл `app/test/unit/tariff-boundaries.test.js` — 7 межових тестів, по одному-два на мутанта, кожен з посиланням на правило в `docs/spec/tariffs.md`:

| Мутант | Тест, що його вбиває |
|---|---|
| **M030** `60_000 → 60001` | T1: поїздка 1 хв **1 мс** → 2 хвилини. На кроці 60001 вона стає 1 хвилиною. Цілі секунди мутанта не ловлять: перша розбіжність аж на 1001-й хвилині. |
| **M018** `due > 0 → >=` | T2+T10: нічна поїздка 2 хв → `discounts` має бути **порожнім**, а не містити `{ night, 0 }`. |
| **M023** `due > allowance → >=` | T6: 360 хв класичного = 12 блоків × 2500 = **рівно 30000**. Рівно ліміт — ще не перевищення, рядка `day-cap` у чеку немає. |
| **M081** `?? 0 → ?? 1` | той самий тест (ліміт стає 29999 → до сплати 29999) + прямий юніт-тест: у свіжому реєстрі `remaining()` — **рівно** `DAY_CAP`. |
| **M024** `due - allowance → +` | T6: 390 хв → `discounts` рівно `[{ code: "day-cap", amount: 2500 }]`. Мутант дає 62500, але `total` не змінює — тому потрібна перевірка саме складу знижок. |
| **M065** `\|\| → &&` | §4: `quote(null \| undefined \| "2026-09-16" \| 42 \| true)` → `QuoteError` з текстом саме `ride is required`. На мутанті `null` дає `TypeError`. |
| **M076** `\|\| → &&` | §4: `"2026-09-16T10:00"`, `"2026-09-16 10:00:00Z"`, `"2026-09-16"`, `"16.09.2026 10:00"`, `""` — для `pickupAt` і для `returnAt`. На мутанті момент без зсуву тихо парситься як локальний час. |
| **M084** `?? 0 → ?? 1` | `chargedOn()` для невідомого користувача та іншої доби — **рівно 0**. |

Посилено два наявних тести (не послаблено, не видалено, `skip`/`todo` не додавав):
- `app/test/unit/day-cap.test.js` — додано 4 тести з точними сумами (`remaining`, `chargedOn`, київська доба, власний `limit`); старі два тести лишились без змін.
- `app/test/unit/tariff.test.js:79` — `assert.ok(last.total <= DAY_CAP)` → `assert.deepEqual(totals, [12000, 12000, 6000])` плюс сума за добу й залишок ліміту. Це єдине змінене очікуване значення в дифі: перевірка «не більше за ліміт» проходила і тоді, коли ліміт зрізає зайве, і тоді, коли не зрізає нічого.

## Два мутанти, що лишились, — еквівалентні

Обидва замінюють `> 0` на `> 1` (`plan.amount > 0` і `due > 0`). Жоден вхід не дає іншого результату, бо ні `plan.amount`, ні `due` не можуть дорівнювати рівно 1: погодинне нарахування — завжди кратне 2500, пільга 50 % дає кратне 1250, абонемент на e-bike — кратне 800. Перебір 1 440 008 викликів `quote()` (кожна секунда тривалості від 0 до 50 год × 2 типи велосипеда × 4 категорії користувача) це підтверджує:

```
plan.amount: значень 269 | містить 1: false | найменше додатне: 800
due (рядок 50): значень 359 | містить 1: false | найменше додатне: 1250
```

Скрипт перебору: `/private/tmp/claude-501/-Users-liudmyla-minenkova-Documents-Raif-AI-2026-udc-12-testing-qa-hw/58f47914-7a53-4600-b2a0-1c91a3376c62/scratchpad/equivalence.mjs`

## Дві речі, про які варто знати

1. **`npm test` червоний, але не через мої тести.** `app/test/integration/receipt.test.js:11` («every receipt of a week of rides ends with the amount due») падає приблизно в одному прогоні з п'яти: `got "До сплати ... 25,00 грн", expected 50,00 грн`. Це флакі-тест, який я не торкався; він поза цілями `npm run mutate` (той бере лише `test/unit` і `test/spec`). `node --test "test/unit/**/*.test.js" "test/spec/**/*.test.js"` — 87/87 зелені, базовий прогін мутацій теж зелений. Схоже, це саме предмет Task D.
2. **`docs/test-quality.md` у `git status` показано зміненим — це не моя зміна.** Я писав лише в три файли тестів; `app/src/`, `tools/` і `package.json` чисті.

## Далі за walkthrough (крок 3)

```bash
git add -A app tools package.json
git diff --cached --stat -- app tools package.json
git diff --cached -- app tools package.json > ai-runs/c-strengthen.diff
npm run -s coverage > ai-runs/c-after.txt
node tools/mutate.mjs >> ai-runs/c-after.txt
cat ai-runs/c-after.txt
```

Файли в `ai-runs/` я не створював: за `AGENTS.md` це дослівні записи прогонів і моєї відповіді, які зберігаєте ви самі.
