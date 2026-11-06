// Tests for app/src/day-cap.js
// No docs/spec/ found → all expected values come from the source code.
// Every test is marked ASSUMPTION: per project rule 2.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DAY_CAP, dayKey, createDayCap } from "../../app/src/day-cap.js";

const ms = (iso) => Date.parse(iso);

// ─── DAY_CAP constant ────────────────────────────────────────────────────────

describe("DAY_CAP", () => {
  it("ASSUMPTION: DAY_CAP = 30 000 kopecks (300 UAH)", () => {
    // ПРИПУЩЕННЯ: значення з рядка 3 day-cap.js — `export const DAY_CAP = 30000`
    // ПИТАННЯ: підтвердити розмір добового ліміту у тарифному документі
    assert.equal(DAY_CAP, 30000);
  });
});

// ─── dayKey ──────────────────────────────────────────────────────────────────

describe("dayKey", () => {
  it("ASSUMPTION: returns the UTC date portion of the pickup instant", () => {
    // ПРИПУЩЕННЯ: `new Date(ms).toISOString().slice(0,10)` — UTC дата, day-cap.js:6
    // ПИТАННЯ: чи правильно використовувати UTC для визначення дня, а не київський час?
    for (const { id, instant, expected } of [
      { id: "noon-UTC",   instant: ms("2026-11-05T12:00:00Z"), expected: "2026-11-05" },
      { id: "23:59-UTC",  instant: ms("2026-11-05T23:59:59Z"), expected: "2026-11-05" },
      { id: "00:00-UTC",  instant: ms("2026-11-06T00:00:00Z"), expected: "2026-11-06" },
    ]) {
      assert.equal(dayKey(instant), expected, id);
    }
  });

  it("ASSUMPTION: dayKey uses UTC — 22:00Z is 2026-11-05 UTC but 00:00 Kyiv (06.11)", () => {
    // ПРИПУЩЕННЯ: dayKey("2026-11-05T22:00:00Z") = "2026-11-05" (UTC),
    //   хоча в Києві (UTC+2 EET, після 25.10.2026) вже 2026-11-06 00:00
    // ПИТАННЯ: очікувана поведінка чи дефект?  Добовий ліміт має скидатись за Києвом?
    assert.equal(dayKey(ms("2026-11-05T22:00:00Z")), "2026-11-05");
  });
});

// ─── createDayCap ────────────────────────────────────────────────────────────

describe("createDayCap", () => {
  it("ASSUMPTION: remaining() starts at 30 000 kop for a fresh ledger", () => {
    // ПРИПУЩЕННЯ: початковий залишок = DAY_CAP = 30 000 — day-cap.js:17-19
    const cap = createDayCap();
    assert.equal(cap.remaining("u1", ms("2026-11-05T10:00:00Z")), 30000);
  });

  it("ASSUMPTION: record() reduces remaining by the recorded amount", () => {
    // ПРИПУЩЕННЯ: charged накопичується, залишок зменшується — day-cap.js:21-24
    const cap = createDayCap();
    cap.record("u1", ms("2026-11-05T10:00:00Z"), 5000);
    assert.equal(cap.remaining("u1", ms("2026-11-05T10:00:00Z")), 25000);
  });

  it("ASSUMPTION: remaining() is clamped to 0 when over-recorded", () => {
    // ПРИПУЩЕННЯ: Math.max(0, ...) у day-cap.js:18 не дозволяє від'ємний залишок
    const cap = createDayCap();
    cap.record("u1", ms("2026-11-05T10:00:00Z"), 35000); // > DAY_CAP
    assert.equal(cap.remaining("u1", ms("2026-11-05T10:00:00Z")), 0);
  });

  it("ASSUMPTION: chargedOn() returns accumulated charges for the UTC day string", () => {
    // ПРИПУЩЕННЯ: ключ = `riderId|YYYY-MM-DD` (UTC) — day-cap.js:12,25-27
    const cap = createDayCap();
    cap.record("u1", ms("2026-11-05T08:00:00Z"), 5000);
    cap.record("u1", ms("2026-11-05T14:00:00Z"), 7000);
    assert.equal(cap.chargedOn("u1", "2026-11-05"), 12000);
  });

  it("ASSUMPTION: custom limit overrides DAY_CAP", () => {
    // ПРИПУЩЕННЯ: `createDayCap({ limit: N })` встановлює свій ліміт — day-cap.js:10
    const cap = createDayCap({ limit: 10000 });
    assert.equal(cap.remaining("u1", ms("2026-11-05T10:00:00Z")), 10000);
  });

  it("ASSUMPTION: different rider IDs are tracked independently on the same day", () => {
    // ПРИПУЩЕННЯ: ключ включає riderId — day-cap.js:12
    const cap = createDayCap();
    cap.record("u1", ms("2026-11-05T10:00:00Z"), 20000);
    assert.equal(cap.remaining("u2", ms("2026-11-05T10:00:00Z")), 30000, "u2-unaffected");
    assert.equal(cap.remaining("u1", ms("2026-11-05T10:00:00Z")), 10000, "u1-reduced");
  });

  it("ASSUMPTION: different UTC days are tracked independently for the same rider", () => {
    // ПРИПУЩЕННЯ: ключ включає UTC дату — рядки 05.11 UTC не впливають на 06.11 UTC
    const cap = createDayCap();
    cap.record("u1", ms("2026-11-05T10:00:00Z"), 30000);
    assert.equal(cap.remaining("u1", ms("2026-11-06T10:00:00Z")), 30000, "next-day-fresh");
    assert.equal(cap.remaining("u1", ms("2026-11-05T10:00:00Z")), 0,     "today-exhausted");
  });
});
