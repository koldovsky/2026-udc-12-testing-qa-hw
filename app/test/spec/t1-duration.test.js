// T1: ride duration. Rows follow docs/test-cases.md.
import test from "node:test";
import { MINUTE, SECOND, assertPrice, assertRejected, price } from "./support.js";

const rows = [
  {
    id: "TC-01",
    title: "10:00:00 to 10:12:40 is 13 min",
    ride: { pickupAt: "2026-09-16T07:00:00Z", returnAt: "2026-09-16T07:12:40Z" },
    expected: { minutes: 13 },
  },
  {
    id: "TC-02",
    title: "14:05:00 to 14:41:00 is 36 min",
    ride: { pickupAt: "2026-09-16T11:05:00Z", returnAt: "2026-09-16T11:41:00Z" },
    expected: { minutes: 36 },
  },
  {
    id: "TC-03",
    title: "10:00:40 to 10:30:40 is 30 min: elapsed time is rounded, not each moment",
    ride: { pickupAt: "2026-09-16T07:00:40Z", returnAt: "2026-09-16T07:30:40Z" },
    expected: { minutes: 30, time: 2500 },
  },
  {
    id: "TC-04",
    title: "30 min 00 s is 30 min, 1 block",
    ride: { after: 30 * MINUTE },
    expected: { minutes: 30, time: 2500 },
  },
  {
    id: "TC-05",
    title: "30 min 01 s is 31 min, 2 blocks",
    ride: { after: 30 * MINUTE + SECOND },
    expected: { minutes: 31, time: 5000 },
  },
  {
    id: "TC-06",
    title: "12 min 00.001 s is 13 min",
    ride: { after: 12 * MINUTE + 1 },
    expected: { minutes: 13 },
  },
  {
    id: "TC-07",
    title: "across the autumn clock change: 120 min elapsed, not 60 by the wall clock",
    ride: { pickupAt: "2026-10-24T23:30:00Z", returnAt: "2026-10-25T01:30:00Z" },
    expected: { minutes: 120 },
  },
  {
    id: "TC-08",
    title: "wall clock goes back at the return: accepted, 20 min elapsed",
    ride: { pickupAt: "2026-10-25T00:50:00Z", returnAt: "2026-10-25T01:10:00Z" },
    expected: { minutes: 20 },
  },
  {
    id: "TC-98",
    title: "across the spring clock change: 20 min elapsed, not 80 by the wall clock",
    ride: { pickupAt: "2027-03-28T00:50:00Z", returnAt: "2027-03-28T01:10:00Z" },
    expected: { minutes: 20 },
  },
  {
    id: "TC-10",
    title: "return = pickup is accepted: 0 min, no time charge (§4)",
    ride: { after: 0 },
    expected: { minutes: 0, time: 0 },
  },
];

for (const { id, title, ride, expected } of rows) {
  test(`T1: ${id} ${title}`, () => {
    assertPrice(price(ride), expected);
  });
}

test("T1: TC-09 return 1 s before pickup is rejected (§4)", () => {
  assertRejected({ after: -SECOND });
});
