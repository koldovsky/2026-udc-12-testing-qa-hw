import test from "node:test";
import assert from "node:assert/strict";
import { formatReceipt } from "../../src/receipt.js";
import { discount } from "../../src/tariff.js";
import { HOUR, MINUTE, quoteOf } from "./helpers.js";

// T9 — amounts in kopecks, rounding down
test("T9: TC-46 30 % off 1235 kopecks → 864 to pay, discount 371", () => {
  assert.equal(discount(1235, 30), 371);
  assert.equal(1235 - discount(1235, 30), 864);
});

test("T9: TC-47 receipt for a 25 h ride: the last line is «До сплати» ending with `2 300,00 грн`", () => {
  const last = formatReceipt(quoteOf(25 * HOUR)).at(-1);
  assert.ok(last.startsWith("До сплати"));
  assert.ok(last.endsWith("2 300,00 грн"));
});

test("T9: TC-48 receipt for the night ride 01:10–01:40: duration, time charge, discount, total", () => {
  const lines = formatReceipt(quoteOf(30 * MINUTE, { time: "01:10:00" }));
  assert.equal(lines.length, 4);
  assert.ok(lines[0].includes("30 хв"));
  assert.ok(lines[1].endsWith("25,00 грн"));
  assert.ok(lines[2].endsWith("-7,50 грн"));
  assert.ok(lines[3].startsWith("До сплати"));
  assert.ok(lines[3].endsWith("17,50 грн"));
});

test("T9: TC-49 receipt for 20 min out of zone: fee line 150,00 грн, last line «До сплати» 175,00 грн", () => {
  const lines = formatReceipt(quoteOf(20 * MINUTE, { station: "X01" }));
  assert.ok(lines.some((line) => line.endsWith("150,00 грн")));
  assert.ok(lines.at(-1).startsWith("До сплати"));
  assert.ok(lines.at(-1).endsWith("175,00 грн"));
});

// T10 — night discount 30 % for rides entirely within 00:00–06:00 (standard rider)
const t10 = [
  ["TC-50", "00:00–00:30 → 1750", "00:00:00", 30, "classic", 1750],
  ["TC-51", "06:00–06:30 → 2500", "06:00:00", 30, "classic", 2500],
  ["TC-52", "e-bike 01:00–02:15 → 12000 − 30 %", "01:00:00", 75, "ebike", 8400],
  ["TC-53", "01:10–01:40 → 1750", "01:10:00", 30, "classic", 1750],
];
for (const [id, name, time, minutes, bike, total] of t10) {
  test(`T10: ${id} ${name}`, () => {
    assert.equal(quoteOf(minutes * MINUTE, { time, bike }).total, total);
  });
}
