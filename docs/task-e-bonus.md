# Task E (bonus): one path

Path 1 is done: an e2e run with an AI browser, then the same scenario as a deterministic test.
Paths 2 and 3 are not done.

## Path 1: e2e with an AI browser, then a deterministic test

- **Tool:** Playwright MCP `@playwright/mcp@0.0.83` in Google Chrome with an in-memory profile
  (`--browser chrome --isolated`), driven by Claude Code 2.1.301 (`claude -p`, Claude Opus 5.5) in
  an empty folder `../ws12-e1`. The session saw no code and no specification; the header of
  `ai-runs/e-browser.md` lists every tool call. Their inputs and results, unchanged, and the
  version, model and MCP server from the session's `init` record are in
  `docs/evidence/task-e/tool-calls.md`.
- **How the app ran:** `cd app && npm start` → `http://localhost:3000`, commit `c679050`.
- **Scenario in business language:**

  A student takes a classic bike on 16 September 2026 at 10:00 and returns it at 10:40 at the lake
  beach, outside the service zone. She checks the price and sees the receipt: her concession halves
  only the time charge, the out-of-zone fee stays in full, so she pays 175 UAH. Then she checks
  what she would have paid had she returned the bike at the City Park station: 25 UAH. Finally she
  enters a return time earlier than the pickup time by mistake: no price is calculated, and the page
  explains why.

  Expected values from `docs/spec/tariffs.md`: 40 min is 2 blocks × 25 грн = 50 грн (T3, line 66);
  the concession takes 50 % off the time charge and not off the fees (T5, lines 86-87): −25 грн;
  the out-of-zone fee is 150 грн (T7, line 112). Due: 175 грн at X01, 25 грн at S03 (in the zone,
  appendix A, line 168). A return before the pickup is rejected with an explanation (§4,
  lines 147-149).

- **Prompt to the AI browser (verbatim):**

  ```text
  Застосунок запущено на http://localhost:3000. Відкрий його в браузері і пройди сценарій:
  студентка 16 вересня 2026 року взяла класичний велосипед о 10:00 і повернула його о 10:40 на пляжі біля озера — це поза зоною обслуговування. Вона рахує вартість поїздки й бачить чек: пільга вдвічі зменшує лише плату за час, а збір за повернення поза зоною — повний, тож до сплати 175 грн. Потім вона перевіряє, скільки заплатила б, якби повернула велосипед на станцію «Міський парк»: до сплати 25 грн. Нарешті вона помилково вказує час повернення раніший за час взяття — розрахунок не виконується, і сторінка пояснює чому.
  Після кожного кроку опиши, що зробив і що побачив на сторінці. Наприкінці скажи, чи
  сценарій пройдено, і на чому ґрунтується цей висновок.
  ```

