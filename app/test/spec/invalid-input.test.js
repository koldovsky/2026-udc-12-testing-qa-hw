import test from "node:test";
import assert from "node:assert/strict";
import { quote } from "../../src/tariff.js";
import { at, RIDERS, run } from "../helpers/spec.js";

// §4: invalid input is rejected. Only the fact of rejection is checked (Q-9).
const base = { pickupAt: at(16, "12:00:00"), returnAt: at(16, "12:30:00"), bike: "classic", returnStation: "S01" };

const rejected = [
  { id: "TC-74", name: "return earlier than pickup", ride: { returnAt: at(16, "11:59:59") } },
  { id: "TC-75", name: "unknown bike type", ride: { bike: "scooter" } },
  { id: "TC-76", name: "unknown rider category", rider: { type: "vip" } },
  { id: "TC-77", name: "station S09 is not in appendix A", ride: { returnStation: "S09" } },
  { id: "TC-78", name: "station X04 is not in appendix A", ride: { returnStation: "X04" } },
];

for (const c of rejected) {
  test(`§4: ${c.id} ${c.name} is rejected`, () => {
    assert.throws(() => quote({ ...base, ...c.ride }, c.rider ?? RIDERS.standard));
  });
}

test("§4, T2: TC-79 return equal to pickup is calculated: 0 min, 0", () => {
  const result = run({ from: at(16, "12:00:00"), to: at(16, "12:00:00") });
  assert.equal(result.minutes, 0);
  assert.equal(result.total, 0);
});
