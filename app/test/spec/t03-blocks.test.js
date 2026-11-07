// T3 (погодинне нарахування блоками) — docs/test-cases.md TC-11…TC-16.
import test from "node:test";
import { assertQuote, price, ride } from "../helpers/spec.js";

const cases = [
  { id: "TC-11", title: "класичний, 50 хв — 2 блоки",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:50:00+03:00"),
    expected: { minutes: 50, timeCharge: 5000, total: 5000 } },
  { id: "TC-12", title: "електро, 75 хв — 3 блоки",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T11:15:00+03:00", { bike: "ebike" }),
    expected: { minutes: 75, timeCharge: 12000, total: 12000 } },
  { id: "TC-13", title: "класичний, 60 хв — 2 блоки",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T11:00:00+03:00"),
    expected: { minutes: 60, timeCharge: 5000, total: 5000 } },
  { id: "TC-14", title: "класичний, 61 хв — 3 блоки",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T11:01:00+03:00"),
    expected: { minutes: 61, timeCharge: 7500, total: 7500 } },
  { id: "TC-15", title: "електро, 30 хв — 1 блок",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:30:00+03:00", { bike: "ebike" }),
    expected: { minutes: 30, timeCharge: 4000, total: 4000 } },
  { id: "TC-16", title: "електро, 31 хв — 2 блоки",
    ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:31:00+03:00", { bike: "ebike" }),
    expected: { minutes: 31, timeCharge: 8000, total: 8000 } },
];

for (const c of cases) {
  test(`T3: ${c.id} ${c.title}`, () => {
    assertQuote(price(c.ride), c.expected);
  });
}
