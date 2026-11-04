// docs/test-cases.md TC-17…TC-31: subscription (T4) and reduced fare (T5).
import test from "node:test";
import assert from "node:assert/strict";
import { quoteRow } from "../helpers/spec-ride.js";

const CASES = [
  { id: "TC-17", rule: "T4", rider: "subscriber", from: "10:00", to: "10:40", total: 0 },
  { id: "TC-18", rule: "T4", rider: "subscriber", from: "10:00", to: "10:45", total: 0 },
  { id: "TC-19", rule: "T4", rider: "subscriber", from: "10:00", to: "10:46", total: 2500 },
  { id: "TC-20", rule: "T4", rider: "subscriber", from: "10:00", to: "11:16", total: 5000 },
  { id: "TC-21", rule: "T4", rider: "subscriber", from: "10:00", to: "11:40", total: 5000 },
  { id: "TC-22", rule: "T4", rider: "subscriber", bike: "ebike", from: "10:00", to: "10:10", total: 3200 },
  { id: "TC-23", rule: "T4", rider: "subscriber", bike: "ebike", from: "10:00", to: "10:46", total: 6400 },
  { id: "TC-24", rule: "T5", rider: "reduced", from: "10:00", to: "10:40", total: 2500 },
  { id: "TC-25", rule: "T5", rider: "reduced", bike: "ebike", from: "10:00", to: "11:15", total: 6000 },
  { id: "TC-26", rule: "T5", rider: "subscriberConcession", from: "10:00", to: "11:20", total: 3750 },
  { id: "TC-27", rule: "T5", rider: "subscriberConcession", from: "10:00", to: "10:40", total: 0 },
  {
    id: "TC-28",
    rule: "T5",
    rider: "subscriberConcession",
    from: "10:00",
    to: "10:46",
    total: 2500,
    discountCodes: ["subscription"],
  },
  { id: "TC-29", rule: "T5", rider: "subscriberConcession", bike: "ebike", from: "10:00", to: "10:30", total: 2000 },
  { id: "TC-30", rule: "T5, T7", rider: "reduced", from: "10:00", to: "10:20", station: "X02", total: 16250 },
  {
    id: "TC-31",
    rule: "T5, T7",
    rider: "subscriberConcession",
    from: "10:00",
    to: "12:00",
    station: "X01",
    total: 20000,
  },
];

for (const c of CASES) {
  const label = `${c.rider}, ${c.bike ?? "classic"}, ${c.from} → ${c.to}${c.station ? `, ${c.station}` : ""}`;
  test(`${c.rule}: ${c.id} ${label} → ${c.total}`, () => {
    const result = quoteRow(c);
    assert.equal(result.total, c.total, "до сплати, коп.");
    if (c.discountCodes) {
      assert.deepEqual(
        result.discounts.map((d) => d.code),
        c.discountCodes,
        "за рівних сум застосовано абонемент",
      );
    }
  });
}
