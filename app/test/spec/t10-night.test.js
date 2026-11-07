// T10 (нічна знижка 00:00–06:00) — docs/test-cases.md TC-62…TC-67.
// Поїздки, що лише частково припадають на ніч, і межа 06:00 — відкриті питання Q-1, Q-2:
// тут не автоматизуються.
import test from "node:test";
import { assertQuote, price, ride } from "../helpers/spec.js";

const at = (time) => `2026-09-17T${time}+03:00`;

const cases = [
  { id: "TC-62", title: "класичний, 01:10 → 01:40 — −30 %",
    ride: ride(at("01:10:00"), at("01:40:00")),
    expected: { minutes: 30, timeCharge: 2500, discounts: { night: 750 }, total: 1750 } },
  { id: "TC-63", title: "початок рівно о 00:00 — нічна",
    ride: ride(at("00:00:00"), at("00:20:00")),
    expected: { timeCharge: 2500, discounts: { night: 750 }, total: 1750 } },
  { id: "TC-64", title: "05:30:00 → 05:59:59 — уся поїздка до 06:00",
    ride: ride(at("05:30:00"), at("05:59:59")),
    expected: { minutes: 30, timeCharge: 2500, discounts: { night: 750 }, total: 1750 } },
  { id: "TC-65", title: "електро, 00:30 → 01:00 — −30 %",
    ride: ride(at("00:30:00"), at("01:00:00"), { bike: "ebike" }),
    expected: { timeCharge: 4000, discounts: { night: 1200 }, total: 2800 } },
  { id: "TC-66", title: "денна поїздка 12:00 → 12:20 — нічної знижки немає",
    ride: ride(at("12:00:00"), at("12:20:00")),
    expected: { discounts: { night: 0 }, total: 2500 } },
  { id: "TC-67", title: "взяття 06:00:01 — уся поїздка після 06:00, нічної знижки немає", ride: ride(at("06:00:01"), at("06:20:01")), expected: { minutes: 20, timeCharge: 2500, discounts: { night: 0 }, total: 2500 } },
];

for (const c of cases) {
  test(`T10: ${c.id} ${c.title}`, () => {
    assertQuote(price(c.ride), c.expected);
  });
}
