// Helpers for the spec-based tests: how to call quote(), nothing about expected values.
import { quote } from "../../src/tariff.js";

export const MINUTE = 60;
export const HOUR = 3600;

/** Kyiv wall-clock time in September 2026 is UTC+03:00. */
export const kyiv = (time, date = "2026-09-16") => `${date}T${time}+03:00`;

const plus = (pickupAt, seconds) => new Date(Date.parse(pickupAt) + seconds * 1000).toISOString();

/** A ride that starts at `time` (Kyiv) on `date` and lasts `seconds`. Defaults: classic, S01, 16.09, 10:00. */
export function ride(seconds, { time = "10:00:00", date = "2026-09-16", bike = "classic", station = "S01" } = {}) {
  const pickupAt = kyiv(time, date);
  return { pickupAt, returnAt: plus(pickupAt, seconds), bike, returnStation: station };
}

export const standard = { type: "standard" };
export const subscriber = { type: "subscriber" };
export const subscriberWithConcession = { type: "subscriber", concession: true };
export const reduced = { type: "reduced" };

export const quoteOf = (seconds, rideOptions, rider = standard) => quote(ride(seconds, rideOptions), rider);

/** Items of `discounts` / `fees` in a stable order, so a test can compare them exactly without depending on push order. */
export const byCode = (items) => [...items].sort((a, b) => a.code.localeCompare(b.code));
