// Unit-тести для app/src/day-cap.js на вбудованому ранері Node (node:test + node:assert/strict).
// Прогін: node --test "ai-runs/b1-from-code/*.test.js"
//
// day-cap.js у коментарі сам називає правило «T6»: денний ліміт часового платежу
// (DAY_CAP = 30000 коп). Очікувані значення — з констант і логіки модуля;
// специфікація docs/spec/tariffs.md у canvas-теці була недоступна (лише app/src/ + package.json).

import assert from "node:assert/strict";
import { test } from "node:test";

import { DAY_CAP, createDayCap, dayKey } from "../../app/src/day-cap.js";

test("T6: константа денного ліміту — рівно 30000 коп, і ledger за замовчуванням має саме її", () => {
  assert.equal(DAY_CAP, 30000);
  assert.equal(createDayCap().limit, 30000);
});

test("T6: ліміт задається опцією { limit }", () => {
  assert.equal(createDayCap({ limit: 1_000_000 }).limit, 1_000_000);
});

test("T6: до перших записів книжка лишає повний ліміт будь-якому клієнту на будь-яку добу", () => {
  const cap = createDayCap();
  assert.equal(cap.remaining("u1", "2026-05-01T10:00:00Z"), 30000);
  assert.equal(cap.remaining("nobody", "2030-01-01T00:00:00Z"), 30000);
});

test("T6: власний limit відображається в remaining, записи накопичуються", () => {
  const cap = createDayCap({ limit: 100000 });
  assert.equal(cap.remaining("u1", "2026-05-01T10:00:00Z"), 100000);
  cap.record("u1", "2026-05-01T10:00:00Z", 60000);
  assert.equal(cap.remaining("u1", "2026-05-01T10:00:00Z"), 40000);
});

test("T6: записи в межах доби накопичуються: 10000 + 10000 → залишок 10000", () => {
  const cap = createDayCap();
  cap.record("u1", "2026-05-01T10:00:00Z", 10000);
  assert.equal(cap.remaining("u1", "2026-05-01T10:00:00Z"), 20000);
  cap.record("u1", "2026-05-01T18:00:00Z", 10000); // інша година, та сама доба
  assert.equal(cap.remaining("u1", "2026-05-01T18:00:00Z"), 10000);
  assert.equal(cap.chargedOn("u1", "2026-05-01"), 20000);
});

test("T6: залишок не стає відʼємним: рівно 30000 → 0, ще +15000 → знову 0", () => {
  const cap = createDayCap();
  cap.record("u1", "2026-05-01T10:00:00Z", 30000);
  assert.equal(cap.remaining("u1", "2026-05-01T10:00:00Z"), 0);
  cap.record("u1", "2026-05-01T20:00:00Z", 15000);
  assert.equal(cap.remaining("u1", "2026-05-01T20:00:00Z"), 0);
  assert.equal(cap.chargedOn("u1", "2026-05-01"), 45000);
});

test("T6: у кожного клієнта свій ліміт: u2 не постраждав від великих записів u1", () => {
  const cap = createDayCap();
  cap.record("u1", "2026-05-01T10:00:00Z", 30000);
  assert.equal(cap.remaining("u2", "2026-05-01T10:00:00Z"), 30000);
  assert.equal(cap.chargedOn("u2", "2026-05-01"), 0);
});

test("T6: наступної доби ліміт відновлюється (доби живуть під окремими ключами)", () => {
  const cap = createDayCap();
  cap.record("u1", "2026-05-01T10:00:00Z", 30000);
  assert.equal(cap.remaining("u1", "2026-05-02T10:00:00Z"), 30000);
  assert.equal(cap.chargedOn("u1", "2026-05-02"), 0);
});

test("dayKey: доба з ISO-момента — «2026-05-01» для 10:00Z", () => {
  assert.equal(dayKey(Date.parse("2026-05-01T10:00:00Z")), "2026-05-01");
});

test("dayKey: різні доби дають різні ключі (межа півночі UTC)", () => {
  assert.equal(dayKey(Date.parse("2026-01-01T00:00:00Z")), "2026-01-01");
  assert.equal(dayKey(Date.parse("2025-12-31T23:59:59Z")), "2025-12-31");
});

test("chargedOn: без записів — 0 (нікого, ніколи)", () => {
  assert.equal(createDayCap().chargedOn("nobody", "2026-05-01"), 0);
});
