// Builders for the spec tests (app/test/spec): rides in the shorthand of docs/test-cases.md.
// Expected values never come from here — only from docs/test-cases.md and docs/spec/tariffs.md.
import { createDayCap } from "../../src/day-cap.js";
import { quote } from "../../src/tariff.js";

export const DATE = "2026-09-16";
export const RIDER_ID = "rider-1";

export const RIDERS = Object.freeze({
  standard: { type: "standard" },
  reduced: { type: "reduced" },
  subscriber: { type: "subscriber" },
  subscriberConcession: { type: "subscriber", concession: true },
});

/** "10:00" / "10:00:40" on `date` in Kyiv summer time; a full ISO string is passed through. */
export function at(time, date = DATE) {
  if (time.includes("T")) return time;
  const hms = time.length === 5 ? `${time}:00` : time;
  return `${date}T${hms}+03:00`;
}

/**
 * A ledger with prior time charges: [{ rider?, day, amount }] — "нараховано за добу".
 * The charge is booked at noon of that Kyiv day.
 */
export function ledgerWith(charged = []) {
  const dayCap = createDayCap();
  for (const { rider = RIDER_ID, day = DATE, amount } of charged) {
    dayCap.record(rider, at("12:00", day), amount);
  }
  return dayCap;
}

/**
 * Quotes one row of a test table.
 * row: { from, to, fromDate?, toDate?, bike?, rider?, station?, riderId?, charged?, dayCap? }
 */
export function quoteRow(row) {
  const ride = {
    pickupAt: at(row.from, row.fromDate),
    returnAt: at(row.to, row.toDate ?? row.fromDate),
    bike: row.bike ?? "classic",
    returnStation: row.station ?? "S01",
  };
  const rider = { ...RIDERS[row.rider ?? "standard"], id: row.riderId ?? RIDER_ID };
  const dayCap = row.dayCap ?? ledgerWith(row.charged);
  return quote(ride, rider, { dayCap });
}
