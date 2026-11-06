// T10: night discount. Rows follow docs/test-cases.md. Every ride here is fully inside or
// fully outside the window: rides across its edge are Q-1, a moment at 06:00 is Q-2.
import test from "node:test";
import { MINUTE, assertPrice, price } from "./support.js";

const NIGHT_RIDE = { pickupAt: "2026-09-16T22:10:00Z", returnAt: "2026-09-16T22:40:00Z" }; // TC-81

const rows = [
  { id: "TC-81", title: "classic, 01:10 to 01:40 is 2500 less 30 %", ride: NIGHT_RIDE, expected: { time: 1750 } },
  {
    id: "TC-82",
    title: "e-bike, 01:10 to 01:40 is 4000 less 30 %",
    ride: { ...NIGHT_RIDE, bike: "ebike" },
    expected: { time: 2800 },
  },
  {
    id: "TC-83",
    title: "00:00 to 00:30: the first moment of the window",
    ride: { pickupAt: "2026-09-16T21:00:00Z", returnAt: "2026-09-16T21:30:00Z" },
    expected: { time: 1750 },
  },
  {
    id: "TC-84",
    title: "05:29 to 05:59: the whole ride is before 06:00",
    ride: { pickupAt: "2026-09-17T02:29:00Z", returnAt: "2026-09-17T02:59:00Z" },
    expected: { time: 1750 },
  },
  {
    id: "TC-92",
    title: "06:01 to 06:31: the whole ride is after the window",
    ride: { pickupAt: "2026-09-16T03:01:00Z", returnAt: "2026-09-16T03:31:00Z" },
    expected: { time: 2500 },
  },
  {
    id: "TC-93",
    title: "23:29 to 23:59: the whole ride is before the window",
    ride: { pickupAt: "2026-09-16T20:29:00Z", returnAt: "2026-09-16T20:59:00Z" },
    expected: { time: 2500 },
  },
  {
    id: "TC-85",
    title: "05:10 to 05:40 in winter: Kyiv offset is +2, the ride is at night",
    ride: { pickupAt: "2026-12-16T03:10:00Z", returnAt: "2026-12-16T03:40:00Z" },
    expected: { time: 1750 },
  },
  {
    id: "TC-86",
    title: "07:00 to 07:30: night by UTC, day by Kyiv time",
    ride: { pickupAt: "2026-09-16T04:00:00Z", returnAt: "2026-09-16T04:30:00Z" },
    expected: { time: 2500 },
  },
  {
    id: "TC-87",
    title: "01:10 to 01:40, return X01: no discount on the fee",
    ride: { ...NIGHT_RIDE, returnStation: "X01" },
    expected: { time: 1750, fees: 15000, total: 16750 },
  },
  {
    id: "TC-88",
    title: "01:10, 1 min: the false start wins",
    ride: { pickupAt: NIGHT_RIDE.pickupAt, after: MINUTE },
    expected: { time: 0 },
  },
];

for (const { id, title, ride, expected } of rows) {
  test(`T10: ${id} ${title}`, () => {
    assertPrice(price(ride), expected);
  });
}
