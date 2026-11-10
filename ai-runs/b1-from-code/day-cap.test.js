const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const SRC = "../../app/src/";

async function loadDayCap() {
  return await import(SRC + "day-cap.js");
}

describe("day-cap", () => {
  test("dayKey returns the YYYY-MM-DD of the instant", async () => {
    const { dayKey } = await loadDayCap();
    assert.strictEqual(dayKey("2026-01-15T10:00:00+02:00"), "2026-01-15");
    assert.strictEqual(dayKey("2026-01-15T23:30:00Z"), "2026-01-15");
    assert.strictEqual(dayKey("2026-01-16T00:00:00Z"), "2026-01-16");
  });

  test("default limit is 30000 kopecks", async () => {
    const { createDayCap, DAY_CAP } = await loadDayCap();
    const cap = createDayCap();
    assert.strictEqual(cap.limit, DAY_CAP);
    assert.strictEqual(DAY_CAP, 30000);
  });

  test("remaining starts at the limit", async () => {
    const { createDayCap } = await loadDayCap();
    const cap = createDayCap({ limit: 7000 });
    assert.strictEqual(cap.remaining("r1", "2026-01-15T10:00:00Z"), 7000);
  });

  test("remaining decreases after recording a charge", async () => {
    const { createDayCap } = await loadDayCap();
    const cap = createDayCap({ limit: 5000 });
    cap.record("r1", "2026-01-15T10:00:00Z", 2000);
    assert.strictEqual(cap.remaining("r1", "2026-01-15T11:00:00Z"), 3000);
    assert.strictEqual(cap.chargedOn("r1", "2026-01-15"), 2000);
  });

  test("records accumulate on the same rider-day key", async () => {
    const { createDayCap } = await loadDayCap();
    const cap = createDayCap({ limit: 10000 });
    cap.record("r1", "2026-01-15T08:00:00Z", 3000);
    cap.record("r1", "2026-01-15T09:00:00Z", 4000);
    assert.strictEqual(cap.chargedOn("r1", "2026-01-15"), 7000);
    assert.strictEqual(cap.remaining("r1", "2026-01-15T10:00:00Z"), 3000);
  });

  test("remaining never goes below zero", async () => {
    const { createDayCap } = await loadDayCap();
    const cap = createDayCap({ limit: 1000 });
    cap.record("r1", "2026-01-15T10:00:00Z", 5000);
    assert.strictEqual(cap.remaining("r1", "2026-01-15T11:00:00Z"), 0);
  });

  test("different riders are tracked independently", async () => {
    const { createDayCap } = await loadDayCap();
    const cap = createDayCap({ limit: 5000 });
    cap.record("r1", "2026-01-15T10:00:00Z", 3000);
    assert.strictEqual(cap.remaining("r1", "2026-01-15T10:00:00Z"), 2000);
    assert.strictEqual(cap.remaining("r2", "2026-01-15T10:00:00Z"), 5000);
  });

  test("different days are tracked independently", async () => {
    const { createDayCap } = await loadDayCap();
    const cap = createDayCap({ limit: 5000 });
    cap.record("r1", "2026-01-15T10:00:00Z", 3000);
    assert.strictEqual(cap.remaining("r1", "2026-01-15T11:00:00Z"), 2000);
    assert.strictEqual(cap.remaining("r1", "2026-01-16T10:00:00Z"), 5000);
    assert.strictEqual(cap.chargedOn("r1", "2026-01-16"), 0);
  });

  test("chargedOn returns 0 when nothing was recorded", async () => {
    const { createDayCap } = await loadDayCap();
    const cap = createDayCap();
    assert.strictEqual(cap.chargedOn("nobody", "2026-01-01"), 0);
  });
});
