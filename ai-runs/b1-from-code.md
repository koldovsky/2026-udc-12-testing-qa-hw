- Інструмент і модель: OpenAI Codex CLI v0.167.0, gpt-6.1-sol
- Дата: 2026-11-14
- Що бачила сесія: `/private/tmp/ws12-b1` — лише `app/src/` з `main` та кореневий `package.json` з `type: module`; `ai-runs/b1-from-code/` — тека для результату.
- Що було ввімкнено з пам'яті й глобальних правил: нічого; окрема сесія з `--ephemeral --ignore-user-config --ignore-rules`.
- Промпт (дослівно):

  > У цій теці — код сервісу, який рахує вартість поїздок велопрокату громади (app/src/).
  > Читай лише файли в app/src/ і package.json у корені теки.
  > Напиши unit-тести для app/src/tariff.js і app/src/day-cap.js на вбудованому раннері Node
  > (node:test і node:assert/strict), без npm-залежностей. Поклади їх у теку
  > ai-runs/b1-from-code/ у файли *.test.js; модулі імпортуй шляхом ../../app/src/<файл>.js.
  > Запусти тести командою node --test "ai-runs/b1-from-code/*.test.js" і покажи результат.
  > Не змінюй app/src/. Уточнювальних питань не став; працюй з тим, що є.

---

Додано 12 unit-тестів на `node:test` і `node:assert/strict`, без залежностей:

- [tariff.test.js](/private/tmp/ws12-b1/ai-runs/b1-from-code/tariff.test.js)
- [day-cap.test.js](/private/tmp/ws12-b1/ai-runs/b1-from-code/day-cap.test.js)

Перевірено межі тарифів, округлення, знижки, штрафи, денний ліміт, часові пояси й некоректні дані. `app/src/` не змінено.

Запущено:
```sh
node --test "ai-runs/b1-from-code/*.test.js"
```

Результат:
```text
tests 12
pass 12
fail 0
cancelled 0
skipped 0
todo 0
```