import test from "node:test";
import assert from "node:assert/strict";
import { formatReceipt } from "../../src/receipt.js";
import { discount } from "../../src/tariff.js";
import { HOUR, MINUTE, quoteOf } from "./helpers.js";

// T9 — amounts in whole kopecks, the amount due rounded down (docs/spec/tariffs.md:129-130; example :137).
test("T9: TC-46 30 % off 1235 kopecks → 864 to pay, discount 371", () => {
  assert.equal(discount(1235, 30), 371);
  assert.equal(1235 - discount(1235, 30), 864);
});

// T9 receipt (docs/spec/tariffs.md:132-135): amounts in UAH with two decimals, decimal comma, a space between
// thousands («2 300,00 грн»), a minus sign on discounts and the cap, a line per item, the last line «До сплати».
// The spec fixes the amounts, the sign, the order of items and the «До сплати» label — not the other labels or the
// dot leader, so each line is matched whole: <label> <dots> <exact amount>, nothing after it.
const line = (amount, label = "[^.\\d]+?") => new RegExp(`^${label} \\.{3,} ${amount.replace(/\s/g, "\\s")}$`);

// :124-125, :133-135 — 25 h: duration 1500 min, T3 1250 грн, cap −950 грн, T8 fee 2000 грн, due 2300 грн.
test("T9: TC-47 receipt for a 25 h ride: the last line is «До сплати» ending with `2 300,00 грн`", () => {
  const lines = formatReceipt(quoteOf(25 * HOUR));
  assert.equal(lines.length, 5);
  assert.match(lines[0], /^[^\d]+ 1500 хв$/);
  assert.match(lines[1], line("1 250,00 грн"));
  assert.match(lines[2], line("-950,00 грн"));
  assert.match(lines[3], line("2 000,00 грн"));
  assert.match(lines[4], line("2 300,00 грн", "До сплати"));
});

// :133-135, :143 — night ride 01:10–01:40: 30 min, T3 25 грн, night −7,50 грн, due 17,50 грн.
test("T9: TC-48 receipt for the night ride 01:10–01:40: duration, time charge, discount, total", () => {
  const lines = formatReceipt(quoteOf(30 * MINUTE, { time: "01:10:00" }));
  assert.equal(lines.length, 4);
  assert.match(lines[0], /^[^\d]+ 30 хв$/);
  assert.match(lines[1], line("25,00 грн"));
  assert.match(lines[2], line("-7,50 грн"));
  assert.match(lines[3], line("17,50 грн", "До сплати"));
});

// :114-115, :133-135 — 20 min to X01: 20 min, T3 25 грн, T7 fee 150 грн, due 175 грн.
test("T9: TC-49 receipt for 20 min out of zone: fee line 150,00 грн, last line «До сплати» 175,00 грн", () => {
  const lines = formatReceipt(quoteOf(20 * MINUTE, { station: "X01" }));
  assert.equal(lines.length, 4);
  assert.match(lines[0], /^[^\d]+ 20 хв$/);
  assert.match(lines[1], line("25,00 грн"));
  assert.match(lines[2], line("150,00 грн"));
  assert.match(lines[3], line("175,00 грн", "До сплати"));
});

// T10 — night rides 00:00–06:00 get 30 % off the time charge (docs/spec/tariffs.md:141; example :143).
// Only rides that lie entirely inside 00:00–06:00 or entirely outside it, standard rider — the rest is Q-1/Q-2.
const t10 = [
  ["TC-50", "00:00–00:30 → 1750", "00:00:00", 30, "classic", 2500, [{ code: "night", amount: 750 }], 1750], // :141
  ["TC-51", "06:00–06:30 → 2500", "06:00:00", 30, "classic", 2500, [], 2500], // :141 «до 06:00»
  ["TC-52", "e-bike 01:00–02:15 → 12000 − 30 %", "01:00:00", 75, "ebike", 12000, [{ code: "night", amount: 3600 }], 8400], // :141, :70
  ["TC-53", "01:10–01:40 → 1750", "01:10:00", 30, "classic", 2500, [{ code: "night", amount: 750 }], 1750], // :143
];
for (const [id, name, time, minutes, bike, timeCharge, discounts, total] of t10) {
  test(`T10: ${id} ${name}`, () => {
    const result = quoteOf(minutes * MINUTE, { time, bike });
    assert.equal(result.timeCharge, timeCharge);
    assert.deepEqual(result.discounts, discounts);
    assert.equal(result.total, total);
  });
}
