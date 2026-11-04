// docs/test-cases.md TC-01…TC-16: duration (T1), false start (T2), blocks (T3).
import test from "node:test";
import assert from "node:assert/strict";
import { quoteRow } from "../helpers/spec-ride.js";

const CASES = [
  { id: "TC-01", rule: "T1", from: "10:00:00", to: "10:12:40", minutes: 13, total: 2500 },
  { id: "TC-02", rule: "T1", from: "14:05:00", to: "14:41:00", minutes: 36, total: 5000 },
  { id: "TC-03", rule: "T1", from: "10:00:00", to: "10:30:01", minutes: 31, total: 5000 },
  { id: "TC-04", rule: "T1", from: "10:00:00", to: "10:30:29", minutes: 31, total: 5000 },
  { id: "TC-05", rule: "T1", from: "10:00:00", to: "10:01:30", minutes: 2, total: 0 },
  { id: "TC-06", rule: "T2", from: "10:00:00", to: "10:00:50", minutes: 1, total: 0 },
  { id: "TC-07", rule: "T2", from: "10:00:00", to: "10:02:00", minutes: 2, total: 0 },
  { id: "TC-08", rule: "T2", from: "10:00:00", to: "10:02:01", minutes: 3, total: 2500 },
  { id: "TC-09", rule: "T2", from: "10:00", to: "10:04", total: 2500 },
  { id: "TC-10", rule: "T2", from: "10:00:00", to: "10:00:00", total: 0 },
  { id: "TC-11", rule: "T2, T7", from: "10:00:00", to: "10:01:00", station: "X01", total: 15000 },
  { id: "TC-12", rule: "T3", from: "10:00", to: "10:30", total: 2500 },
  { id: "TC-13", rule: "T3", from: "10:00", to: "10:31", total: 5000 },
  { id: "TC-14", rule: "T3", from: "10:00", to: "10:50", total: 5000 },
  { id: "TC-15", rule: "T3", bike: "ebike", from: "10:00", to: "11:15", total: 12000 },
  { id: "TC-16", rule: "T3", bike: "ebike", from: "10:00", to: "10:30", total: 4000 },
];

for (const c of CASES) {
  const label = `${c.bike ?? "classic"}, ${c.from} → ${c.to}${c.station ? `, ${c.station}` : ""}`;
  const want = c.minutes === undefined ? `${c.total}` : `${c.minutes} хв, ${c.total}`;
  test(`${c.rule}: ${c.id} ${label} → ${want}`, () => {
    const result = quoteRow(c);
    if (c.minutes !== undefined) assert.equal(result.minutes, c.minutes, "тривалість, хв");
    assert.equal(result.total, c.total, "до сплати, коп.");
  });
}
