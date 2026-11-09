// T6: daily cap. Rows follow docs/test-cases.md.
import test from "node:test";
import { createDayCap } from "../../src/day-cap.js";
import {
  MINUTE,
  TC45_RIDES,
  assertPrice,
  atCap,
  concession,
  ebike80,
  ledgerAfter,
  price,
  standard,
  subscriber,
} from "./support.js";

// TC-53: 29000 on 16.09, then a ride from 23:40 to 00:20 on 17.09.
const TC53_EARLIER_RIDES = [
  ebike80("2026-09-16T06:00:00Z"),
  ebike80("2026-09-16T10:00:00Z"),
  { pickupAt: "2026-09-16T15:00:00Z", after: 50 * MINUTE },
];
const TC53_RIDE = { pickupAt: "2026-09-16T20:40:00Z", returnAt: "2026-09-16T21:20:00Z" };

const rows = [
  {
    id: "TC-46",
    title: "at cap, classic, 30 min: the full price is reduced by the cap",
    ledger: atCap,
    ride: { pickupAt: "2026-09-16T18:00:00Z", after: 30 * MINUTE },
    expected: { t3: 2500, time: 0, capReduction: 2500 },
  },
  {
    id: "TC-47",
    title: "classic, 360 min is exactly the cap: no reduction",
    ride: { after: 360 * MINUTE },
    expected: { time: 30000, capReduction: 0 },
  },
  {
    id: "TC-48",
    title: "classic, 361 min is 13 blocks: reduced to the cap",
    ride: { after: 361 * MINUTE },
    expected: { t3: 32500, time: 30000, capReduction: 2500 },
  },
  {
    id: "TC-49",
    title: "e-bike, 00:10 to 05:50: the cap applies after the night discount",
    ride: { pickupAt: "2026-09-16T21:10:00Z", returnAt: "2026-09-17T02:50:00Z", bike: "ebike" },
    expected: { minutes: 340, t3: 48000, time: 30000, capReduction: 3600 },
  },
  {
    id: "TC-50",
    title: "at cap on 16.09, ride on 17.09: new day, new cap",
    ledger: atCap,
    ride: { pickupAt: "2026-09-17T07:00:00Z", after: 30 * MINUTE },
    expected: { time: 2500 },
  },
  {
    id: "TC-51",
    title: "at cap on 16.09, pickup 00:30 on 17.09: the Kyiv date decides, not the UTC date",
    ledger: atCap,
    ride: { pickupAt: "2026-09-16T21:30:00Z", returnAt: "2026-09-16T22:00:00Z" },
    expected: { time: 1750 },
  },
  {
    id: "TC-52",
    title: "at cap on 16.09, pickup 23:59:59: the last second still counts towards 16.09",
    ledger: atCap,
    ride: { pickupAt: "2026-09-16T20:59:59Z", after: 30 * MINUTE },
    expected: { time: 0 },
  },
  {
    id: "TC-97",
    title: "at cap on 16.09, pickup 00:00:00 on 17.09: the first moment of a new day",
    ledger: atCap,
    ride: { pickupAt: "2026-09-16T21:00:00Z", returnAt: "2026-09-16T21:30:00Z" },
    expected: { time: 1750 },
  },
  {
    id: "TC-53",
    title: "a ride from 23:40 to 00:20 counts towards the pickup day: the rest of its cap",
    ledger: () => ledgerAfter(TC53_EARLIER_RIDES, 29000),
    ride: TC53_RIDE,
    expected: { time: 1000 },
  },
  {
    id: "TC-54",
    title: "nothing from the ride of TC-53 counts towards 17.09",
    ledger: () => ledgerAfter([...TC53_EARLIER_RIDES, TC53_RIDE], 30000),
    ride: { pickupAt: "2026-09-17T07:00:00Z", after: 360 * MINUTE },
    expected: { time: 30000, capReduction: 0 },
  },
  {
    id: "TC-55",
    title: "R1 at cap does not limit R2: the cap is per rider",
    ledger: atCap,
    ride: { pickupAt: "2026-09-16T18:00:00Z", after: 30 * MINUTE },
    rider: { id: "R2", type: "standard" },
    expected: { time: 2500 },
  },
  {
    id: "TC-94",
    title: "subscriber, e-bike, 300 min: the cap applies after 20 % off",
    ride: { after: 300 * MINUTE, bike: "ebike" },
    rider: subscriber,
    expected: { t3: 40000, time: 30000, capReduction: 2000 },
  },
  {
    id: "TC-58",
    title: "at cap, 20 min, return X01: the cap does not limit fees",
    ledger: atCap,
    ride: { pickupAt: "2026-09-16T18:00:00Z", after: 20 * MINUTE, returnStation: "X01" },
    expected: { time: 0, fees: 15000, total: 15000 },
  },
];

for (const { id, title, ledger = createDayCap, ride, rider = standard, expected } of rows) {
  test(`T6: ${id} ${title}`, () => {
    assertPrice(price(ride, rider, ledger()), expected);
  });
}

const dayRows = [
  {
    id: "TC-45",
    title: "three e-bike rides of 80 min: the third gets what is left of the cap",
    rides: TC45_RIDES,
    expected: [{ time: 12000 }, { time: 12000 }, { time: 6000 }],
  },
  {
    id: "TC-56",
    title: "concession, four e-bike rides of 80 min: the cap counts amounts after discounts",
    rider: concession,
    rides: [
      ebike80("2026-09-16T06:00:00Z"),
      ebike80("2026-09-16T08:00:00Z"),
      ebike80("2026-09-16T10:00:00Z"),
      ebike80("2026-09-16T12:00:00Z"),
    ],
    expected: [{ time: 6000 }, { time: 6000 }, { time: 6000 }, { time: 6000 }],
  },
  {
    id: "TC-57",
    title: "the fee of the first ride does not use up the cap",
    rides: [
      { pickupAt: "2026-09-16T06:00:00Z", after: 20 * MINUTE, returnStation: "X01" },
      ebike80("2026-09-16T07:00:00Z"),
      ebike80("2026-09-16T10:00:00Z"),
      ebike80("2026-09-16T15:00:00Z"),
    ],
    expected: [
      { time: 2500, fees: 15000 },
      { time: 12000, fees: 0 },
      { time: 12000, fees: 0 },
      { time: 3500, fees: 0 },
    ],
  },
];

for (const { id, title, rider = standard, rides, expected } of dayRows) {
  test(`T6: ${id} ${title}`, () => {
    const dayCap = createDayCap();
    rides.forEach((ride, index) => {
      assertPrice(price(ride, rider, dayCap), expected[index]);
    });
  });
}
