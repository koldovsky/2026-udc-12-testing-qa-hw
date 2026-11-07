// T9: the receipt has a separate line for each discount and for the daily cap, with a minus sign
// (docs/spec/tariffs.md:133-135). The test asserts no amount and no wording of these lines, and not
// whether a line belongs on the receipt when it reduces nothing: those are open questions Q-4 and
// Q-12 (docs/test-cases.md:162, 170). It asserts only that every discount or cap item of the quote
// gets a receipt line with a minus sign, and that the summary line «До сплати», the one wording the
// spec fixes (:135), has none, so a wrong minus there cannot stand in for a missing one on a discount
// line. Q-5 leaves the minus character open (docs/test-cases.md:163), so U+2212 and the ASCII hyphen
// both count.
import test from "node:test";
import assert from "node:assert/strict";
import { formatReceipt } from "../../src/receipt.js";
import { quote } from "../../src/tariff.js";

const MINUS_AMOUNT = /[−-]\d/;
const MINUTE = 60_000;

const rows = [
  // 01:10 in Kyiv (UTC+3 on 16.09.2026, docs/spec/tariffs.md:37): T10 applies (:141, 143)
  { case: "classic, 01:10 to 01:40: night discount", pickupAt: "2026-09-16T22:10:00Z", minutes: 30, rider: { type: "standard" } },
  // a false start at night: no time charge (:54), so no night discount to show
  { case: "classic, 01:10, 1 min: false start at night", pickupAt: "2026-09-16T22:10:00Z", minutes: 1, rider: { type: "standard" } },
  // 360 min is exactly the cap (:100-101), 361 min is over it
  { case: "classic, 360 min: exactly the cap", pickupAt: "2026-09-16T07:00:00Z", minutes: 360, rider: { type: "standard" } },
  { case: "classic, 361 min: over the cap", pickupAt: "2026-09-16T07:00:00Z", minutes: 361, rider: { type: "standard" } },
  { case: "concession, classic, 40 min", pickupAt: "2026-09-16T07:00:00Z", minutes: 40, rider: { type: "reduced" } },
  { case: "subscriber, e-bike, 30 min", pickupAt: "2026-09-16T07:00:00Z", minutes: 30, bike: "ebike", rider: { type: "subscriber" } },
];

for (const { case: name, pickupAt, minutes, bike = "classic", rider } of rows) {
  test(`T9: every discount and cap line of the receipt has a minus sign, ${name}`, () => {
    const ride = {
      pickupAt,
      returnAt: new Date(Date.parse(pickupAt) + minutes * MINUTE).toISOString(),
      bike,
      returnStation: "S03",
    };

    const result = quote(ride, rider);
    const lines = formatReceipt(result);

    const withMinus = lines.filter((line) => MINUS_AMOUNT.test(line));
    assert.equal(withMinus.length, result.discounts.length, `discounts ${JSON.stringify(result.discounts)}, receipt ${JSON.stringify(lines)}`);

    const due = lines.filter((line) => line.startsWith("До сплати "));
    assert.equal(due.length, 1, `receipt ${JSON.stringify(lines)}`);
    assert.doesNotMatch(due[0], MINUS_AMOUNT);
  });
}
