// docs/test-cases.md TC-40…TC-48: out-of-zone fee (T7) and unreturned bike fee (T8).
import test from "node:test";
import assert from "node:assert/strict";
import { quoteRow } from "../helpers/spec-ride.js";

const NEXT_DAY = "2026-09-17";

const CASES = [
  { id: "TC-40", rule: "T7", from: "10:00", to: "10:20", station: "X01", total: 17500 },
  { id: "TC-41", rule: "T7", from: "10:00", to: "10:20", station: "S08", total: 2500 },
  { id: "TC-42", rule: "T7", rider: "subscriber", from: "10:00", to: "10:40", station: "X03", total: 15000 },
  { id: "TC-43", rule: "T8", from: "10:00:00", to: "10:00:00", toDate: NEXT_DAY, total: 30000, unreturned: false },
  { id: "TC-44", rule: "T8", from: "10:00:00", to: "10:00:01", toDate: NEXT_DAY, total: 230000 },
  { id: "TC-45", rule: "T8", from: "10:00", to: "11:00", toDate: NEXT_DAY, total: 230000 },
  { id: "TC-46", rule: "T8, T7", from: "10:00", to: "11:00", toDate: NEXT_DAY, station: "X01", total: 245000 },
  { id: "TC-47", rule: "T8, T5", rider: "reduced", from: "10:00", to: "11:00", toDate: NEXT_DAY, total: 230000 },
  {
    id: "TC-48",
    rule: "T8, T6",
    from: "10:00",
    to: "11:00",
    toDate: NEXT_DAY,
    charged: [{ day: "2026-09-16", amount: 30000 }],
    total: 200000,
  },
];

for (const c of CASES) {
  const to = c.toDate ? `17.09 ${c.to}` : c.to;
  const extra = [c.rider, c.station, c.charged && "нараховано 30 000"].filter(Boolean).join(", ");
  test(`${c.rule}: ${c.id} classic, ${c.from} → ${to}${extra ? `, ${extra}` : ""} → ${c.total}`, () => {
    const result = quoteRow(c);
    assert.equal(result.total, c.total, "до сплати, коп.");
    if (c.unreturned === false) {
      assert.ok(!result.fees.some((f) => f.code === "unreturned"), "збору T8 немає");
    }
  });
}
