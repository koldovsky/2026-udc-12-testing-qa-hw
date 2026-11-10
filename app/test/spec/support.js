// Shared vocabulary for the spec tests (app/test/spec/*.test.js).
// Expected values never come from here — only the notation of docs/test-cases.md
// («Умовні позначення») translated into the call format of src/tariff.js.

import assert from "node:assert/strict";
import { createDayCap } from "../../src/day-cap.js";
import { QuoteError, quote } from "../../src/tariff.js";

// Riders: Ст, Піл, Аб, Аб+П.
export const ST = Object.freeze({ type: "standard" });
export const PIL = Object.freeze({ type: "reduced" });
export const AB = Object.freeze({ type: "subscriber" });
export const AB_P = Object.freeze({ type: "subscriber", concession: true });

// Bikes: Кл, Ел.
export const KL = "classic";
export const EL = "ebike";

const DEFAULT_DATE = "2026-09-16";
const DEFAULT_OFFSET = "+03:00";

/**
 * A moment in the notation of docs/test-cases.md:
 *   "10:00:00"           → 2026-09-16T10:00:00+03:00
 *   "09:00"              → 2026-09-16T09:00:00+03:00
 *   "17.09 11:00:00"     → 2026-09-17T11:00:00+03:00
 *   full ISO 8601 string → as is
 */
export function at(moment) {
  if (moment.includes("T")) return moment;
  let date = DEFAULT_DATE;
  let time = moment;
  const withDate = /^(\d{2})\.(\d{2}) (.+)$/.exec(moment);
  if (withDate) {
    date = `2026-${withDate[2]}-${withDate[1]}`;
    time = withDate[3];
  }
  if (/^\d{2}:\d{2}$/.test(time)) time += ":00";
  return `${date}T${time}${DEFAULT_OFFSET}`;
}

export function ride({ bike = KL, from, to, station = "S01" }) {
  return { pickupAt: at(from), returnAt: at(to), bike, returnStation: station };
}

/** Quote for one ride of one rider, as in a single row of docs/test-cases.md. */
export function quoteRow(row) {
  return quote(ride(row), row.rider ?? ST);
}

/**
 * Quotes for a «Сценарій»: rides of the same rider (or of the riders named in each step)
 * against one daily-cap ledger, in pickup order. Returns the quotes.
 */
export function quoteScenario(steps) {
  const ledger = createDayCap();
  return steps.map((step) => {
    const rider = { ...(step.rider ?? ST), id: step.riderId ?? "rider-A" };
    return quote(ride(step), rider, { dayCap: ledger });
  });
}

/** Розд. 4: the calculation is refused with a non-empty explanation. */
export function assertRefused(fn) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof QuoteError, `expected a QuoteError, got ${err?.name}: ${err?.message}`);
    assert.equal(typeof err.message, "string");
    assert.ok(err.message.trim().length > 0, "the refusal has no explanation");
    return true;
  });
}

export const codes = (items) => items.map((item) => item.code);

/**
 * Checks a quote against one table row. Only the fields the row sets are checked:
 *   total    — «До сплати», kopecks
 *   minutes  — duration by T1
 *   plan     — "subscription" | "reduced": which of T4 / T5 was applied (the other is not)
 *   capLine  — amount of the day-cap line (T6), or null when there must be no such line
 */
export function assertQuote(result, row) {
  if (row.minutes !== undefined) assert.equal(result.minutes, row.minutes, "minutes (T1)");
  if (row.plan !== undefined) {
    const applied = codes(result.discounts);
    const other = row.plan === "subscription" ? "reduced" : "subscription";
    assert.ok(applied.includes(row.plan), `expected the ${row.plan} discount, got [${applied}]`);
    assert.ok(!applied.includes(other), `the ${other} discount must not be applied, got [${applied}]`);
  }
  if (row.capLine !== undefined) {
    const cap = result.discounts.find((item) => item.code === "day-cap");
    if (row.capLine === null) assert.equal(cap, undefined, "there must be no day-cap line");
    else assert.equal(cap?.amount, row.capLine, "day-cap line");
  }
  assert.equal(result.total, row.total, "total");
}

const RIDER_LABELS = new Map([
  [ST, "Ст"],
  [PIL, "Піл"],
  [AB, "Аб"],
  [AB_P, "Аб+П"],
]);
const BIKE_LABELS = { [KL]: "Кл", [EL]: "Ел" };

/** A row in the notation of docs/test-cases.md, for the test name: «Ст · Кл · 10:00 → 10:30 · X01». */
export function label(row) {
  const rider = RIDER_LABELS.get(row.rider ?? ST);
  const bike = BIKE_LABELS[row.bike ?? KL];
  const station = row.station && row.station !== "S01" ? ` · ${row.station}` : "";
  return `${rider} · ${bike} · ${row.from} → ${row.to}${station}`;
}

/** «TC-41: Ст · Ел · 09:00 → 10:20; …» for a scenario. */
export function scenarioLabel(steps) {
  return steps.map((step) => (step.riderId ? `${step.riderId}: ` : "") + label(step)).join("; ");
}
