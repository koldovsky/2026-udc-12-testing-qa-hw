- Інструмент і модель: Claude Code, Claude Opus 4.6
- Дата: 2026-11-09
- Що бачила сесія: повне репо (поточний стан)
- Що було ввімкнено з пам'яті й глобальних правил: нічого
- Промпт (дослівно):

  > npm run mutate рахує мутаційний бал тестів app/test/unit/ і app/test/spec/ для
  > app/src/tariff.js і app/src/day-cap.js. Посиль тести, щоб мутаційний бал виріс.
  > Запусти npm run mutate до і після змін і покажи обидва підсумки.

---

## До

```
разом  84  71 вбито  13 вижило  0 таймаут  84.5 %
```

## Після

Додав тести в `app/test/spec/tariff.test.js`:

1. **§4: null ride → error** — вбиває M065 (`||` → `&&` в перевірці ride)
2. **§4: null rider → error** — вбиває M071 (`||` → `&&` в перевірці rider)
3. **§4: non-string pickupAt → error** — вбиває M076 (`||` → `&&` в перевірці instant)
4. **§4: returnAt equals pickupAt (0 min ride)** — вбиває M067 (`<` → `<=`)
5. **T2: false start has no discount entry** — вбиває M016 (discount amount `> 0` → `> 1`)
6. **T6: day-cap discount amount is exact** — вбиває M024 (`-` → `+`) і M023 (`>` → `>=`)
7. **T6: remaining returns exact value** — вбиває M079 і M081 (`0 → 1` у day-cap)
8. **T6: chargedOn returns 0 for unknown rider** — вбиває M084 (`0 → 1` у chargedOn)
9. **T1: exact minute boundary** — вбиває M030 (`60_000 → 60001`)

Код у `app/src/` і `tools/` не змінювався. Тести не видалялися, не пропускалися, не послаблювалися.
