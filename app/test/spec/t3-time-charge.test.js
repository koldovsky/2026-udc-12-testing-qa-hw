// T3: time charge per started 30 min. Rows follow docs/test-cases.md.
import test from "node:test";
import { MINUTE, assertPrice, assertRejected, price } from "./support.js";

const rows = [
  { id: "TC-17", title: "classic, 50 min is 2 blocks", bike: "classic", minutes: 50, time: 5000 },
  { id: "TC-18", title: "e-bike, 75 min is 3 blocks", bike: "ebike", minutes: 75, time: 12000 },
  { id: "TC-19", title: "classic, 60 min is 2 blocks", bike: "classic", minutes: 60, time: 5000 },
  { id: "TC-20", title: "classic, 61 min is 3 blocks", bike: "classic", minutes: 61, time: 7500 },
  { id: "TC-21", title: "e-bike, 30 min is 1 block", bike: "ebike", minutes: 30, time: 4000 },
  { id: "TC-22", title: "e-bike, 31 min is 2 blocks", bike: "ebike", minutes: 31, time: 8000 },
];

for (const { id, title, bike, minutes, time } of rows) {
  test(`T3: ${id} ${title}`, () => {
    assertPrice(price({ bike, after: minutes * MINUTE }), { time });
  });
}

test("T3: TC-23 bike type scooter is rejected (§4)", () => {
  assertRejected({ after: 20 * MINUTE, bike: "scooter" });
});
