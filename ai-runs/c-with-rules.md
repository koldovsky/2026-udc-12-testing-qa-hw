- Інструмент і модель: OpenAI Codex CLI v0.167.0, gpt-6.1-sol
- Дата: 2026-11-14
- Що бачила сесія: `/private/tmp/ws12-c-rules` — лише `app/src/` з `main`, кореневий `package.json` з `type: module`, а також `AGENTS.md` і `CLAUDE.md` з поточного `app/AGENTS.md`; специфікації в копії немає.
- Що було ввімкнено з пам'яті й глобальних правил: глобальну конфігурацію вимкнено через `--ignore-user-config`; окрема сесія `--ephemeral`; правила в корені тимчасової теки були ввімкнені.
- Промпт (дослівно, той самий, що в Task B1):

  > У цій теці — код сервісу, який рахує вартість поїздок велопрокату громади (app/src/).
  > Читай лише файли в app/src/ і package.json у корені теки.
  > Напиши unit-тести для app/src/tariff.js і app/src/day-cap.js на вбудованому раннері Node
  > (node:test і node:assert/strict), без npm-залежностей. Поклади їх у теку
  > ai-runs/b1-from-code/ у файли *.test.js; модулі імпортуй шляхом ../../app/src/<файл>.js.
  > Запусти тести командою node --test "ai-runs/b1-from-code/*.test.js" і покажи результат.
  > Не змінюй app/src/. Уточнювальних питань не став; працюй з тим, що є.

---

Створено характеристичні тести без npm-залежностей:

- [tariff.test.js](/private/tmp/ws12-c-rules/ai-runs/b1-from-code/tariff.test.js)
- [day-cap.test.js](/private/tmp/ws12-c-rules/ai-runs/b1-from-code/day-cap.test.js)

Перевіряють межі тривалості, округлення, знижки, збори, денний журнал і валідацію. `app/src/` не змінено.

Виконано:
```sh
node --test "ai-runs/b1-from-code/*.test.js"
```

Результат: **49 тестів успішні, 0 помилок, 0 пропущених**. Це фіксація поведінки коду, а не підтвердження правильності тарифів за специфікацією.