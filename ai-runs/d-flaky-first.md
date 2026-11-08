- Інструмент і модель: Claude Code 2.1.319 (headless `claude -p`), claude-opus-5-5
- Дата: 2026-11-07
- Що бачила сесія: тимчасова тека `../ws12-d-flaky` поруч із репо — `git archive HEAD app tools package.json .gitattributes` (коміт b8c42be) без `app/AGENTS.md` і `app/CLAUDE.md`, плюс `ai-runs/d-repeat-before.txt`; власний git з комітом `base`; сесію запущено з цієї теки з `--restricted`; інструменти Read, Write, Edit, Glob, Grep, Bash; з Bash дозволено лише `node`, `npm test`, `npm run test:repeat`, `npm run test:unit`, `npm run test:tools`, `npm --prefix app test`, `npm --prefix app run`, `git diff`, `git status`, `git log` (інші команди відхиляються автоматично; read-only команди Claude Code пропускає як безпечні); режим `acceptEdits`
- Що було ввімкнено з пам'яті й глобальних правил: нічого з користувацьких/проєктних налаштувань — `--safe-mode` і `--restricted` (CLAUDE.md/AGENTS.md, користувацькі skills, plugins, hooks, output styles, MCP вимкнено) і `--strict-mcp-config` (у init `mcp_servers` порожній); у копії немає AGENTS.md, CLAUDE.md, `*.mdc`, `copilot-instructions.md`; глобальний `~/.claude/CLAUDE.md` порожній (0 байт); у батьківських теках над `../ws12-d-flaky` немає CLAUDE.md/AGENTS.md; пам'ять: авто-пам'ять для нової теки порожня (теки пам'яті до прогону не було, у init-події `memory_paths` немає). Лишилися лише вбудовані в Claude Code plugins (4, `@builtin`) і bundled skills (17) — жоден не викликано
- Дії агента (з журналу stream-json): Bash `git ls-files | grep -v node_modules | head -50 && cat package.json && cat ai-runs/d-repeat-before.txt | head -80`, Bash `cd …/ws12-d-flaky/app && cat test/integration/receipt.test.js test/helpers/factory.js src/receipt.js src/tariff.js src/day-cap.js src/kyiv-time.js; cat package.json`, Bash `cat test/spec/t03-blocks.test.js; cat README.md | head -60; grep -rn "random" test | grep -v helpers/factory`, Edit app/test/integration/receipt.test.js, Bash `npm test 2>&1 | tail -12 && npm run test:repeat -- 30 2>&1 | tail -8`; відхилених викликів немає (`permission_denials` порожній, помилок у результатах інструментів немає); змінено один файл — `app/test/integration/receipt.test.js` (+20 −3), код у `app/src/` не змінено; агент нічого не комітив; `npm run mutate` не запускався
- Метрики прогону: 69.211 с (API 36.722 с), ходів 6, токени: вхід 12 + кеш-запис 12729 + кеш-читання 67736, вихід 2877; вартість $0.1730
- Промпт (дослівно):

  > Тест у цій теці іноді падає — див. ai-runs/d-repeat-before.txt (вивід
  > npm run test:repeat -- 30). Виправ.

---

Виправив. Помилка була в самому тесті, код рахує правильно. Після правки `npm run test:repeat -- 30` дає 0 червоних прогонів із 30, а `npm test` проходить: 106 з 106.

**Причина.** Тест `every receipt of a week of rides ends with the amount due` у `app/test/integration/receipt.test.js` рахував очікувану суму за формулою `(Math.floor(minutes / 30) + 1) * ціна`. Для будь-якої тривалості, кратної 30 хв, вона дає на один блок більше. Специфікація каже інакше: TC-13 — 60 хв це 2 блоки, TC-15 — 30 хв це 1 блок. `src/tariff.js` рахує саме так, через `Math.ceil`. Тест падав не завжди, бо тривалість поїздок бралася випадково з діапазону 5–89 хв. Падіння траплялося, лише коли серед 10 поїздок випадало рівно 30 або 60 хв. Це видно у виводі `d-repeat-before.txt`: усі три зафіксовані падіння припадають на 30 або 60 хв.

**Що змінив** (тільки цей тест, код не чіпав):
- формула тепер `Math.ceil(minutes / 30) * ціна`, як у правилі T3;
- випадкові поїздки замінив фіксованим набором із 12 денних поїздок у зоні. Туди навмисно входять межі блоків: 29/30/31, 59/60/61, 89/90 хв. Тепер ці межі перевіряються в кожному прогоні, а не випадково.

Нічого не комітив. Якщо треба, закомічу.