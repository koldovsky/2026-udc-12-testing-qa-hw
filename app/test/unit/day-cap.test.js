import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap, DAY_CAP, dayKey } from "../../src/day-cap.js";

test("charges recorded for a day reduce what is left of the cap", () => {
  const ledger = createDayCap();
  ledger.record("rider-1", "2026-09-16T08:00:00Z", 12000);
  assert.ok(ledger.remaining("rider-1", "2026-09-16T12:00:00Z") < DAY_CAP);
});

test("the day of a ride is the date of its pickup", () => {
  assert.equal(dayKey("2026-09-16T08:00:00Z"), "2026-09-16");
});

// Свіжий реєстр: ліміт доби доступний повністю, нараховано нічого. Точні значення, а не
// «менше за ліміт», — інакше помилка на одиницю в `remaining()` лишається непоміченою.
test("a fresh ledger leaves the whole cap and has nothing charged", () => {
  const ledger = createDayCap();
  assert.equal(ledger.limit, DAY_CAP, "ліміт за замовчуванням");
  assert.equal(ledger.remaining("rider-new", "2026-09-16T08:00:00Z"), DAY_CAP, "доступний увесь ліміт");
  assert.equal(ledger.chargedOn("rider-new", "2026-09-16"), 0, "за добу нічого не нараховано");
});

test("remaining and chargedOn report exact amounts, per rider and per day", () => {
  const ledger = createDayCap();
  ledger.record("rider-1", "2026-09-16T08:00:00Z", 12000);
  assert.equal(ledger.chargedOn("rider-1", "2026-09-16"), 12000);
  assert.equal(ledger.remaining("rider-1", "2026-09-16T12:00:00Z"), DAY_CAP - 12000);

  // Нарахування складаються; понад ліміт залишок — рівно 0, а не від'ємне число.
  ledger.record("rider-1", "2026-09-16T12:00:00Z", 25000);
  assert.equal(ledger.chargedOn("rider-1", "2026-09-16"), 37000, "нарахування за добу складаються");
  assert.equal(ledger.remaining("rider-1", "2026-09-16T20:00:00Z"), 0, "залишок не буває від'ємним");

  assert.equal(ledger.chargedOn("rider-1", "2026-09-17"), 0, "інша доба — окремий рахунок");
  assert.equal(ledger.remaining("rider-1", "2026-09-17T08:00:00Z"), DAY_CAP, "нова доба — повний ліміт");
  assert.equal(ledger.chargedOn("rider-2", "2026-09-16"), 0, "інший користувач — окремий рахунок");
});

// T6 (docs/spec/tariffs.md:101-102): доба — київська календарна дата моменту взяття.
test("the day is the Kyiv calendar date of the pickup, not the UTC one", () => {
  assert.equal(dayKey("2026-09-16T21:30:00Z"), "2026-09-17", "00:30 за Києвом — це вже наступна доба");
  assert.equal(dayKey("2026-09-16T23:40:00+03:00"), "2026-09-16", "23:40 за Києвом — ще та сама доба");
});

// Налаштовуваний ліміт: межа «рівно ліміт» ще не вичерпує його, а перевищення дає 0.
test("a custom limit is respected at its exact boundary", () => {
  const ledger = createDayCap({ limit: 1000 });
  assert.equal(ledger.remaining("rider-3", "2026-09-16T08:00:00Z"), 1000);
  ledger.record("rider-3", "2026-09-16T08:00:00Z", 1000);
  assert.equal(ledger.remaining("rider-3", "2026-09-16T09:00:00Z"), 0);
});
