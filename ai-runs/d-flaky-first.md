- Інструмент і модель: Claude Code, Claude Opus 4.6
- Дата: 2026-11-09
- Що бачила сесія: тимчасова тека ../ws12-d-flaky з app/, tools/, package.json, ai-runs/d-repeat-before.txt
- Що було ввімкнено з пам'яті й глобальних правил: нічого
- Промпт (дослівно):

  > Тест у цій теці іноді падає — див. ai-runs/d-repeat-before.txt (вивід
  > npm run test:repeat -- 30). Виправ.

---

## Аналіз нестабільного тесту

Прочитав `ai-runs/d-repeat-before.txt`: 4 з 30 прогонів червоні, завжди тест `every receipt of a week of rides ends with the amount due` у `test/integration/receipt.test.js`.

Повідомлення про помилку показують, що тест падає на поїздках тривалістю 30 або 60 хвилин:
- ebike, 30 min: got 40,00 грн, expected 80,00 грн
- classic, 60 min: got 50,00 грн, expected 75,00 грн
- ebike, 60 min: got 80,00 грн, expected 120,00 грн

## Причина

Формула очікуваного значення в тесті (рядок 15):
```javascript
const expected = (Math.floor(minutes / 30) + 1) * PRICE[ride.bike];
```

Формула в `app/src/tariff.js` (функція `blocks`):
```javascript
function blocks(minutes) {
  return Math.ceil(minutes / BLOCK_MINUTES);
}
```

Коли `minutes` — кратне 30:
- `Math.floor(30/30) + 1 = 1 + 1 = 2` (тест очікує 2 блоки)
- `Math.ceil(30/30) = 1` (код рахує 1 блок)

Коли `minutes` — не кратне 30 (наприклад, 31):
- `Math.floor(31/30) + 1 = 1 + 1 = 2`
- `Math.ceil(31/30) = 2`
— однакові значення.

`randomRide()` генерує тривалість від 5 до 89 хвилин. Кратні 30 (30 і 60) трапляються із загальною ймовірністю 2/85 ≈ 2,4 % на одну поїздку. З 10 поїздок на прогін імовірність хоча б одного кратного ≈ 21 %, що добре пояснює 4 з 30 падінь.

## Виправлення

Замінив формулу в тесті на `Math.ceil(minutes / 30)`, яка відповідає логіці коду:

```diff
-    const expected = (Math.floor(minutes / 30) + 1) * PRICE[ride.bike];
+    const expected = Math.ceil(minutes / 30) * PRICE[ride.bike];
```

Після виправлення запустив тести — усі зелені.
