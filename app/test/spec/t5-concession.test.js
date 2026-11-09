// T5: concession. Rows follow docs/test-cases.md.
import test from "node:test";
import {
  MINUTE,
  assertPrice,
  assertRejected,
  concession,
  price,
  subscriberWithConcession,
} from "./support.js";

const rows = [
  {
    id: "TC-34",
    title: "concession, classic, 40 min is 5000 less 50 %",
    ride: { after: 40 * MINUTE },
    rider: concession,
    expected: { time: 2500 },
  },
  {
    id: "TC-35",
    title: "concession, e-bike, 30 min is 4000 less 50 %",
    ride: { after: 30 * MINUTE, bike: "ebike" },
    rider: concession,
    expected: { time: 2000 },
  },
  {
    id: "TC-36",
    title: "subscriber with concession, classic, 80 min: concession is lower, not added",
    ride: { after: 80 * MINUTE },
    rider: subscriberWithConcession,
    expected: { time: 3750, concessionApplied: true },
  },
  {
    id: "TC-37",
    title: "subscriber with concession, classic, 40 min: subscription is lower",
    ride: { after: 40 * MINUTE },
    rider: subscriberWithConcession,
    expected: { time: 0, concessionApplied: false },
  },
  {
    id: "TC-38",
    title: "subscriber with concession, classic, 60 min: a tie goes to the subscription",
    ride: { after: 60 * MINUTE },
    rider: subscriberWithConcession,
    expected: { time: 2500, concessionApplied: false },
  },
  {
    id: "TC-39",
    title: "subscriber with concession, classic, 91 min: a tie goes to the subscription",
    ride: { after: 91 * MINUTE },
    rider: subscriberWithConcession,
    expected: { time: 5000, concessionApplied: false },
  },
  {
    id: "TC-40",
    title: "subscriber with concession, classic, 75 min: subscription is lower",
    ride: { after: 75 * MINUTE },
    rider: subscriberWithConcession,
    expected: { time: 2500, concessionApplied: false },
  },
  {
    id: "TC-41",
    title: "subscriber with concession, classic, 76 min: concession is lower",
    ride: { after: 76 * MINUTE },
    rider: subscriberWithConcession,
    expected: { time: 3750, concessionApplied: true },
  },
  {
    id: "TC-42",
    title: "subscriber with concession, e-bike, 30 min: concession is lower",
    ride: { after: 30 * MINUTE, bike: "ebike" },
    rider: subscriberWithConcession,
    expected: { time: 2000, concessionApplied: true },
  },
  {
    id: "TC-91",
    title: "subscriber with concession, e-bike, 2 min: both are 0",
    ride: { after: 2 * MINUTE, bike: "ebike" },
    rider: subscriberWithConcession,
    expected: { time: 0 },
  },
  {
    id: "TC-43",
    title: "concession, 20 min, return X01: no discount on the fee",
    ride: { after: 20 * MINUTE, returnStation: "X01" },
    rider: concession,
    expected: { time: 1250, fees: 15000, total: 16250 },
  },
  {
    id: "TC-99",
    title: "subscriber with concession, classic, 80 min, return X01: no discount on the fee",
    ride: { after: 80 * MINUTE, returnStation: "X01" },
    rider: subscriberWithConcession,
    expected: { time: 3750, fees: 15000, total: 18750, concessionApplied: true },
  },
  {
    id: "TC-101",
    title: "concession, 1 min, return X01: a false start pays the fee in full",
    ride: { after: MINUTE, returnStation: "X01" },
    rider: concession,
    expected: { time: 0, fees: 15000, total: 15000 },
  },
];

for (const { id, title, ride, rider, expected } of rows) {
  test(`T5: ${id} ${title}`, () => {
    assertPrice(price(ride, rider), expected);
  });
}

test("T5: TC-44 rider category vip is rejected (§4)", () => {
  assertRejected({ after: 20 * MINUTE }, { id: "R1", type: "vip" });
});
