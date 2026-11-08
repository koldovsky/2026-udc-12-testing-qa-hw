// Автоматизація тест-кейсів TC-21…TC-26 з docs/test-cases.md (правило T5).
// Оракул очікувань — docs/test-cases.md і docs/spec/tariffs.md.

import test from "node:test";
import assert from "node:assert/strict";
import { formatReceipt } from "../../src/receipt.js";
import { quote } from "../../src/tariff.js";

const at = (time, date = "2026-09-16") => `${date}T${time}+03:00`;
const plus = (iso, minutes) => new Date(Date.parse(iso) + minutes * 60_000).toISOString();

const reduced = { type: "reduced" };
const subscriberWithConcession = { type: "subscriber", concession: true };

const cases = [
  {
    tc: "TC-21",
    rule: "T5",
    name: "пільговий, класичний, 40 хв → 2 блоки 5000 − 50 %",
    rider: reduced,
    bike: "classic",
    minutes: 40,
    timeCharge: 5000,
    fees: [],
    total: 2500,
  },
  {
    tc: "TC-22",
    rule: "T5",
    name: "пільговий, електровелосипед, 75 хв → 12000 − 50 %",
    rider: reduced,
    bike: "ebike",
    minutes: 75,
    timeCharge: 12000,
    fees: [],
    total: 6000,
  },
  {
    tc: "TC-23",
    rule: "T5 + T4",
    name: "абонент з правом на пільгу, класичний, 80 хв → застосовується менша сума: пільга 3750",
    rider: subscriberWithConcession,
    bike: "classic",
    minutes: 80,
    timeCharge: 7500,
    fees: [],
    total: 3750,
    fareDiscountCode: "reduced",
  },
  {
    tc: "TC-24",
    rule: "T5 + T4",
    name: "абонент з правом на пільгу, класичний, 100 хв → суми однакові (5000 і 5000), застосовується абонемент",
    rider: subscriberWithConcession,
    bike: "classic",
    minutes: 100,
    timeCharge: 10000,
    fees: [],
    total: 5000,
    fareDiscountCode: "subscription",
    receiptLine: "Знижка: абонемент",
  },
  {
    tc: "TC-25",
    rule: "T5 + T7",
    name: "пільговий, класичний, 20 хв, станція X01 → погодинне 1250 + збір 15000 без знижки",
    rider: reduced,
    bike: "classic",
    minutes: 20,
    returnStation: "X01",
    timeCharge: 2500,
    fees: [15000],
    total: 16250,
  },
  {
    tc: "TC-26",
    rule: "T5 + T6 + T8",
    name: "пільговий, класичний, 25 год → 62500 обмежено лімітом 30000 + збір T8 200000 без знижки",
    rider: reduced,
    bike: "classic",
    minutes: 25 * 60,
    timeCharge: 125000,
    fees: [200000],
    total: 230000,
  },
];

for (const c of cases) {
  test(`${c.rule} (${c.tc}): ${c.name}`, () => {
    const pickupAt = at("10:00:00");
    const result = quote(
      {
        pickupAt,
        returnAt: plus(pickupAt, c.minutes),
        bike: c.bike,
        returnStation: c.returnStation ?? "S01",
      },
      c.rider,
    );
    assert.equal(result.minutes, c.minutes, "тривалість у хвилинах");
    assert.equal(result.timeCharge, c.timeCharge, "нарахування за T3 до знижок");
    assert.deepEqual(
      result.fees.map((fee) => fee.amount).sort((a, b) => a - b),
      c.fees,
      "збори (пільга на них не поширюється)",
    );
    assert.equal(result.total, c.total, "до сплати");
    if (c.fareDiscountCode) {
      const applied = result.discounts.filter((d) => d.code === "subscription" || d.code === "reduced");
      assert.deepEqual(
        applied.map((d) => d.code),
        [c.fareDiscountCode],
        "у чеку — рядок саме того варіанта, що застосовано",
      );
    }
    if (c.receiptLine) {
      const lines = formatReceipt(result);
      assert.ok(
        lines.some((line) => line.startsWith(c.receiptLine)),
        `чек містить рядок «${c.receiptLine}»: ${lines.join(" | ")}`,
      );
    }
  });
}
