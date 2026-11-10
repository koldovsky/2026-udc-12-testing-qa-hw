- Інструмент і модель: Claude Code 2.1.322, Claude Opus 5.5 (`claude-opus-5-5`, effort high); інтерактивна сесія, режим дозволів `bypassPermissions` з `~/.claude/settings.json`
- Дата: 2026-11-10
- Що бачила сесія:
  - **Тека.** Тимчасова тека `../ws12-d-flaky/` з власним git (коміт `314837a base`): `git archive HEAD app tools package.json .gitattributes` з репо на `7d2fee9` («Task C») плюс `ai-runs/d-repeat-before.txt`, усього 46 файлів. Файлу правил `app/AGENTS.md` / `app/CLAUDE.md` у копії немає (`git ls-tree` базового коміту — жодного `AGENTS`, `CLAUDE`, `rules`); `docs/` немає.
  - **Тека `.idea/`** з'явилася в копії від IDE, агент її не створював.
  - **Запит перед промптом.** У тій самій сесії (2026-11-10T11:44:13Z) учасник спершу спитав, чи є в теці файл правил всередині `app/`. Агент відповів, що файлів правил асистента немає, а специфікація `docs/spec/tariffs.md` відсутня. Це єдиний контекст, який був у сесії до промпту.
  - **Що агент читав і змінював.** За транскриптом (`~/.claude/projects/-Users-vlad-Projects-rbi-ai-training-hw-ws12-d-flaky/9f7e8e02-3d1d-4d17-8ff2-4815695284de.jsonl`) у відповідь на промпт агент змінив лише `app/test/integration/receipt.test.js` (11:46:14Z) і сам створив `ai-runs/d-flaky-first.md` (11:46:30Z). Обидві зміни — в `ai-runs/d-flaky-first.diff`.
  - **Після першої відповіді** в тій самій сесії були подальші запити учасника (11:49Z — чи є retry / sleep / skip, далі — крок 3 з `docs/triage.md` і `d-repeat-after.txt` у копії). Вони сюди **не** входять: це вже не перша відповідь.
- Що було ввімкнено з пам'яті й глобальних правил: пам'ять проєкту порожня (тека `memory/` без файлів), глобального `~/.claude/CLAUDE.md` немає. У `~/.claude/settings.json`: мова інтерфейсу (`"language": "english"`), модель і effort (`opus`, `effortLevel: high`), режим дозволів, налаштування інтерфейсу, вимкнений skill `find-skills` і hooks статус-бару iTerm2 (`~/.config/iterm2/cc-status`). У транскрипті hooks видно лише як `stop_hook_summary`, жоден з них не додає вмісту в контекст.
- Промпт (дослівно):

  > Тест у цій теці іноді падає — див. ai-runs/d-repeat-before.txt (вивід
  >    npm run test:repeat -- 30). Виправ.

Нижче — дослівно два тексти агента. (1) Його фінальна відповідь у сесії (повідомлення 2026-11-10T11:46:41Z). (2) Після другого `---` — текст файлу `ai-runs/d-flaky-first.md`, який агент створив сам у копії (`../ws12-d-flaky/ai-runs/d-flaky-first.md`, без змін).

---

I fixed the flaky test by correcting what it expects; the app's pricing code was right all along. After the fix, `npm test` passes 122/122 and `npm run test:repeat -- 30` had 0 failed runs out of 30.

**Cause:** the test in `app/test/integration/receipt.test.js` worked out its own expected price with `(Math.floor(minutes / 30) + 1) * price`. That charges one 30-minute block too many when a ride lasts exactly 30 or 60 minutes. The tariff rule says exactly 30 minutes is one block, and the spec test TC-18 confirms it: a 30-minute ebike ride costs 4000 kopecks. The test's rides were random, 5–89 minutes, so it only failed when a ride happened to land on 30 or 60 minutes.

**Fix (test file only, no changes to `src/`):**
- The expected price is now `Math.ceil(minutes / 30) * price`.
- The random rides are replaced with a fixed set: 5, 29, 30, 31, 59, 60, 61 and 89 minutes, on both bike types. The boundary cases are now checked on every run.

To confirm the new data catches the old bug, I ran it once against the old formula: it failed, as expected. I then removed that temporary copy.

The write-up is in `ai-runs/d-flaky-first.md`. I wrote it in English; tell me if it should be in Ukrainian like the other files in `ai-runs/`. Nothing is committed yet.

---

# Flaky test: `test/integration/receipt.test.js`

## Symptom

`npm run test:repeat -- 30` (`ai-runs/d-repeat-before.txt`): 10 of 30 runs were red, all on
"every receipt of a week of rides ends with the amount due". Each failure was a 30-minute ride:
the receipt said `40,00 грн`, but the test expected `80,00 грн` (ebike).

## Cause: the test's expected value is wrong, not `src/`

The test computed the expected price with its own formula:

```js
const expected = (Math.floor(minutes / 30) + 1) * PRICE[ride.bike];
```

Under T3, a started 30-minute block is charged in full, so a ride of exactly 30 min is **one**
block. The project's own spec test agrees: TC-18 in `test/spec/t03-blocks.test.js` is ebike
10:00–10:30 → 4000 kopecks. `floor(n/30) + 1` matches `ceil(n/30)` for every duration except
the multiples of 30, where it counts one block too many. `src/tariff.js` (`Math.ceil`) is correct.

The test was flaky, not always red, because its rides came from `randomRides(10)` in
`test/helpers/factory.js`, with durations drawn from 5–89 minutes. A run failed only when one of
the 10 rides came out at exactly 30 or 60 minutes. That happens in roughly 1 run in 4 to 1 in 3,
which matches the 10/30 seen.

## Fix (test only, `app/test/integration/receipt.test.js`)

1. Expected value is now `Math.ceil(minutes / 30) * PRICE[ride.bike]`, as T3 says.
2. The random rides are replaced by a fixed set: durations 5, 29, 30, 31, 59, 60, 61 and 89 min,
   for both classic and ebike, at daytime pickups and in-zone stations. The boundary cases the
   random data only hit sometimes are now tested on every run, and a failure is reproducible.

No change to `src/`. `test/helpers/factory.js` stays, because `randomRider()` is still used. The
rider's random id does not affect the price.

## Verification

- `npm test`: 122/122 green.
- `npm run test:repeat -- 30`: 0 of 30 runs red, all 122 tests green in every run.
- With the old formula, the fixed data fails on every run (at 30 and 60 min), so the test now
  reliably checks the boundary.
