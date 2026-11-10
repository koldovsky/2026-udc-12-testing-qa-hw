- Інструмент і модель: Claude Code 2.1.322, Claude Opus 5.5 (`claude-opus-5-5`, effort high); неінтерактивний режим `claude -p` (у Task B — інтерактивна сесія), той самий режим дозволів `bypassPermissions` з `~/.claude/settings.json`
- Дата: 2026-11-10
- Що бачила сесія: нова сесія в тимчасовій теці `../ws12-c-rules/` — лише `app/src/` з `main` (`git archive main app/src`), `package.json` з одним рядком `{ "type": "module" }` і файл правил: `CLAUDE.md` та `AGENTS.md` — побайтові копії `app/AGENTS.md` (`cmp` — без відмінностей). Без `docs/` (специфікації немає навмисно), без `app/test/` і без `ai-runs/`. За транскриптом агент виконував лише `ls`, `cat` файлів `app/src/` і `package.json`, `node --version`, писав файли в `ai-runs/b1-from-code/` і запускав `node --test`; поза `app/src/` і `package.json` нічого не читав. Тести агент поклав туди, куди просили (`../ws12-c-rules/ai-runs/b1-from-code/`); у репо вони скопійовані без змін у `ai-runs/c-with-rules/` (`diff -r` — без відмінностей). `app/src/` агент не змінював
- Що було ввімкнено з пам'яті й глобальних правил: пам'ять проєкту порожня, глобального `CLAUDE.md` немає; у `~/.claude/settings.json` — мова інтерфейсу (`"language": "english"`), модель і effort (`opus`, `effortLevel: high`), режим дозволів, налаштування інтерфейсу та hooks статус-бару iTerm2; жодне з них не додає вмісту в контекст. Правила тестування — лише з `CLAUDE.md` теки прогону
- Відповідь узято дослівно з поля `result` JSON-виводу `claude -p --output-format json` (сесія `142aef4c-3f21-4ebf-9743-9de515ca3d84`, транскрипт `~/.claude/projects/-Users-vlad-Projects-rbi-ai-training-hw-ws12-c-rules/142aef4c-3f21-4ebf-9743-9de515ca3d84.jsonl`, 2026-11-10T11:10:04Z — 11:14:03Z) — це фінальна відповідь агента
- Промпт (дослівно):

  > У цій теці — код сервісу, який рахує вартість поїздок велопрокату громади (app/src/).
  > Читай лише файли в app/src/ і package.json у корені теки.
  > Напиши unit-тести для app/src/tariff.js і app/src/day-cap.js на вбудованому раннері Node
  > (node:test і node:assert/strict), без npm-залежностей. Поклади їх у теку
  > ai-runs/b1-from-code/ у файли *.test.js; модулі імпортуй шляхом ../../app/src/<файл>.js.
  > Запусти тести командою node --test "ai-runs/b1-from-code/*.test.js" і покажи результат.
  > Не змінюй app/src/. Уточнювальних питань не став; працюй з тим, що є.

---

I wrote 64 tests in two files and ran them: **52 pass and 12 fail.** I left the 12 failures red on purpose. In each one the code disagrees with a rule stated in the project's `CLAUDE.md`, and that file says not to change the expected values to match the code. `app/src/` is unchanged.

```
node --test "ai-runs/b1-from-code/*.test.js"
# tests 64
# pass 52
# fail 12
# skipped 0
# todo 0
```

- `ai-runs/b1-from-code/tariff.test.js` has 50 tests: minute rounding, the 2-minute free start, 30-minute blocks, the subscription's 45 free minutes, the reduced fare, which plan a subscriber with a concession gets, rounding of discounts, the night discount, fees, the daily cap, and refusals with `QuoteError`.
- `ai-runs/b1-from-code/day-cap.test.js` has 14 tests: the ledger, the limit per rider and per day, Kyiv vs UTC day, `dayKey` and `chargedOn`.

**Where the expected values come from.** `CLAUDE.md` says expected values must come from `docs/spec/tariffs.md`. That file isn't in this folder, and you limited me to `app/src` and `package.json`. So the boundaries and the 300 грн daily cap come from the rules listed in `CLAUDE.md`. The rest (25 and 40 грн per 30-minute block, 50 % reduced fare, 30 % night discount, 150 грн out-of-zone fee, 2000 грн unreturned fee) come from comments and names in the code, and are marked "з коду" in the test comments. Every expected value is written as a number, with the arithmetic in a comment. The test comments don't give spec line numbers, because I couldn't check them.

## The three defects behind the 12 failures

| # | Rule | Expected | Actual | Failing tests |
|---|---|---|---|---|
| 1 | **T1:** part of a minute counts as a whole minute (round up) | 10:01 → 11 min; 2:00 → free (T2); 30:01 → 5000 (T3); 45:01 subscriber → 2500 (T4); 24 h 1 s → `unreturned` fee 200000 (T8) | `Math.round` at `app/src/tariff.js:71`: 10 min; 2500; 2500; 0; no fee | 5 in `tariff.test.js` |
| 2 | **T6:** the daily cap counts days by Kyiv time | 00:30 Kyiv on 17.09 starts a new day; 01:00 and 12:00 Kyiv on 17.09 share one limit; `dayKey('2026-09-17T00:30+03:00')` → `2026-09-17` | `dayKey` takes the UTC date (`app/src/day-cap.js:7`) | 5 in `day-cap.test.js`, 2 in `tariff.test.js` |

The T1 bug also makes 2:00 cost money: with `Math.round` and the `minutes < 2` check, 2:00 counts as 2 minutes and is charged 2500 instead of being free.

To reproduce, run `node --test "ai-runs/b1-from-code/*.test.js"`. The output shows each failure as expected vs actual.

## Open questions (no tests written for these)

1. **Subscriber on an e-bike.** The example in `CLAUDE.md` is "T4: абонент · Ел · 30 хв → 3200 коп.", which is 4000 minus 20 %. The code gives 0, because it applies the 45 free minutes to e-bikes too. Do subscribers get the 45 free minutes on e-bikes, or only 20 % off?
2. **Daily cap for a ride that spans two days.** Is the cap for a 24-hour ride counted once, on the pickup day, or split across both days?
3. **Night discount.** Does pickup time alone decide it (the code's behaviour), or does a ride that runs into the night after 00:00 also qualify?
4. **Reduced fare and fees.** Should the 50 % discount also apply to fees? The code halves them; the reduced-fare out-of-zone test expects that, but the expectation comes only from the code.

Because I couldn't open the spec, tests built only on code values would pass even if the code's numbers are wrong. To check them, compare against `docs/spec/tariffs.md` and add line references.
