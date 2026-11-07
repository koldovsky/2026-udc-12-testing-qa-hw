// T4 (абонемент) і T5 (пільговий тариф) — docs/test-cases.md TC-17…TC-32.
import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap } from "../../src/day-cap.js";
import {
  REDUCED,
  SUBSCRIBER,
  SUBSCRIBER_CONCESSION,
  assertQuote,
  price,
  ride,
} from "../helpers/spec.js";

const at = (time) => `2026-09-16T${time}+03:00`;

const cases = [
  // T4: абонент без права на пільгу
  { id: "TC-17", rule: "T4", title: "абонент, класичний, 40 хв — безкоштовно",
    rider: SUBSCRIBER, ride: ride(at("10:00:00"), at("10:40:00")),
    expected: { total: 0 } },
  { id: "TC-18", rule: "T4", title: "абонент, класичний, рівно 45 хв — безкоштовно",
    rider: SUBSCRIBER, ride: ride(at("10:00:00"), at("10:45:00")),
    expected: { total: 0 } },
  { id: "TC-19", rule: "T4", title: "абонент, класичний, 46 хв — 1 платна хвилина, 1 блок",
    rider: SUBSCRIBER, ride: ride(at("10:00:00"), at("10:46:00")),
    expected: { total: 2500 } },
  { id: "TC-20", rule: "T4", title: "абонент, класичний, 75 хв — 30 платних, 1 блок",
    rider: SUBSCRIBER, ride: ride(at("10:00:00"), at("11:15:00")),
    expected: { total: 2500 } },
  { id: "TC-21", rule: "T4", title: "абонент, класичний, 76 хв — 31 платна, 2 блоки",
    rider: SUBSCRIBER, ride: ride(at("10:00:00"), at("11:16:00")),
    expected: { total: 5000 } },
  { id: "TC-22", rule: "T4", title: "абонент, класичний, 100 хв — 55 платних, 2 блоки",
    rider: SUBSCRIBER, ride: ride(at("10:00:00"), at("11:40:00")),
    expected: { total: 5000 } },
  { id: "TC-23", rule: "T4", title: "абонент, електро, 30 хв — −20 %",
    rider: SUBSCRIBER, ride: ride(at("10:00:00"), at("10:30:00"), { bike: "ebike" }),
    expected: { timeCharge: 4000, discounts: { subscription: 800 }, total: 3200 } },
  { id: "TC-24", rule: "T4", title: "абонент, електро, 45 хв — безкоштовних хвилин немає, −20 %",
    rider: SUBSCRIBER, ride: ride(at("10:00:00"), at("10:45:00"), { bike: "ebike" }),
    expected: { minutes: 45, timeCharge: 8000, discounts: { subscription: 1600 }, total: 6400 } },
  { id: "TC-68", rule: "T4", title: "абонент, електро, 31 хв — 2 блоки −20 % (без безкоштовних хвилин)", rider: SUBSCRIBER, ride: ride(at("10:00:00"), at("10:31:00"), { bike: "ebike" }), expected: { minutes: 31, timeCharge: 8000, discounts: { subscription: 1600 }, total: 6400 } },

  // T5: пільговий; абонент з правом на пільгу
  { id: "TC-26", rule: "T5", title: "пільговий, класичний, 40 хв — −50 %",
    rider: REDUCED, ride: ride(at("10:00:00"), at("10:40:00")),
    expected: { timeCharge: 5000, discounts: { reduced: 2500 }, total: 2500 } },
  { id: "TC-27", rule: "T5", title: "пільговий, електро, 75 хв — −50 %",
    rider: REDUCED, ride: ride(at("10:00:00"), at("11:15:00"), { bike: "ebike" }),
    expected: { timeCharge: 12000, discounts: { reduced: 6000 }, total: 6000 } },
  { id: "TC-28", rule: "T5", title: "абонент з пільгою, класичний, 80 хв — пільга вигідніша",
    rider: SUBSCRIBER_CONCESSION, ride: ride(at("10:00:00"), at("11:20:00")),
    expected: { timeCharge: 7500, plan: "reduced", total: 3750 } },
  { id: "TC-29", rule: "T5", title: "абонент з пільгою, класичний, 40 хв — абонемент вигідніший",
    rider: SUBSCRIBER_CONCESSION, ride: ride(at("10:00:00"), at("10:40:00")),
    expected: { plan: "subscription", total: 0 } },
  { id: "TC-30", rule: "T5", title: "абонент з пільгою, класичний, 60 хв — суми рівні → абонемент",
    rider: SUBSCRIBER_CONCESSION, ride: ride(at("10:00:00"), at("11:00:00")),
    expected: { plan: "subscription", total: 2500 } },
  { id: "TC-31", rule: "T5 (+T7)", title: "абонент з пільгою, електро, 30 хв, X03 — пільга, збір без знижки",
    rider: SUBSCRIBER_CONCESSION, ride: ride(at("10:00:00"), at("10:30:00"), { bike: "ebike", station: "X03" }),
    expected: { timeCharge: 4000, plan: "reduced", hourly: 2000, fees: 15000, total: 17000 } },
  { id: "TC-32", rule: "T5 (+T7)", title: "абонент з пільгою, класичний, 30 хв, X01 — порівнюється лише погодинне",
    rider: SUBSCRIBER_CONCESSION, ride: ride(at("10:00:00"), at("10:30:00"), { station: "X01" }),
    expected: { plan: "subscription", hourly: 0, fees: 15000, total: 15000 } },
];

for (const c of cases) {
  test(`${c.rule}: ${c.id} ${c.title}`, () => {
    assertQuote(price(c.ride, c.rider), c.expected);
  });
}

test("T4: TC-25 45 безкоштовних хвилин діють на кожну поїздку, а не на добу", () => {
  const ledger = createDayCap();
  const first = price(ride(at("10:00:00"), at("10:40:00")), SUBSCRIBER, { ledger });
  const second = price(ride(at("11:00:00"), at("11:40:00")), SUBSCRIBER, { ledger });
  assert.equal(first.total, 0, "перша поїздка, коп.");
  assert.equal(second.total, 0, "друга поїздка, коп.");
});
