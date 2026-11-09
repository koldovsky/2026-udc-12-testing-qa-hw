- Інструмент і модель: Claude Code, Claude Opus 4.6
- Дата: 2026-11-09
- Що бачила сесія: тимчасова тека ../ws12-c-rules з app/src/, package.json, AGENTS.md, CLAUDE.md (копія з main + правила)
- Що було ввімкнено з пам'яті й глобальних правил: нічого
- Промпт (дослівно):

  > У цій теці — код сервісу, який рахує вартість поїздок велопрокату громади (app/src/).
  > Читай лише файли в app/src/ і package.json у корені теки.
  > Напиши unit-тести для app/src/tariff.js і app/src/day-cap.js на вбудованому раннері Node
  > (node:test і node:assert/strict), без npm-залежностей. Поклади їх у теку
  > ai-runs/b1-from-code/ у файли *.test.js; модулі імпортуй шляхом ../../app/src/<файл>.js.
  > Запусти тести командою node --test "ai-runs/b1-from-code/*.test.js" і покажи результат.
  > Не змінюй app/src/. Уточнювальних питань не став; працюй з тим, що є.

---

## Результат

AI написав 34 тести у файлі `ai-runs/b1-from-code/tariff.test.js`. Усі 34 — зелені на коді з `main` (з початковими багами).

### Що відрізняє від прогону без правил (b1-from-code)

Правило 1 (очікувані зі специфікації) спрацювало частково: агент позначив коментарем `⚠ needs spec verification` 6 місць, де очікуване значення взято з коду, а не зі специфікації:

1. **T1: `Math.round` vs `Math.ceil`** — рядок 27: «code uses Math.round → 30; spec may require Math.ceil → 31»
2. **T2: рівно 2 хв** — рядок 52–53: «code uses `< 2` so 2 min is charged; spec says "не більше 2 хвилин" which may mean ≤ 2 → free»
3. **T4: ebike subscription** — рядок 102–103: «code gives ebike same 45 free min as classic; spec T4 may say ebike gets only 20% discount»
4. **T5: reduced + fee** — рядок 126–127: «code applies 50% to fees too; spec T5 says "Пільга не поширюється на збори" → fee should stay 15000»
5. **T6: dayKey timezone** — рядок 189: «code uses UTC (toISOString); spec T6 says "за київським часом"»
6. **T1: rounding** — рядок 38: «Math.round(12.67) = 13; Math.ceil would also be 13»

Правило 3 (точні значення) спрацювало: 32 з 34 тестів мають `assert.equal` на конкретне число.

Правило 4 (не дублюй логіку) спрацювало: жоден тест не використовує `Math.ceil(result.minutes / BLOCK_MINUTES) * RATES.ebike` — усі очікувані значення вирахувані вручну.

Правило 6 (один тест — одна поведінка) спрацювало: тести чітко розділені за правилами.

### Результат запуску

```
ℹ tests 34
ℹ pass 34
ℹ fail 0
```
