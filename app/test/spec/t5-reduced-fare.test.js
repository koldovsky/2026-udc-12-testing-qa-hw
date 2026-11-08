// T5 — пільговий тариф: docs/test-cases.md, TC-32…TC-42.
import test from "node:test";
import assert from "node:assert/strict";
import { formatReceipt } from "../../src/receipt.js";
import {
  ABOUT,
  amountDue,
  assertReceipt,
  expectedDue,
  minusLine,
  OUT_OF_ZONE,
  quoteRow,
  REDUCED,
  ride,
  SUBSCRIBER_REDUCED,
  UNRETURNED,
} from "./helpers.js";

const ebike = { bike: "ebike" };

const CASES = [
  { id: "TC-32", note: "пільг., клас., 40 хв → 2 блоки − 50 %", rider: REDUCED, ride: ride("16.09 10:00:00", "16.09 10:40:00"), total: 2500 },
  { id: "TC-33", note: "пільг., ел., 75 хв → 3 блоки − 50 %", rider: REDUCED, ride: ride("16.09 10:00:00", "16.09 11:15:00", ebike), total: 6000 },
  {
    id: "TC-34",
    note: "абон.+пільга, клас., 80 хв: абонемент 5000 > пільга 3750 → пільга",
    rider: SUBSCRIBER_REDUCED,
    ride: ride("16.09 10:00:00", "16.09 11:20:00"),
    total: 3750,
  },
  {
    id: "TC-35",
    note: "абон.+пільга, клас., 40 хв: абонемент 0 < пільга 2500 → абонемент",
    rider: SUBSCRIBER_REDUCED,
    ride: ride("16.09 10:00:00", "16.09 10:40:00"),
    total: 0,
  },
  {
    id: "TC-36",
    note: "абон.+пільга, клас., межа 60 хв: суми рівні → абонемент",
    rider: SUBSCRIBER_REDUCED,
    ride: ride("16.09 10:00:00", "16.09 11:00:00"),
    total: 2500,
  },
  {
    id: "TC-37",
    note: "абон.+пільга, клас., межа 75:00: абонемент 2500 < пільга 3750",
    rider: SUBSCRIBER_REDUCED,
    ride: ride("16.09 10:00:00", "16.09 11:15:00"),
    total: 2500,
  },
  {
    id: "TC-38",
    note: "абон.+пільга, клас., межа 75:01: абонемент 5000 > пільга 3750",
    rider: SUBSCRIBER_REDUCED,
    ride: ride("16.09 10:00:00", "16.09 11:15:01"),
    total: 3750,
  },
  {
    id: "TC-39",
    note: "абон.+пільга, ел., 75 хв: абонемент 9600 > пільга 6000, знижки не поєднуються",
    rider: SUBSCRIBER_REDUCED,
    ride: ride("16.09 10:00:00", "16.09 11:15:00", ebike),
    total: 6000,
  },
  {
    id: "TC-40",
    note: "пільг., клас., 20 хв, X03: збір T7 без знижки",
    rider: REDUCED,
    ride: ride("16.09 10:00:00", "16.09 10:20:00", { station: "X03" }),
    total: 16250,
    fees: { [OUT_OF_ZONE]: 15000 },
  },
  {
    id: "TC-41",
    note: "абон.+пільга, клас., 80 хв, X01: пільга, збір T7 без знижки",
    rider: SUBSCRIBER_REDUCED,
    ride: ride("16.09 10:00:00", "16.09 11:20:00", { station: "X01" }),
    total: 18750,
    fees: { [OUT_OF_ZONE]: 15000 },
  },
  {
    id: "TC-42",
    note: "пільг., ел., 25 год: ліміт 30000, збір T8 без знижки",
    rider: REDUCED,
    ride: ride("16.09 10:00:00", "17.09 11:00:00", ebike),
    total: 230000,
    fees: { [UNRETURNED]: 200000 },
  },
];

for (const row of CASES) {
  test(`T5: ${row.id} — ${row.note} → ${row.total}`, () => {
    assert.deepEqual(amountDue(quoteRow(row)), expectedDue(row.total, row.fees));
  });
}

test("T5: TC-36 — суми рівні: у чеку рядок знижки абонемента, рядка пільгової знижки немає", () => {
  const lines = formatReceipt(quoteRow({ rider: SUBSCRIBER_REDUCED, ride: ride("16.09 10:00:00", "16.09 11:00:00") }));
  assertReceipt(lines, { items: [minusLine(ABOUT.subscription)], absent: [ABOUT.reduced] });
});
