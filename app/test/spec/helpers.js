// The notation of docs/test-cases.md («Позначення») for the tests in app/test/spec/.
// Expected values live in the test tables, taken from docs/test-cases.md; from app/src/ only
// how to call quote() / formatReceipt() / discount() and the shape of what they return.
import assert from "node:assert/strict";
import { createDayCap } from "../../src/day-cap.js";
import { quote } from "../../src/tariff.js";

// Fee codes in quote().fees.
export const OUT_OF_ZONE = "out-of-zone";
export const UNRETURNED = "unreturned";

// Rider categories: станд., пільг., абон., абон.+пільга.
export const STANDARD = { type: "standard" };
export const REDUCED = { type: "reduced" };
export const SUBSCRIBER = { type: "subscriber" };
export const SUBSCRIBER_REDUCED = { type: "subscriber", concession: true };

// Kyiv is at +03:00 until 2026-10-25 04:00 (= 01:00Z), at +02:00 after.
const SUMMER_TIME_ENDS = Date.UTC(2026, 9, 25, 1, 0, 0);
// Test-case dates are not earlier than 2026-09-15, when tariffs v3 took effect (docs/test-cases.md,
// «Дати»); an earlier moment, e.g. before the spring clock change, would get a wrong +03:00 here.
const V3_EFFECTIVE = Date.parse("2026-09-15T00:00:00+03:00");

/**
 * A moment as written in docs/test-cases.md: "16.09 10:00:00" is Kyiv time in 2026,
 * i.e. "2026-09-16T10:00:00+03:00". Moments written there in ISO 8601 are passed as is.
 */
export function at(moment) {
  if (moment.includes("T")) return moment;
  const match = /^(\d{2})\.(\d{2}) (\d{2}:\d{2}:\d{2})$/.exec(moment);
  if (!match) throw new Error(`unexpected moment: ${moment}`);
  const [, day, month, time] = match;
  const [hours, minutes, seconds] = time.split(":").map(Number);
  // Date.parse rolls an impossible day (31.09) or 24:00:00 over into the next day without an error,
  // and turns month 13 or minute 60 into NaN, which quote() would reject as invalid input — so an
  // invalid-input test could pass on a typo. Reject all of them here.
  if (
    Number(month) < 1 ||
    Number(month) > 12 ||
    new Date(Date.UTC(2026, Number(month) - 1, Number(day))).getUTCDate() !== Number(day) ||
    hours > 23 ||
    minutes > 59 ||
    seconds > 59
  ) {
    throw new Error(`${moment}: no such date or time in 2026`);
  }
  const iso = `2026-${month}-${day}T${time}+03:00`;
  if (Date.parse(iso) >= SUMMER_TIME_ENDS) {
    throw new Error(`${moment}: after the clock change write the moment in ISO 8601 with its offset`);
  }
  if (Date.parse(iso) < V3_EFFECTIVE) {
    throw new Error(`${moment}: test-case dates start at 15.09 (tariffs v3); write an earlier moment in ISO 8601`);
  }
  return iso;
}

/** A ride; the return station is S01 unless stated otherwise. */
export function ride(from, to, { bike = "classic", station = "S01" } = {}) {
  return { pickupAt: at(from), returnAt: at(to), bike, returnStation: station };
}

// Earlier rides of the same rider on the same Kyiv day (П1–П4) and their time charge.
export const PRIOR_RIDES = {
  P1: { ride: ride("16.09 08:00:00", "16.09 13:30:00"), rider: STANDARD, total: 27500 },
  P2: { ride: ride("16.09 07:00:00", "16.09 12:15:00"), rider: SUBSCRIBER, total: 22500 },
  P3: { ride: ride("16.09 08:00:00", "16.09 14:00:00"), rider: STANDARD, total: 30000 },
  P4: { ride: ride("2026-11-16T08:00:00+02:00", "2026-11-16T14:00:00+02:00"), rider: STANDARD, total: 30000 },
};

