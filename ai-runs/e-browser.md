- Tool and model: Claude Code 2.1.301, `claude -p` (non-interactive), Claude Opus 5.5 (`claude-opus-5-5`). The session result also lists `claude-haiku-5-5` usage. Browser: Playwright MCP `@playwright/mcp@0.0.83` (`npx -y @playwright/mcp@0.0.83 --browser chrome --isolated`), Google Chrome with an in-memory profile.
- Date: 2026-11-08
- What the session saw: an empty temporary folder `../ws12-e1` (one empty `ai-runs/` folder) and, through the browser, the app at `http://localhost:3000`, started from the repo with `cd app && npm start` at commit `c679050`. No code, no specification, no `docs/`, no `CLAUDE.md` or `AGENTS.md`, no `.claude/`; the MCP config file was outside the folder. The tool log shows: `ToolSearch` loading six Playwright tools; `browser_navigate` to `http://localhost:3000`; `browser_snapshot`; one `browser_fill_form` (bike `Класичний`, category `Пільговий (студент, пенсіонер)`, pickup `2026-09-16T10:00`, return `2026-09-16T10:40`, station `X01 — Озеро (пляж), поза зоною`); `browser_click` on `Розрахувати`; `browser_snapshot`; `browser_select_option` `S03 — Міський парк`; `browser_click`; `browser_snapshot` of the result region only; then `browser_fill_form` (return `2026-09-16T09:40`) and `browser_click`, which failed with `Error: Ref e17 not found in the current page snapshot. Try capturing new snapshot.` and `Error: Ref e20 not found in the current page snapshot. Try capturing new snapshot.`; a new `browser_snapshot`; the same `browser_fill_form` and `browser_click`, now successful; `browser_snapshot`; a `Read` of the browser console log that the MCP server wrote into `.playwright-mcp/` in the folder. 17 turns. The five page snapshots and the console log are copied unchanged to `docs/evidence/task-e/` (the log with `.txt` added to its name, because git ignores `*.log`).
- Enabled from memory and global rules: nothing. There is no `~/.claude/CLAUDE.md` and no `CLAUDE.md` or `AGENTS.md` in the parent folders. User settings (plugins, hooks) were not loaded (`--setting-sources project`), auto-memory was off, skills were off (`--disable-slash-commands`). The only MCP server was the Playwright server from `--mcp-config` (`--strict-mcp-config`). Only Claude Code's built-in plugins were present.
- How it ran: a new session with no history, started from the terminal by the participant's main agent session, in `../ws12-e1`. Only the Playwright tools were allowed without approval (`--allowedTools mcp__playwright`); reads inside the folder were allowed by default. No command was denied. It wrote no file of its own. The text below the line is its final message, unchanged.
- Prompt (verbatim, the Task E path 1 prompt with the participant's scenario):

  > Застосунок запущено на http://localhost:3000. Відкрий його в браузері і пройди сценарій:
  > студентка 16 вересня 2026 року взяла класичний велосипед о 10:00 і повернула його о 10:40 на пляжі біля озера — це поза зоною обслуговування. Вона рахує вартість поїздки й бачить чек: пільга вдвічі зменшує лише плату за час, а збір за повернення поза зоною — повний, тож до сплати 175 грн. Потім вона перевіряє, скільки заплатила б, якби повернула велосипед на станцію «Міський парк»: до сплати 25 грн. Нарешті вона помилково вказує час повернення раніший за час взяття — розрахунок не виконується, і сторінка пояснює чому.
  > Після кожного кроку опиши, що зробив і що побачив на сторінці. Наприкінці скажи, чи
  > сценарій пройдено, і на чому ґрунтується цей висновок.

---

Сценарій пройдено не повністю. Перші два кроки дали точно очікувані суми. На третьому розрахунок справді не виконався, але пояснення технічне і англійською, тож для студентки воно не підходить.

**Крок 0. Відкрив сторінку.** На http://localhost:3000 відкрилася форма «Вартість поїздки» з полями: велосипед, категорія користувача, взяття, повернення, станція повернення. Є кнопка «Розрахувати». У консолі одна помилка: немає `favicon.ico` (404). На роботу сторінки це не впливає.

**Крок 1. Повернення на пляжі біля озера.** Вибрав велосипед «Класичний» і категорію «Пільговий (студент, пенсіонер)». Указав взяття 16.09.2026 10:00, повернення 16.09.2026 10:40, станцію «X01 — Озеро (пляж), поза зоною». Натиснув «Розрахувати». З'явився чек:
- Тривалість поїздки: 40 хв
- Погодинне нарахування: 50,00 грн
- Знижка «пільговий тариф»: −25,00 грн
- Збір «повернення поза зоною»: 150,00 грн
- **До сплати: 175,00 грн**

Знижка зменшила вдвічі тільки плату за час (50 → 25), а збір поза зоною лишився повним (150). Усе як очікувалося.

**Крок 2. Повернення на станцію «Міський парк».** Змінив станцію на «S03 — Міський парк», решту залишив як було, натиснув «Розрахувати». У чеку: 40 хв, 50,00 грн, знижка −25,00 грн, рядка про збір немає, **до сплати 25,00 грн**. Усе як очікувалося.

**Крок 3. Повернення раніше за взяття.** Змінив час повернення на 09:40 (взяття о 10:00) і натиснув «Розрахувати». Чек зник, сервер відповів на запит `/api/quote` помилкою 400. На сторінці з'явився лише текст **«Помилка: returnAt is before pickupAt»**.
- Розрахунок не виконався, це правильно.
- Пояснення є, але це внутрішнє повідомлення англійською з назвами полів із коду (`returnAt`, `pickupAt`). Користувачка україномовного інтерфейсу навряд чи зрозуміє з нього, що час повернення раніший за час взяття. Очікував щось на зразок «Час повернення не може бути раніше за час взяття».

**Висновок: сценарій пройдено частково.** Він ґрунтується на тому, що я сам бачив на сторінці:
- Кроки 1 і 2 пройдено: суми в чеках (175 і 25 грн) і склад рядків точно збігаються з описом. Зокрема видно, що знижка діє лише на плату за час, а збір поза зоною не зменшується.
- Крок 3 формально виконано: розрахунок заблоковано, причина названа. Але вимогу «сторінка пояснює чому» для студентки не виконано: текст технічний і англійською. Щоб пройти цей крок, треба перекласти повідомлення про помилку зрозумілою українською.

Код застосунку я не дивився. Усі висновки зроблено лише з того, що показувала сторінка, і з журналу консолі браузера.
