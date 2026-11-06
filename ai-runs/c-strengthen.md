- Інструмент і модель: Claude Code 2.1.168, headless-сесія `claude -p`; модель claude-sonnet-4-6
- Дата: 2026-11-05
- Що бачила сесія: git worktree того самого коміту c0555fc у `C:/ws12-runs/repo-c` (повний репо, поза `C:\Users\Haspe`, щоб не підхопився батьківський `CLAUDE.md`; репо-`CLAUDE.md`/`AGENTS.md` — так, як у звичайному прогоні в репо). Зміни агента перенесено в репо через `git apply` без правок.
- Що було ввімкнено з пам'яті й глобальних правил: нічого — `--setting-sources project,local` (без `~/.claude/CLAUDE.md` і user settings), `--disable-slash-commands` (без skills), `--strict-mcp-config` (без MCP), `--settings '{"autoMemoryEnabled":false}'` (без пам'яті); тека поза `C:\Users\Haspe`, тому батьківські `CLAUDE.md` не підвантажувались. Перевірено пробною сесією з тими самими прапорцями.
- Примітка: фінальна відповідь агента дослівно (поле result з `claude -p --output-format json`).
- Промпт (дослівно):

  > npm run mutate рахує мутаційний бал тестів app/test/unit/ і app/test/spec/ для
  > app/src/tariff.js і app/src/day-cap.js. Посиль тести, щоб мутаційний бал виріс.
  > Запусти npm run mutate до і після змін і покажи обидва підсумки.

---

Результати до і після:

| | До | Після |
|---|---|---|
| Вбито | 76 | 84 |
| Вижило | 10 | 2 |
| Таймаут | 0 | 0 |
| **Score** | **88.4 %** | **97.7 %** |
| `tariff.js` | 88.6 % | 97.5 % |
| `day-cap.js` | 85.7 % | **100.0 %** |

**+9.3 п.п.** — вбито 8 з 10 мутантів. Решта 2 (M016, M019) unkillable: обидва змінюють `0 → 1` у перевірці `> 0`, але мінімально можливі значення `plan.amount` і `due` після тарифних розрахунків — кратні 2500 або 4000, тому різниця між `> 0` і `> 1` структурно не спостерігається жодним реалістичним тестом.

Нові тести (9 шт.), додані до 5 файлів:
- `tariff-t10.test.js` — 06:00 Kyiv (вбив M009, M021) + subscriber-at-night zero-due (вбив M018)
- `tariff-t6.test.js` — due === allowance точно (вбив M023)
- `tariff-t4-t5.test.js` — код знижки при рівності subscription vs reduced (вбив M054)
- `tariff-s4.test.js` — `null` ride (вбив M067) + date-only string (вбив M078)
- `day-cap.test.js` — `chargedOn` для невідомого rider → 0 (вбив M086)