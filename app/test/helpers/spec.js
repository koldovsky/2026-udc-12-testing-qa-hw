// Helpers for the spec-driven tests (app/test/spec): build a ride, run a quote, prefill the daily cap.

import { createDayCap } from "../../src/day-cap.js";
import { quote } from "../../src/tariff.js";

export const RIDERS = {
  standard: { type: "standard" },
  reduced: { type: "reduced" },
  subscriber: { type: "subscriber" },
  subscriberReduced: { type: "subscriber", concession: true },
};

/** A Kyiv wall-clock instant in September 2026 (summer time, UTC+3). */
export const at = (day, time) => `2026-09-${String(day).padStart(2, "0")}T${time}+03:00`;

/**
 * Runs one quote. `prior` (kopecks) is what the rider was already charged on the ride's day;
 * it is booked into the ledger at `priorAt` (default: the ride's own pickup instant).
 */
export function run({ bike = "classic", rider = "standard", from, to, station = "S01", prior, priorAt }) {
  const ride = { pickupAt: from, returnAt: to, bike, returnStation: station };
  if (prior === undefined) return quote(ride, RIDERS[rider]);
  const dayCap = createDayCap();
  dayCap.record("u1", priorAt ?? from, prior);
  return quote(ride, { ...RIDERS[rider], id: "u1" }, { dayCap });
}
