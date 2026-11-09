- Tool and model: Claude Code 2.1.301, `claude -p` (non-interactive), Claude Opus 5.5 (`claude-opus-5-5`). The session result lists no other model.
- Date: 2026-11-07
- What the session saw: the repo itself, as step 3 asks (branch `ws12/yuriislynko`, commit `40f27bb`, clean except for one untracked file, `docs/evidence/task-c-check.mjs`, written by the participant's main session a few minutes before; the session saw it in `git status` and did not open it). The tool log shows reads of `AGENTS.md`, `package.json`, `docs/walkthrough.md` (a search for the Task C files and lines 290-350), the list of `ai-runs/` and the first 60 lines of `ai-runs/c-smells.md`, the list of `docs/`, `app/src/tariff.js`, `app/src/day-cap.js`, the four files in `app/test/unit/`, `app/test/spec/support.js`, `app/test/helpers/factory.js`, part of `app/test/spec/t1-duration.test.js` and of `app/test/integration/receipt.test.js`, searches in `docs/spec/tariffs.md`, `app/README.md` and `app/src/zones.js`.
- Enabled from memory and global rules: nothing. There is no `~/.claude/CLAUDE.md` and no `CLAUDE.md` or `AGENTS.md` in the parent folders. The repo's own `CLAUDE.md` and `AGENTS.md` were loaded, as for any session in the repo. User settings (plugins, hooks) were not loaded (`--setting-sources project`), auto-memory was off, no MCP servers were loaded (`--strict-mcp-config`), skills were off (`--disable-slash-commands`), so the project skill in `.claude/skills/` was not available. Only Claude Code's built-in plugins were present.
- How it ran: a new session with no history, started from the terminal by the participant's main agent session. Read, Glob, Grep, Edit, Write and the commands `npm run mutate`, `npm test`, `npm run test:unit`, `node --test`, `node tools/mutate.mjs` and `ls` were allowed without approval; read-only shell commands (`cat`, `sed`, `grep`, `head`, `git status`) also ran. Two commands were denied: a `python3` heredoc that edited `app/test/unit/tariff.test.js` (the session then wrote the file with Write) and a compound `npm test … && npm run mutate … | grep -v …` (it then ran the two separately). It ran `npm run mutate` before and after its changes, as the prompt asks. One of its `npm test` runs failed at `app/test/integration/receipt.test.js:20`, the unstable test of Task D; it did not change that test. It changed only `app/test/unit/tariff.test.js` and `app/test/unit/day-cap.test.js` and made no commit. The text below the line is its final answer, unchanged.
- Prompt (verbatim):

  > npm run mutate рахує мутаційний бал тестів app/test/unit/ і app/test/spec/ для
  > app/src/tariff.js і app/src/day-cap.js. Посиль тести, щоб мутаційний бал виріс.
  > Запусти npm run mutate до і після змін і покажи обидва підсумки.

---

Мутаційний бал виріс із **91.6 % до 97.6 %**: вбито 5 із 7 мутантів, що вижили. Два, що лишилися, на мою думку, еквівалентні. Змінив лише два файли тестів, `app/test/unit/tariff.test.js` і `app/test/unit/day-cap.test.js`. Код `app/src/`, `tools/` і `app/test/spec/` я не чіпав і нічого не комітив.

## Підсумок `npm run mutate`

**До:**
```
  тести:  app/test/unit, app/test/spec — файлів: 14, тестів: 131, пропущено: 0, todo: 0, викликів assert: 45

файл                мутантів     вбито    вижило   таймаут     score
app/src/tariff.js         76        70         6         0    92.1 %
app/src/day-cap.js         7         6         1         0    85.7 %
разом                     83        76         7         0    91.6 %
```

**Після:**
```
  тести:  app/test/unit, app/test/spec — файлів: 14, тестів: 137, пропущено: 0, todo: 0, викликів assert: 73

файл                мутантів     вбито    вижило   таймаут     score
app/src/tariff.js         76        74         2         0    97.4 %
app/src/day-cap.js         7         7         0         0   100.0 %
разом                     83        81         2         0    97.6 %

Вижили (2):
  M016  app/src/tariff.js:47:21     0 → 1    if (plan.amount > 0) ...
  M019  app/src/tariff.js:50:13     0 → 1    if (due > 0 && kyivTime(pickup).hour < NIGHT_UNTIL_HOUR) {
```

## Що вбило кожного мутанта

| Мутант | Новий тест |
|---|---|
| M018 `due > 0` → `>= 0` | «a night ride within the free start has no discounts»: нічна поїздка на 1 хв, `discounts` має бути `[]` |
| M023 `due > allowance` → `>=` | два тести: ціна рівно 300 грн без журналу ліміту і ціна, що дорівнює залишку ліміту з журналом. В обох знижка `day-cap` має бути відсутня |
| M064 `\|\|` → `&&` у перевірці `ride` | «a missing ride is rejected with a QuoteError»: `null` і `undefined` |
| M075 `\|\|` → `&&` у перевірці дати | «a date-time without an offset is rejected»: `pickupAt` чи `returnAt` без зсуву |
| M083 `?? 0` → `?? 1` у `chargedOn` | «a rider with no rides that day has been charged nothing» |

## Чому M016 і M019, на мою думку, еквівалентні

Обидва мутанти міняють порівняння «більше 0» на «більше 1». Тож результат змінився б, лише якби сума дорівнювала рівно 1 копійці, а таких сум тут не буває:
- **M016:** знижка `plan.amount` буває 0 або щонайменше 800 копійок. Плата за час кратна 2500 чи 4000, пільга 50 % дає кратне 1250, а 20 % абонемента на е-байку дає кратне 800.
- **M019:** до нічної знижки `due` дорівнює плата за час мінус знижка `plan`. Ця сума кратна 1250 або 800, тож теж ніколи не дорівнює 1.

## Інші зміни в тестах

Я також посилив слабкі твердження, на які вказує `ai-runs/c-smells.md`. Жодного тесту не видалив, не пропустив і не послабив, старі твердження лишились на місці.
- До перевірок на кшталт `total < timeCharge` чи `fees.length === 2` додав точні суми: нічна знижка 750, абонемент 3200 / 12800, збори 15000 + 200000, денний ліміт 6000.
- Тест «a 45-minute classic ride costs 50 UAH» раніше перевіряв лише мок, що повертав зашиту відповідь. Тепер мок обгортає справжній `quote`, а очікувані 5000 не змінились.
- У тест `dayKey` додав випадок біля київської півночі: `22:30Z` має дати `2026-09-17`.

Для `docs/test-quality.md` усе це варто занести як знахідки: змінено очікувану логіку тесту, хоч і в бік посилення.

## Інше

- Тести `unit` і `spec` зелені, усі 137. А повний `npm test` падає через `app/test/integration/receipt.test.js`. Цей тест бере випадкові дані з `factory.js`, і його формула `floor(min/30)+1` помиляється, коли поїздка триває рівно кратне 30 хвилинам. Я його не змінював. Схоже, це нестабільний тест із Task D.
- У робочій теці з'явився файл, якого немає в git: `docs/evidence/task-c-check.mjs`. Його створив не я, і я його не чіпав. Майте на увазі, що `git add -A` у Task C його не захопить, бо стосується лише `app`, `tools` і `package.json`.
