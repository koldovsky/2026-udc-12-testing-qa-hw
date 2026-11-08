// Тести денного ліміту (T6) для app/src/day-cap.js.
//
// Оракул: T6 — доба для денного ліміту рахується за Києвом (app/AGENTS.md, правило 5:
// «Для правил, що залежать від доби чи години за Києвом (T6, T10)…»).
// Сам розмір ліміту (DAY_CAP) і тарифи тут не використовуються: ліміт задається у тесті
// явно через createDayCap({ limit }), тож очікування не залежать від констант з app/src/.
// Моменти підібрано так, що дата за UTC і за Києвом різна; час записано зі зміщенням +03:00
// (Київ, літній час).

import { test } from "node:test";
import assert from "node:assert/strict";
import { createDayCap } from "../../app/src/day-cap.js";

const LIMIT = 1000;
const BOOKED = 400;

const cases = [
  {
    name: "одна доба за Києвом, різні доби за UTC — ліміт спільний",
    // 2026-06-15 01:00 Київ = 2026-06-14 22:00 UTC; 2026-06-15 10:00 Київ = 2026-06-15 07:00 UTC
    first: "2026-06-15T01:00:00+03:00",
    second: "2026-06-15T10:00:00+03:00",
    expectedRemaining: LIMIT - BOOKED,
  },
  {
    name: "різні доби за Києвом, одна доба за UTC — ліміт окремий",
    // 2026-06-14 23:30 Київ = 2026-06-14 20:30 UTC; 2026-06-15 00:30 Київ = 2026-06-14 21:30 UTC
    first: "2026-06-14T23:30:00+03:00",
    second: "2026-06-15T00:30:00+03:00",
    expectedRemaining: LIMIT,
  },
];

for (const { name, first, second, expectedRemaining } of cases) {
  test(`T6: ${name}`, () => {
    const cap = createDayCap({ limit: LIMIT });
    cap.record("rider-1", first, BOOKED);
    assert.equal(cap.remaining("rider-1", second), expectedRemaining);
  });
}

test("T6: поїздка о 01:00 за Києвом записується на київську дату", () => {
  const cap = createDayCap({ limit: LIMIT });
  // 2026-06-15 01:00 Київ = 2026-06-14 22:00 UTC → доба 2026-06-15 за Києвом
  cap.record("rider-1", "2026-06-15T01:00:00+03:00", BOOKED);
  assert.equal(cap.chargedOn("rider-1", "2026-06-15"), BOOKED);
  assert.equal(cap.chargedOn("rider-1", "2026-06-14"), 0);
});
