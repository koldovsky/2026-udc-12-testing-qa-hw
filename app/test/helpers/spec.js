// Inputs for the spec tests (app/test/spec/): the typical values from docs/test-cases.md.
//
//   rider U1, category standard, classic bike, pickup 2026-09-16 10:00:00 Kyiv time,
//   return station S01 (in the zone), no time charges for the rider on that day before.
//   In September Kyiv is UTC+03:00.

export const DAY = "2026-09-16";
const KYIV_SEPTEMBER_OFFSET = "+03:00";
const MINUTE = 60_000;

/** Kyiv wall-clock time in September as an ISO instant: kyiv("10:12:40"), kyiv("11:00", "2026-09-17"). */
export function kyiv(time, date = DAY) {
  const hms = time.length === 5 ? `${time}:00` : time;
  return `${date}T${hms}${KYIV_SEPTEMBER_OFFSET}`;
}

/**
 * A ride with the typical values overridden.
 *   from / to       Kyiv times on DAY (to may be on toDate)
 *   minutes         the return exactly N min 00 s after the pickup (instead of `to`)
 *   pickupAt / returnAt   raw ISO instants (override from / to)
 */
export function ride({
  from = "10:00",
  to,
  toDate = DAY,
  minutes,
  pickupAt,
  returnAt,
  bike = "classic",
  station = "S01",
} = {}) {
  const start = pickupAt ?? kyiv(from);
  let end = returnAt ?? (to === undefined ? undefined : kyiv(to, toDate));
  if (end === undefined) {
    if (minutes === undefined) throw new Error("ride(): give `to`, `minutes` or `returnAt`");
    end = new Date(Date.parse(start) + minutes * MINUTE).toISOString();
  }
  return { pickupAt: start, returnAt: end, bike, returnStation: station };
}

const CATEGORIES = {
  standard: { type: "standard" },
  reduced: { type: "reduced" },
  subscriber: { type: "subscriber" },
  "subscriber+concession": { type: "subscriber", concession: true },
};

/** A rider of a category from the spec (§2): standard, reduced, subscriber (with or without concession). */
export function rider(category = "standard", id = "U1") {
  if (!Object.hasOwn(CATEGORIES, category)) throw new Error(`rider(): unknown category ${category}`);
  return { id, ...CATEGORIES[category] };
}
