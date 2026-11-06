// Shared setup for TC-41 and the tests that build on its state (TC-42…TC-45, TC-52, TC-65):
// a standard rider takes three 80-min e-bike rides on 16.09.2026 (09:00, 13:00, 18:00 Kyiv),
// all returned at S01, against one day-cap ledger. Expected totals stay in the tests.
import { createDayCap } from "../../src/day-cap.js";
import { quote } from "../../src/tariff.js";

const TC41_PICKUPS = [
  "2026-09-16T09:00:00+03:00",
  "2026-09-16T13:00:00+03:00",
  "2026-09-16T18:00:00+03:00",
];

// Returns the ledger, the rider and the quote of each of the three rides.
export function rideTC41(riderId) {
  const dayCap = createDayCap();
  const rider = { id: riderId, type: "standard" };
  const quotes = TC41_PICKUPS.map((pickupAt) => {
    const returnAt = new Date(Date.parse(pickupAt) + 80 * 60_000).toISOString();
    return quote({ pickupAt, returnAt, bike: "ebike", returnStation: "S01" }, rider, { dayCap });
  });
  return { dayCap, rider, quotes };
}
