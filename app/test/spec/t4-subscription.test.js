// T4: subscription. Rows follow docs/test-cases.md.
import test from "node:test";
import assert from "node:assert/strict";
import { createDayCap } from "../../src/day-cap.js";
import { MINUTE, assertPrice, price, subscriber } from "./support.js";

const rows = [
  { id: "TC-24", title: "classic, 40 min is free", bike: "classic", minutes: 40, time: 0 },
  { id: "TC-25", title: "classic, 45 min is free", bike: "classic", minutes: 45, time: 0 },
  { id: "TC-26", title: "classic, 46 min is 1 paid min, 1 block", bike: "classic", minutes: 46, time: 2500 },
  { id: "TC-27", title: "classic, 75 min is 30 paid min, 1 block", bike: "classic", minutes: 75, time: 2500 },
  { id: "TC-28", title: "classic, 76 min is 31 paid min, 2 blocks", bike: "classic", minutes: 76, time: 5000 },
  { id: "TC-29", title: "classic, 100 min is 55 paid min, 2 blocks", bike: "classic", minutes: 100, time: 5000 },
  { id: "TC-30", title: "e-bike, 30 min is 4000 less 20 %", bike: "ebike", minutes: 30, time: 3200 },
  { id: "TC-31", title: "e-bike, 40 min has no free minutes: 8000 less 20 %", bike: "ebike", minutes: 40, time: 6400 },
  { id: "TC-32", title: "e-bike, 75 min is 12000 less 20 %", bike: "ebike", minutes: 75, time: 9600 },
];

for (const { id, title, bike, minutes, time } of rows) {
  test(`T4: ${id} subscriber, ${title}`, () => {
    assertPrice(price({ bike, after: minutes * MINUTE }, subscriber), { time });
  });
}

test("T4: TC-33 subscriber, free minutes apply to each of two rides on one day", () => {
  const dayCap = createDayCap();
  const times = ["2026-09-16T07:00:00Z", "2026-09-16T10:00:00Z"].map(
    (pickupAt) => price({ pickupAt, after: 40 * MINUTE }, subscriber, dayCap).time,
  );
  assert.deepEqual(times, [0, 0]);
});