- **What the AI browser did, step by step.** Its final answer is verbatim in
  `ai-runs/e-browser.md`; it is identical to the `result` field of the session output. The
  evidence is in `docs/evidence/task-e/`. `tool-calls.md` holds the 16 tool calls with their
  results (call numbers below). The MCP server wrote a page snapshot `page-<time>.yml` after each
  successful `browser_navigate`, `browser_click` and `browser_select_option` (calls 2, 5, 7, 8
  and 14; the failed click, call 11, wrote none), and the browser console log
  (`console-<time>.log.txt`); both are copied unchanged. The explicit `browser_snapshot` calls
  answered inline: calls 3, 6, 12 and 15 are identical to a saved file, call 9 (the result region
  only) is in `tool-calls.md`. Every amount, receipt line, error text and verdict in the final
  answer matches these snapshots. The wording does not: the answer retells the receipt in its own
  labels and with a different minus character (see "What the AI browser did that the test must
  not do").

| # | AI action | What it saw | Matches the scenario? |
|---|---|---|---|
| 1 | Opened `http://localhost:3000`, took a snapshot (calls 2-3) | The form with its defaults: pickup `2026-09-16T09:00`, return `2026-09-16T09:40` (`page-2026-11-08T12-26-16-503Z.yml`, written by the navigation; call 3 is identical) | Yes, the start state |
| 2 | One form fill: `Класичний`, `Пільговий (студент, пенсіонер)`, pickup `2026-09-16T10:00`, return `2026-09-16T10:40`, `X01 — Озеро (пляж), поза зоною`; clicked `Розрахувати`; took a snapshot (calls 4-6) | Receipt (dot leaders left out): `40 хв`, `50,00 грн`, `Знижка: пільговий тариф -25,00 грн`, `Збір: повернення поза зоною 150,00 грн`, `До сплати 175,00 грн` (`page-2026-11-08T12-26-23-124Z.yml`, written by the click; call 6 is identical) | Yes. "Student" → the concession category and "lake beach" → `X01` are its own mapping from the option labels |
| 3 | Chose `S03 — Міський парк`, clicked, took a snapshot of the result region only (calls 7-9) | After the choice, before the click: `S03` selected and the X01 receipt still on the page, `До сплати 175,00 грн` (`page-2026-11-08T12-26-26-224Z.yml`). After the click: `40 хв`, `50,00 грн`, `-25,00 грн`, no fee line, `До сплати 25,00 грн` (`page-2026-11-08T12-26-27-629Z.yml`; the region snapshot, call 9, shows the same receipt) | Yes. It read the receipt only after the click |
| 4 | Set the return to `2026-09-16T09:40`, clicked (calls 10-11) | Both calls failed: `Error: Ref e17 not found in the current page snapshot. Try capturing new snapshot.` (and `Ref e20`) | Not a scenario step: the current snapshot was call 9, the result region, which has no form field and no button |
| 5 | Took a new full snapshot, repeated the same fill and click, took a snapshot (calls 12-15); read the console log (call 16) | `Помилка: returnAt is before pickupAt`, no receipt (`page-2026-11-08T12-26-34-864Z.yml`, written by the click; call 15 is identical); `400 (Bad Request)` on `/api/quote` in the console log | Partly: no price is calculated (§4). It judged the explanation unfit because it is in English with the code's field names |
| 6 | Verdict | "Сценарій пройдено не повністю": steps 1 and 2 passed, step 3 only "формально" (the AI's own numbering: its steps 1, 2 and 3 are rows 2, 3 and 5) | The verdict depends on a requirement the spec does not state (see "What the AI browser did that the test must not do") |

- **The same scenario as a deterministic test:** `app/test/e2e/student-out-of-zone.test.js`,
  `node:test` and `fetch`. The test starts `createServer(createHandler())` on a free port
  (`listen(0, "127.0.0.1")`) in `before` and closes it in `after`. It uses fixed instants, no
  clock and no daily cap ledger. Four tests:

  | Test | What it checks |
  |---|---|
  | `Spec §2, appendix A: the page offers every choice the scenario sends, under the spec's name` | `GET /` is a success (2xx). `classic` is an option of the `bike` select with a label that names "класичний" (line 38), `reduced` of `riderType` with "пільговий" (line 39; students have the reduced fare, lines 33 and 86), `X01` of `returnStation` with "Озеро (пляж)" (appendix A, line 174) and `S03` with "Міський парк" (line 168). `pickupAt` and `returnAt` are `datetime-local` inputs; the page refers to `/api/quote`. The requests below replace the browser, so they use only values the form can send, each in the field that sends it, behind the label a rider would pick. Only the spec's name in the label is checked, in any letter case; the rest of the label (the station code, the zone note), the order of the HTML attributes and the quote style of the page script are not |
  | `T5, T7: student, classic, 40 min, return X01 (lake beach): 175,00 грн due` | A success (2xx); `minutes` 40, `timeCharge` 5000, discounts `[2500]`, fees `[15000]`, `total` 17500; receipt lines ending in `40 хв`, `50,00 грн`, `-25,00 грн`, `150,00 грн`, and exactly one `До сплати … 175,00 грн` line, found by its label (T9, lines 132-135). The discount line may use either minus character, U+2212 or the ASCII hyphen: Q-5 in `docs/test-cases.md` leaves it open. The order of the lines and the dot leaders are not checked: T9 defines neither (`docs/test-cases.md:269`; `app/AGENTS.md`, rule 7) |
  | `T5, T7: the same ride returned at S03 (city park): 25,00 грн due, no fee` | A success (2xx); `timeCharge` 5000, discounts `[2500]`, fees `[]`, `total` 2500 (the spec example on line 93), exactly one `До сплати … 25,00 грн` line |
  | `Spec §4: return at 09:40, before the 10:00 pickup: rejected with an explanation, no receipt` | A client error (4xx), `error` is a non-empty text, no `quote` and no `receipt`. The wording is not checked: the spec gives none (`app/AGENTS.md`, rule 7; Q-13 below) |

  The spec names no HTTP status, and `docs/test-cases.md:268` lists the exact codes as a code
  detail the AI invented, so the tests check only the class of the status, by HTTP semantics: a
  calculated price is a success (2xx), a request rejected for invalid data is a client error
  (4xx). The exact code the API sends today (400, `app/src/server.js:38`) is not asserted.

  Every expected value taken from the spec has its spec line next to it in a comment. The status
  classes come from HTTP, not from the spec; the option values in the first test come from the
  page, the names their labels must carry from the spec.

  The request bodies are the ones the page builds for that form input. Evidence: the page's own
  conversion of the form time, run on the three values the AI browser entered.

  ```bash
  node --input-type=module -e '
  import { readFileSync } from "node:fs";
  const html = readFileSync("app/public/index.html", "utf8");
  const src = html.slice(html.indexOf("const KYIV"), html.indexOf("const form"));
  const kyivToIso = new Function(src + "; return kyivToIso;")();
  for (const v of ["2026-09-16T10:00", "2026-09-16T10:40", "2026-09-16T09:40"]) console.log(v, "->", kyivToIso(v));'
  ```

  ```text
  2026-09-16T10:00 -> 2026-09-16T10:00:00+03:00
  2026-09-16T10:40 -> 2026-09-16T10:40:00+03:00
  2026-09-16T09:40 -> 2026-09-16T09:40:00+03:00
  ```

- **`npm test` output with this test** (the e2e lines and the totals):

  ```text
  ✔ Spec §2, appendix A: the page offers every choice the scenario sends, under the spec's name (33.00975ms)
  ✔ T5, T7: student, classic, 40 min, return X01 (lake beach): 175,00 грн due (9.925958ms)
  ✔ T5, T7: the same ride returned at S03 (city park): 25,00 грн due, no fee (4.89775ms)
  ✔ Spec §4: return at 09:40, before the 10:00 pickup: rejected with an explanation, no receipt (4.457875ms)
  ℹ tests 160
  ℹ pass 160
  ℹ fail 0
  ```

- **The test catches defects.** Every run below is on a copy of `app/` in a temporary folder, the
  repo unchanged:
  - `OUT_OF_ZONE_FEE = 10000` (the version 2 fee, spec line 155): the X01 test fails with
    `actual: [ 10000 ]`, `expected: [ 15000 ]`; the other three pass.
  - The code of `main` (`git archive main app`), before the Task B fixes: the X01 test fails with
    `actual: [ 7500 ]`, `expected: [ 15000 ]`. This is BUG-4, the reduced fare halving the fees
    (`docs/bugs/BUG-4.md`, fixed in `3234a10`).
  - `formatUah` printing no minus sign: the X01 test fails (`no receipt line ends with "-25,00 грн"`).
  - `QuoteError("")` for a return before the pickup: the §4 test fails (`the explanation is empty`).
  - The `riderType` select renamed: the first test fails (`the form has no select "riderType"`).
  - The labels of the `reduced` and `subscriber` options swapped: the first test fails
    (`the riderType option "reduced" is labelled "Абонент", not "пільговий"`).
  - The labels of the `X01` and `S03` options swapped: the first test fails
    (`the returnStation option "X01" is labelled "S03 — Міський парк", not "Озеро (пляж)"`).
  - A rejected quote answered with 500 instead of 400: the §4 test fails
    (`the request is not rejected as a client error: status 500`).
- **The test fails only on what the spec defines.** The same copies, with changes the spec allows,
  all four pass: `formatUah` printing U+2212 as the minus (Q-5, reading 1); `До сплати` printed
  as the first receipt line; the page script calling `fetch('/api/quote'` with single quotes; a
  rejected quote answered with 422 instead of 400.
- **The test is stable:** `node tools/repeat.mjs 50` → `Червоних прогонів: 0 з 50`, 160 tests in
  18 files (`docs/triage.md`, section 1). The AI run took 53 s, 17 turns and USD 0.41 (`duration_ms` 53350, `num_turns` 17,
  `total_cost_usd` 0.4058407 in the session's `result` record, `docs/evidence/task-e/tool-calls.md`);
  the four tests take under 0.1 s.

- **What the AI browser did that the test must not do:**

  | Behaviour | In this run | What the test does instead |
  |---|---|---|
  | Guessed what to click or enter | Yes. It mapped "студентка" to `Пільговий (студент, пенсіонер)` and "пляж біля озера" to `X01 — Озеро (пляж), поза зоною` from the option labels. It entered the times as `2026-09-16T10:00`, copying the format of the default values in its first snapshot. All guesses were right in this run; nothing in the run would have stopped a wrong one. | Sends fixed values (`reduced`, `X01`, `+03:00` instants) and checks that the form offers each of them in the field that sends it, behind a label with the spec's name for it (§2, appendix A). The mapping from the scenario's words to a value is the spec's, not a guess. |
  | "Self-healed" a selector | Yes, in a mild form. After `Ref e17 not found in the current page snapshot. Try capturing new snapshot.` it took a new snapshot, as the error asked, and repeated the two calls once; they worked (calls 10-14). The new references pointed to the same fields, so no other element was picked. The Playwright code the MCP server generated for these calls builds locators from the text inside a label, option texts included: `page.getByLabel('Велосипед Класичний Електровелосипед')` (call 4), `page.getByLabel('Станція повернення S01')` (calls 4 and 7). Replayed as a test, these break when the option list changes. | Has no selectors to repair. A missing option, or one whose label lacks the spec's name, is a failure of the first test. |
  | Read page text as an instruction | Not observed. The page has one informational line ("Час — за київським часом…") and no text addressed to an agent. | Reads only the JSON answer and the names, values and option labels of the HTML form fields. |
  | Declared success without checking the result | Not observed: each verdict rests on the receipt text in a snapshot taken after the click. That matters on this page: after a change of station it keeps the previous receipt on screen until the next click (`page-2026-11-08T12-26-26-224Z.yml`: `S03` selected, `До сплати 175,00 грн`), so a reading before the click would have given the X01 price for S03. It went the other way on step 3: it declared a partial failure on a requirement it added itself ("Очікував щось на зразок «Час повернення не може бути раніше за час взяття»"). The spec only requires an explanation (lines 147-149). | Checks only what the spec defines: a rejection, an explanation present, no price. Each request gets its own answer, so nothing is left over from a previous step. The wording is an open question, Q-13 below. |
  | Reported page text it did not see (not one of the four above) | Yes. Its receipt is a retelling, not a copy. `ai-runs/e-browser.md:22` has `Знижка «пільговий тариф»: −25,00 грн` with U+2212, and line 28 `знижка −25,00 грн`. The page showed `Знижка: пільговий тариф ........... -25,00 грн` with the ASCII hyphen (`page-2026-11-08T12-26-23-124Z.yml:43`, bytes `2d` against `e2 88 92` in the answer). The amounts are right. The minus character is exactly what Q-5 leaves open, so this report cannot tell which one the page prints. | Reads the receipt lines from the JSON answer as the API sends them, and accepts either minus character until Q-5 is answered. |

- **Open question from this run.** It was not among Q-1 to Q-12 and is now Q-13 in
  `docs/test-cases.md` ("Questions for the specification"):

  | # | Rule | What is unclear | Possible readings | Who to ask |
  |---|---|---|---|---|
  | Q-13 | §4 | Lines 147-149 require a rejection "з поясненням". The page shows the API text `Помилка: returnAt is before pickupAt` (`app/src/tariff.js:117`): English, with the code's field names, on a Ukrainian page. The spec does not say in which language or for whom the explanation is written. | (1) Any explanation is enough; the current page passes. (2) The explanation is for the rider: Ukrainian, in the words of the form. | Product owner |

- **Limits.** The test does not run the page's JavaScript: the Kyiv time conversion, the
  concession checkbox, the request body the script builds and how the receipt is drawn. The
  conversion was checked once with the command above. The option labels are checked only for the
  spec's name, not for the rest of their text. A browser test would need Playwright as a
  dependency, and the repo has none.

---

Reviewed and approved by Yurii Slynko, 2026-11-08.