/**
 * Quote for a table row: `{ ride, rider = STANDARD, riderId, before }`.
 * `before` — earlier rides of the day: "P1", or `{ prior: "P3", riderId: "rider-A" }` for
 * another rider. With no earlier rides the day's charges are 0 and no ledger is needed.
 */
export function quoteRow({ ride: theRide, rider = STANDARD, riderId = "rider-1", before = [] }) {
  if (before.length === 0) return quote(theRide, rider);
  const dayCap = createDayCap();
  for (const entry of before) {
    const { prior, riderId: owner = riderId } = typeof entry === "string" ? { prior: entry } : entry;
    const earlier = PRIOR_RIDES[prior];
    const result = quote(earlier.ride, { ...earlier.rider, id: owner }, { dayCap });
    assert.equal(result.total, earlier.total, `precondition: earlier ride ${prior} of ${owner}`);
  }
  return quote(theRide, { ...rider, id: riderId }, { dayCap });
}

const byCode = ([a], [b]) => a.localeCompare(b);
const sumOf = (fees) => fees.reduce((sum, [, amount]) => sum + amount, 0);

/** What the rider pays: the time charge (after discounts and the cap), each fee, the total. */
export function amountDue(result) {
  const fees = result.fees.map(({ code, amount }) => [code, amount]).sort(byCode);
  return { hourly: result.total - sumOf(fees), fees, total: result.total };
}

/** The same shape from a test-case row: the total and the fees in brackets. */
export function expectedDue(total, fees = {}) {
  const entries = Object.entries(fees).sort(byCode);
  return { hourly: total - sumOf(entries), fees: entries, total };
}

// Receipt lines are found by the terms of the specification (T3–T10, `:133`–`:135`),
// not by exact labels: the labels, the filler and the order are not specified.
export const ABOUT = {
  duration: /тривалість/iu,
  hourly: /погодинн/iu,
  subscription: /абонемент/iu,
  reduced: /пільг/iu,
  night: /нічн/iu,
  dayCap: /ліміт/iu,
  outOfZone: /поза зон/iu,
  unreturned: /неповернен/iu,
  due: /до сплати/iu,
};

/** A receipt line with this amount; `amount` undefined — only the sign is checked. */
export const plusLine = (about, amount) => ({ about, minus: false, amount });
/** A discount or cap line: the minus sign ("-" or "−") and the amount. */
export const minusLine = (about, amount) => ({ about, minus: true, amount });

function onlyLine(lines, about) {
  const found = lines.filter((line) => about.test(line));
  assert.equal(found.length, 1, `exactly one receipt line ${about}; the receipt:\n${lines.join("\n")}`);
  return found[0];
}

/** The amount at the end of a line, "2 300,00 грн" format (T9), and whether it has a minus. */
function amountAtEnd(line) {
  const match = /(?:^|[^\d ])\s*([-−])?\s*(\d{1,3}(?: \d{3})*,\d{2} грн)\s*$/u.exec(line);
  assert.ok(match, `no amount in the "2 300,00 грн" format at the end of "${line}"`);
  return { minus: Boolean(match[1]), amount: match[2] };
}

/** Checks the receipt: the ride's duration, the listed lines, and the lines that must be absent. */
export function assertReceipt(lines, { duration, items = [], absent = [] }) {
  if (duration !== undefined) {
    assert.match(onlyLine(lines, ABOUT.duration), new RegExp(`(?:^|\\D)${duration} хв`, "u"));
  }
  for (const { about, minus, amount } of items) {
    const actual = amountAtEnd(onlyLine(lines, about));
    assert.deepEqual(
      amount === undefined ? { minus: actual.minus } : actual,
      amount === undefined ? { minus } : { minus, amount },
      `receipt line ${about}; the receipt:\n${lines.join("\n")}`,
    );
  }
  for (const about of absent) {
    assert.deepEqual(
      lines.filter((line) => about.test(line)),
      [],
      `no receipt line ${about}; the receipt:\n${lines.join("\n")}`,
    );
  }
}
