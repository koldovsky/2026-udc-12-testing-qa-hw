// T7: out-of-zone fee. Rows follow docs/test-cases.md.
import test from "node:test";
import { MINUTE, assertPrice, assertRejected, price, standard, subscriber } from "./support.js";

const rows = [
  {
    id: "TC-59",
    title: "20 min, return X01",
    ride: { after: 20 * MINUTE, returnStation: "X01" },
    expected: { time: 2500, fees: 15000, total: 17500 },
  },
  ...["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08"].map((returnStation) => ({
    id: "TC-60",
    title: `20 min, return ${returnStation} in the zone: no fee`,
    ride: { after: 20 * MINUTE, returnStation },
    expected: { fees: 0, total: 2500 },
  })),
  ...["X01", "X02", "X03"].map((returnStation) => ({
    id: "TC-61",
    title: `20 min, return ${returnStation} outside the zone: the fee`,
    ride: { after: 20 * MINUTE, returnStation },
    expected: { fees: 15000, total: 17500 },
  })),
  {
    id: "TC-62",
    title: "subscriber, e-bike, 30 min, return X01: no discount on the fee",
    ride: { after: 30 * MINUTE, bike: "ebike", returnStation: "X01" },
    rider: subscriber,
    expected: { time: 3200, fees: 15000, total: 18200 },
  },
];

for (const { id, title, ride, rider = standard, expected } of rows) {
  test(`T7: ${id} ${title}`, () => {
    assertPrice(price(ride, rider), expected);
  });
}

const unknownStations = [
  { id: "TC-63", returnStation: "S09" },
  { id: "TC-64", returnStation: "X04" },
];

for (const { id, returnStation } of unknownStations) {
  test(`T7: ${id} return station ${returnStation} is rejected (§4)`, () => {
    assertRejected({ after: 20 * MINUTE, returnStation });
  });
}
