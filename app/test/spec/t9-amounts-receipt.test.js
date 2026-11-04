// docs/test-cases.md TC-49…TC-52: kopecks, rounding down and the receipt (T9).
import test from "node:test";
import assert from "node:assert/strict";
import { formatReceipt } from "../../src/receipt.js";
import { discount } from "../../src/tariff.js";
import { quoteRow } from "../helpers/spec-ride.js";

test("T9: TC-49 знижка 30 % від 1 235 коп. → до сплати 864, знижка 371", () => {
  const off = discount(1235, 30);
  assert.equal(off, 371, "знижка");
  assert.equal(1235 - off, 864, "до сплати");
});

const endsWithAmount = (line, amount) => line.endsWith(` ${amount}`);

const CASES = [
  {
    id: "TC-50",
    rule: "T9",
    what: "чек для TC-45",
    row: { from: "10:00", to: "11:00", toDate: "2026-09-17" },
    lines: [],
    due: "2 300,00 грн",
  },
  {
    id: "TC-51",
    rule: "T9",
    what: "чек для TC-30",
    row: { rider: "reduced", from: "10:00", to: "10:20", station: "X02" },
    duration: "20 хв",
    lines: ["25,00 грн", "-12,50 грн", "150,00 грн"],
    due: "162,50 грн",
  },
  {
    id: "TC-52",
    rule: "T9, T6",
    what: "чек для TC-34",
    row: { from: "10:00", to: "10:20", charged: [{ amount: 28000 }] },
    lines: ["-5,00 грн"],
    due: "20,00 грн",
  },
];

for (const c of CASES) {
  const want = [c.duration, ...c.lines].filter(Boolean).join("; ");
  test(`${c.rule}: ${c.id} ${c.what} → ${want ? `${want}; ` : ""}До сплати ${c.due}`, () => {
    const lines = formatReceipt(quoteRow(c.row));
    const body = lines.slice(0, -1);
    const last = lines.at(-1);
    assert.ok(last.startsWith("До сплати"), `останній рядок: ${last}`);
    assert.ok(endsWithAmount(last, c.due), `«До сплати»: ${last}`);
    if (c.duration) {
      assert.ok(body.some((l) => /тривалість/i.test(l) && l.includes(c.duration)), `тривалість ${c.duration}:\n${lines.join("\n")}`);
    }
    for (const amount of c.lines) {
      assert.ok(body.some((l) => endsWithAmount(l, amount)), `рядок із ${amount}:\n${lines.join("\n")}`);
    }
  });
}
