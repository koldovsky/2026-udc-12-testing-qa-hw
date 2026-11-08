// Unit-тести для app/src/day-cap.js — денний ліміт (T6) і журнал нарахувань.
// Тести написано за кодом (специфікацію docs/spec/tariffs.md не читали), тож вони фіксують
// поточну поведінку. Місця, які варто звірити зі специфікацією, позначено «звірити».

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DAY_CAP, createDayCap, dayKey } from "../../app/src/day-cap.js";

const at = (iso) => Date.parse(iso);

describe("DAY_CAP", () => {
  test("300 грн у копійках", () => {
    assert.equal(DAY_CAP, 30000);
  });
});

describe("dayKey", () => {
  test("повертає дату моменту посадки у форматі YYYY-MM-DD", () => {
    assert.equal(dayKey(at("2026-01-15T10:00:00Z")), "2026-01-15");
  });

  test("межі доби рахуються за UTC", () => {
    assert.equal(dayKey(at("2026-01-15T00:00:00Z")), "2026-01-15");
    assert.equal(dayKey(at("2026-01-15T23:59:59.999Z")), "2026-01-15");
    assert.equal(dayKey(at("2026-01-16T00:00:00Z")), "2026-01-16");
  });

  test("звірити: момент між київською та UTC-північчю потрапляє в попередню дату", () => {
    // 01:00 за Києвом 16.01 (зима, UTC+2) = 23:00 UTC 15.01
    assert.equal(dayKey(at("2026-01-16T01:00:00+02:00")), "2026-01-15");
    // 02:30 за Києвом 16.06 (літо, UTC+3) = 23:30 UTC 15.06
    assert.equal(dayKey(at("2026-06-16T02:30:00+03:00")), "2026-06-15");
  });

  test("приймає також рядок ISO і об'єкт Date", () => {
    assert.equal(dayKey("2026-01-15T10:00:00Z"), "2026-01-15");
    assert.equal(dayKey(new Date("2026-01-15T10:00:00Z")), "2026-01-15");
  });

  test("некоректний момент → RangeError", () => {
    assert.throws(() => dayKey(NaN), RangeError);
    assert.throws(() => dayKey("not a date"), RangeError);
  });
});

describe("createDayCap", () => {
  const day = at("2026-01-15T10:00:00Z");

  test("ліміт за замовчуванням — DAY_CAP; новий райдер має весь ліміт", () => {
    const cap = createDayCap();
    assert.equal(cap.limit, 30000);
    assert.equal(cap.remaining("r1", day), 30000);
    assert.equal(createDayCap({}).limit, 30000);
  });

  test("можна задати власний ліміт", () => {
    const cap = createDayCap({ limit: 10000 });
    assert.equal(cap.limit, 10000);
    assert.equal(cap.remaining("r1", day), 10000);
  });

  test("ліміт 0 — залишок завжди 0", () => {
    const cap = createDayCap({ limit: 0 });
    assert.equal(cap.remaining("r1", day), 0);
  });

  test("record зменшує залишок, суми накопичуються", () => {
    const cap = createDayCap();
    cap.record("r1", day, 12000);
    assert.equal(cap.remaining("r1", day), 18000);
    cap.record("r1", day, 5000);
    assert.equal(cap.remaining("r1", day), 13000);
    assert.equal(cap.chargedOn("r1", "2026-01-15"), 17000);
  });

  test("запис нуля нічого не змінює", () => {
    const cap = createDayCap();
    cap.record("r1", day, 0);
    assert.equal(cap.remaining("r1", day), 30000);
    assert.equal(cap.chargedOn("r1", "2026-01-15"), 0);
  });

  test("залишок не буває від'ємним, а chargedOn показує повну суму", () => {
    const cap = createDayCap();
    cap.record("r1", day, 45000);
    assert.equal(cap.remaining("r1", day), 0);
    assert.equal(cap.chargedOn("r1", "2026-01-15"), 45000);
  });

  test("записи протягом однієї UTC-доби потрапляють в один день", () => {
    const cap = createDayCap();
    cap.record("r1", at("2026-01-15T00:00:00Z"), 1000);
    cap.record("r1", at("2026-01-15T23:59:59Z"), 2000);
    assert.equal(cap.chargedOn("r1", "2026-01-15"), 3000);
    assert.equal(cap.remaining("r1", at("2026-01-15T12:00:00Z")), 27000);
  });

  test("різні райдери не впливають один на одного", () => {
    const cap = createDayCap();
    cap.record("r1", day, 20000);
    assert.equal(cap.remaining("r2", day), 30000);
    assert.equal(cap.chargedOn("r2", "2026-01-15"), 0);
  });

  test("різні дні не впливають один на одного", () => {
    const cap = createDayCap();
    cap.record("r1", day, 30000);
    assert.equal(cap.remaining("r1", day), 0);
    assert.equal(cap.remaining("r1", at("2026-01-16T10:00:00Z")), 30000);
    assert.equal(cap.chargedOn("r1", "2026-01-16"), 0);
  });

  test("chargedOn для невідомого райдера, дня чи формату дати — 0", () => {
    const cap = createDayCap();
    cap.record("r1", day, 5000);
    assert.equal(cap.chargedOn("nobody", "2026-01-15"), 0);
    assert.equal(cap.chargedOn("r1", "2026-02-01"), 0);
    assert.equal(cap.chargedOn("r1", "15.01.2026"), 0);
  });

  test("кожен журнал має власний стан", () => {
    const a = createDayCap();
    const b = createDayCap();
    a.record("r1", day, 10000);
    assert.equal(a.remaining("r1", day), 20000);
    assert.equal(b.remaining("r1", day), 30000);
  });
});
