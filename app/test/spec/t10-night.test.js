// T10 — нічна знижка: docs/test-cases.md, TC-78…TC-85.
// Поїздки, що лише частково в 00:00–06:00, взяття рівно о 06:00:00 і T10 разом з T4 / T5 —
// питання Q-1, Q-10, Q-2: не автоматизуються.
import test from "node:test";
import assert from "node:assert/strict";
import { amountDue, expectedDue, quoteRow, ride } from "./helpers.js";

// Клас., станд., якщо не вказано інше.
const CASES = [
  { id: "TC-78", note: "01:10 → 01:40: 1 блок − 30 %", ride: ride("16.09 01:10:00", "16.09 01:40:00"), total: 1750 },
  { id: "TC-79", note: "ел., 02:00 → 02:45: 2 блоки − 30 %", ride: ride("16.09 02:00:00", "16.09 02:45:00", { bike: "ebike" }), total: 5600 },
  { id: "TC-80", note: "межа: взяття рівно о 00:00:00", ride: ride("16.09 00:00:00", "16.09 00:30:00"), total: 1750 },
  { id: "TC-81", note: "межа: 23:00:00 → 23:59:59, цілком до 00:00", ride: ride("16.09 23:00:00", "16.09 23:59:59"), total: 5000 },
  { id: "TC-82", note: "межа: 05:30:00 → 05:59:59, цілком у вікні", ride: ride("16.09 05:30:00", "16.09 05:59:59"), total: 1750 },
  { id: "TC-83", note: "межа: 06:00:01 → 06:30:01, цілком поза вікном", ride: ride("16.09 06:00:01", "16.09 06:30:01"), total: 2500 },
  {
    id: "TC-84",
    note: "03:10Z → 03:40Z = 06:10–06:40 за Києвом (+03:00): день",
    ride: ride("2026-09-16T03:10:00Z", "2026-09-16T03:40:00Z"),
    total: 2500,
  },
  {
    id: "TC-85",
    note: "03:00Z → 03:30Z = 05:00–05:30 за Києвом (+02:00): ніч",
    ride: ride("2026-11-16T03:00:00Z", "2026-11-16T03:30:00Z"),
    total: 1750,
  },
];

for (const row of CASES) {
  test(`T10: ${row.id} — ${row.note} → ${row.total}`, () => {
    assert.deepEqual(amountDue(quoteRow(row)), expectedDue(row.total));
  });
}
