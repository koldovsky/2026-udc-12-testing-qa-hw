// T2: false start. Rows follow docs/test-cases.md.
import test from "node:test";
import { MINUTE, SECOND, assertPrice, price, standard, subscriber } from "./support.js";

const rows = [
  { id: "TC-11", title: "50 s is 1 min, no time charge", ride: { after: 50 * SECOND }, expected: { minutes: 1, time: 0 } },
  { id: "TC-12", title: "2 min 00 s, no time charge", ride: { after: 2 * MINUTE }, expected: { minutes: 2, time: 0 } },
  {
    id: "TC-13",
    title: "2 min 01 s is 3 min, 1 block",
    ride: { after: 2 * MINUTE + SECOND },
    expected: { minutes: 3, time: 2500 },
  },
  { id: "TC-14", title: "4 min is 1 block", ride: { after: 4 * MINUTE }, expected: { time: 2500 } },
  { id: "TC-15", title: "e-bike, 2 min, no time charge", ride: { after: 2 * MINUTE, bike: "ebike" }, expected: { time: 0 } },
  {
    id: "TC-16",
    title: "1 min returned at X01 still pays the T7 fee",
    ride: { after: MINUTE, returnStation: "X01" },
    expected: { time: 0, fees: 15000, total: 15000 },
  },
  {
    id: "TC-90",
    title: "subscriber, e-bike, 2 min, nothing to discount",
    ride: { after: 2 * MINUTE, bike: "ebike" },
    rider: subscriber,
    expected: { time: 0 },
  },
];

for (const { id, title, ride, rider = standard, expected } of rows) {
  test(`T2: ${id} ${title}`, () => {
    assertPrice(price(ride, rider), expected);
  });
}
