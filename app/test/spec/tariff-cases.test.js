import test from "node:test";
import assert from "node:assert/strict";
import { quote } from "../../src/tariff.js";

const ride = (pickupAt, returnAt, bike = "classic", returnStation = "S03") => ({
  pickupAt,
  returnAt,
  bike,
  returnStation,
});

const cases = [
  { id: "TC-01", rules: "T1", desc: "rounds a partial minute up", ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:12:40+03:00"), rider: { type: "standard" }, minutes: 13, timeCharge: 2500, total: 2500, fees: [], discounts: [] },
  { id: "TC-02", rules: "T1, T3", desc: "bills exactly 30 minutes as one block", ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:30:00+03:00"), rider: { type: "standard" }, minutes: 30, timeCharge: 2500, total: 2500, fees: [], discounts: [] },
  { id: "TC-03", rules: "T1, T3", desc: "rounds 30 minutes and one second to 31 minutes", ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:30:01+03:00"), rider: { type: "standard" }, minutes: 31, timeCharge: 5000, total: 5000, fees: [], discounts: [] },
  { id: "TC-04", rules: "T2", desc: "waives time charge at two minutes", ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:02:00+03:00"), rider: { type: "standard" }, minutes: 2, timeCharge: 0, total: 0, fees: [], discounts: [] },
  { id: "TC-05", rules: "T2, T3", desc: "charges one block after two minutes", ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:02:01+03:00"), rider: { type: "standard" }, minutes: 3, timeCharge: 2500, total: 2500, fees: [], discounts: [] },
  { id: "TC-06", rules: "T3", desc: "charges three e-bike blocks for 75 minutes", ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T11:15:00+03:00", "ebike"), rider: { type: "standard" }, minutes: 75, timeCharge: 12000, total: 12000, fees: [], discounts: [] },
  { id: "TC-07", rules: "T4", desc: "makes a 45-minute classic subscriber ride free", ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:45:00+03:00"), rider: { type: "subscriber" }, minutes: 45, timeCharge: 5000, total: 0, fees: [], discounts: [{ code: "subscription", amount: 5000 }] },
  { id: "TC-08", rules: "T4", desc: "charges one block for the first minute after the free period", ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:46:00+03:00"), rider: { type: "subscriber" }, minutes: 46, timeCharge: 5000, total: 2500, fees: [], discounts: [{ code: "subscription", amount: 2500 }] },
  { id: "TC-09", rules: "T4", desc: "discounts an e-bike subscriber ride without free minutes", ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:30:00+03:00", "ebike"), rider: { type: "subscriber" }, minutes: 30, timeCharge: 4000, total: 3200, fees: [], discounts: [{ code: "subscription", amount: 800 }] },
  { id: "TC-10", rules: "T5", desc: "applies the reduced fare to two classic blocks", ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:40:00+03:00"), rider: { type: "reduced" }, minutes: 40, timeCharge: 5000, total: 2500, fees: [], discounts: [{ code: "reduced", amount: 2500 }] },
  { id: "TC-11", rules: "T5", desc: "chooses the cheaper eligible subscriber plan", ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T11:20:00+03:00"), rider: { type: "subscriber", concession: true }, minutes: 80, timeCharge: 7500, total: 3750, fees: [], discounts: [{ code: "reduced", amount: 3750 }] },
  { id: "TC-14", rules: "T7", desc: "adds the out-of-zone fee", ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:20:00+03:00", "classic", "X01"), rider: { type: "standard" }, minutes: 20, timeCharge: 2500, total: 17500, fees: [{ code: "out-of-zone", amount: 15000 }], discounts: [] },
  { id: "TC-15", rules: "T5, T7", desc: "does not discount the out-of-zone fee", ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:20:00+03:00", "classic", "X01"), rider: { type: "reduced" }, minutes: 20, timeCharge: 2500, total: 16250, fees: [{ code: "out-of-zone", amount: 15000 }], discounts: [{ code: "reduced", amount: 1250 }] },
  { id: "TC-16", rules: "T8", desc: "does not charge the unreturned fee at exactly 24 hours", ride: ride("2026-09-16T10:00:00+03:00", "2026-09-17T10:00:00+03:00"), rider: { type: "standard" }, minutes: 1440, timeCharge: 120000, total: 30000, fees: [], discounts: [{ code: "day-cap", amount: 90000 }] },
  { id: "TC-17", rules: "T8", desc: "adds unreturned fee after 24 hours", ride: ride("2026-09-16T10:00:00+03:00", "2026-09-17T11:00:00+03:00"), rider: { type: "standard" }, minutes: 1500, timeCharge: 125000, total: 230000, fees: [{ code: "unreturned", amount: 200000 }], discounts: [{ code: "day-cap", amount: 95000 }] },
  { id: "TC-18", rules: "T7, T8", desc: "charges both independent fees", ride: ride("2026-09-16T10:00:00+03:00", "2026-09-17T11:00:00+03:00", "classic", "X01"), rider: { type: "standard" }, minutes: 1500, timeCharge: 125000, total: 245000, fees: [{ code: "out-of-zone", amount: 15000 }, { code: "unreturned", amount: 200000 }], discounts: [{ code: "day-cap", amount: 95000 }] },
  { id: "TC-20", rules: "T10", desc: "discounts a night ride by 30 percent", ride: ride("2026-09-16T01:10:00+03:00", "2026-09-16T01:40:00+03:00"), rider: { type: "standard" }, minutes: 30, timeCharge: 2500, total: 1750, fees: [], discounts: [{ code: "night", amount: 750 }] },
  { id: "TC-21", rules: "T2, T7", desc: "waives time charge but retains the out-of-zone fee", ride: ride("2026-09-16T10:00:00+03:00", "2026-09-16T10:01:00+03:00", "classic", "X01"), rider: { type: "standard" }, minutes: 1, timeCharge: 0, total: 15000, fees: [{ code: "out-of-zone", amount: 15000 }], discounts: [] },
];

for (const scenario of cases) {
  test(`${scenario.id} ${scenario.rules}: ${scenario.desc}`, () => {
    const result = quote(scenario.ride, scenario.rider);
    assert.equal(result.minutes, scenario.minutes);
    assert.equal(result.timeCharge, scenario.timeCharge);
    assert.equal(result.total, scenario.total);
    assert.deepEqual(result.fees, scenario.fees);
    assert.deepEqual(result.discounts, scenario.discounts);
  });
}
