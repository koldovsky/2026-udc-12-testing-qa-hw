// Rounding and the receipt (T9).
// Cases and expected values: docs/test-cases.md, docs/spec/tariffs.md.
import test from "node:test";
import assert from "node:assert/strict";
import { formatReceipt } from "../../src/receipt.js";
import { discount, quote } from "../../src/tariff.js";

test("T9: TC-30 знижка 30 % від 1235 коп.: до сплати округлено вниз до 864 коп.", () => {
  const amount = discount(1235, 30);

  assert.equal(amount, 371);
  assert.equal(1235 - amount, 864);
});

// The specification fixes the amount format and the label «До сплати». It does not fix the
// other labels, the padding or the order of the fees, so rows compare the set of amounts.
const AMOUNT = /-?\d+(?: \d{3})*,\d{2} грн$/;

const RECEIPTS = [
  {
    id: "TC-31",
    name: "чек із лімітом і двома зборами",
    rider: { type: "standard" },
    returnAt: "2026-09-17T11:00:00+03:00",
    station: "X03",
    minutes: 1500,
    amounts: ["1 250,00 грн", "-950,00 грн", "150,00 грн", "2 000,00 грн", "2 450,00 грн"],
    due: "2 450,00 грн",
  },
  {
    id: "TC-32",
    name: "чек зі знижкою за пільгою",
    rider: { type: "reduced" },
    returnAt: "2026-09-16T10:40:00+03:00",
    station: "S01",
    minutes: 40,
    amounts: ["50,00 грн", "-25,00 грн", "25,00 грн"],
    due: "25,00 грн",
  },
];

for (const row of RECEIPTS) {
  test(`T9: ${row.id} ${row.name}`, () => {
    const ride = { pickupAt: "2026-09-16T10:00:00+03:00", returnAt: row.returnAt, bike: "classic", returnStation: row.station };

    const lines = formatReceipt(quote(ride, row.rider));

    assert.ok(
      lines.some((line) => line.includes(` ${row.minutes} хв`)),
      `no line with the duration of ${row.minutes} min: ${JSON.stringify(lines)}`,
    );
    const amounts = lines.map((line) => line.match(AMOUNT)?.[0]).filter(Boolean);
    assert.deepEqual(amounts.toSorted(), row.amounts.toSorted());
    assert.ok(lines.at(-1).startsWith("До сплати"), `the last line is not the amount due: "${lines.at(-1)}"`);
    assert.equal(lines.at(-1).match(AMOUNT)?.[0], row.due);
  });
}
