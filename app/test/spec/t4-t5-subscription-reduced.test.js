// docs/test-cases.md TC-16…TC-30 — T4 (subscription), T5 (reduced fare).
// Expectations: docs/test-cases.md, docs/spec/tariffs.md:72-96 (+ T7 :112, T8 :120, T6 :101).

import test from "node:test";
import assert from "node:assert/strict";
import { quote } from "../../src/tariff.js";
import { ride, rider } from "../helpers/spec.js";

const CASES = [
  { id: "TC-16", rules: "T4", rider: "subscriber", desc: "абонент, 40 хв", ride: { minutes: 40 }, total: 0 },
  { id: "TC-17", rules: "T4", rider: "subscriber", desc: "абонент, 100 хв", ride: { minutes: 100 }, total: 5000 },
  { id: "TC-18", rules: "T4", rider: "subscriber", desc: "абонент, 45 хв", ride: { minutes: 45 }, total: 0 },
  { id: "TC-19", rules: "T4", rider: "subscriber", desc: "абонент, 46 хв", ride: { minutes: 46 }, total: 2500 },
  { id: "TC-20", rules: "T4", rider: "subscriber", desc: "абонент, 75 хв", ride: { minutes: 75 }, total: 2500 },
  { id: "TC-21", rules: "T4", rider: "subscriber", desc: "абонент, 76 хв", ride: { minutes: 76 }, total: 5000 },
  {
    id: "TC-22",
    rules: "T4",
    rider: "subscriber",
    desc: "абонент, електровелосипед, 30 хв",
    ride: { minutes: 30, bike: "ebike" },
    total: 3200,
  },
  {
    id: "TC-23",
    rules: "T4",
    rider: "subscriber",
    desc: "абонент, електровелосипед, 45 хв",
    ride: { minutes: 45, bike: "ebike" },
    total: 6400,
  },
  { id: "TC-24", rules: "T5", rider: "reduced", desc: "пільговий, 40 хв", ride: { minutes: 40 }, total: 2500 },
  {
    id: "TC-25",
    rules: "T5",
    rider: "reduced",
    desc: "пільговий, електровелосипед, 30 хв",
    ride: { minutes: 30, bike: "ebike" },
    total: 2000,
  },
  {
    id: "TC-26",
    rules: "T5",
    rider: "subscriber+concession",
    desc: "абонент із правом на пільгу, 80 хв",
    ride: { minutes: 80 },
    total: 3750,
  },
  {
    id: "TC-27",
    rules: "T5",
    rider: "subscriber+concession",
    desc: "абонент із правом на пільгу, 40 хв",
    ride: { minutes: 40 },
    total: 0,
  },
  {
    id: "TC-28",
    rules: "T5",
    rider: "subscriber+concession",
    desc: "абонент із правом на пільгу, 100 хв",
    ride: { minutes: 100 },
    total: 5000,
  },
  {
    id: "TC-29",
    rules: "T5, T7",
    rider: "reduced",
    desc: "пільговий, 20 хв, станція X01 (збір без пільги)",
    ride: { minutes: 20, station: "X01" },
    total: 16250,
  },
  {
    id: "TC-30",
    rules: "T5, T8",
    rider: "reduced",
    desc: "пільговий, 16.09 10:00 → 17.09 11:00 (25 год, збір без пільги)",
    ride: { from: "10:00", to: "11:00", toDate: "2026-09-17" },
    total: 230000,
  },
];

for (const c of CASES) {
  test(`${c.rules}: ${c.id} — ${c.desc} → до сплати ${c.total}`, () => {
    const result = quote(ride(c.ride), rider(c.rider));
    assert.equal(result.total, c.total);
  });
}

test("T5: TC-28 — абонент із правом на пільгу, 100 хв, суми рівні → застосовано абонемент, не пільгу", () => {
  const result = quote(ride({ minutes: 100 }), rider("subscriber+concession"));
  const codes = result.discounts.map((d) => d.code);
  assert.ok(codes.includes("subscription"), `очікували знижку абонемента, є: ${JSON.stringify(codes)}`);
  assert.ok(!codes.includes("reduced"), `пільга не мала застосовуватися, є: ${JSON.stringify(codes)}`);
});
