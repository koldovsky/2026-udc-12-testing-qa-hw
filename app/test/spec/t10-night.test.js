// docs/test-cases.md TC-53…TC-59: night discount (T10) by Kyiv wall-clock time.
import test from "node:test";
import assert from "node:assert/strict";
import { quoteRow } from "../helpers/spec-ride.js";

const CASES = [
  { id: "TC-53", rule: "T10", from: "01:10", to: "01:40", total: 1750 },
  { id: "TC-54", rule: "T10", from: "00:00:00", to: "00:20:00", total: 1750 },
  { id: "TC-55", rule: "T10", from: "05:30", to: "05:59", total: 1750 },
  { id: "TC-56", rule: "T10", from: "07:00", to: "07:20", total: 2500 },
  { id: "TC-57", rule: "T10", bike: "ebike", from: "2026-09-16T03:30:00Z", to: "2026-09-16T03:50:00Z", total: 4000 },
  { id: "TC-58", rule: "T10", from: "2026-11-04T22:30:00Z", to: "2026-11-04T23:00:00Z", total: 1750 },
  { id: "TC-59", rule: "T10, T2", from: "01:00:00", to: "01:01:00", total: 0 },
];

for (const c of CASES) {
  test(`${c.rule}: ${c.id} ${c.bike ?? "classic"}, ${c.from} → ${c.to} → ${c.total}`, () => {
    assert.equal(quoteRow(c).total, c.total, "до сплати, коп.");
  });
}
