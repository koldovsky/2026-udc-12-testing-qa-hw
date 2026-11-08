// Task E, path 2: the expectations in the AI test plan's data table (ai-runs/e-test-plan.md,
// section 4.6) checked against the code after Task B. The expected values are copied by hand
// from the AI draft, not computed from the code. A mismatch is settled by docs/spec/tariffs.md.
// Run from the repo root: node docs/evidence/e-plan-data-check.mjs
import { quote } from "../../app/src/tariff.js";
import { createDayCap } from "../../app/src/day-cap.js";

const T0 = Date.parse("2026-09-16T10:00:00+03:00"); // the draft's default: a daytime ride
const iso = (ms) => new Date(ms).toISOString();
const ride = (seconds, { bike = "classic", at = T0, station = "S01" } = {}) => ({
  pickupAt: iso(at), returnAt: iso(at + seconds * 1000), bike, returnStation: station,
});
const min = (m) => m * 60;
const STD = { type: "standard" }, RED = { type: "reduced" };
const SUB = { type: "subscriber" }, SUBC = { type: "subscriber", concession: true };

// [id from the draft, ride, rider, field, expected by the draft]
const rows = [
  ["D-T1-1", { pickupAt: "2026-09-16T10:00:00+03:00", returnAt: "2026-09-16T10:12:40+03:00", bike: "classic", returnStation: "S01" }, STD, "minutes", 13],
  ["D-T1-2", { pickupAt: "2026-09-16T14:05:00+03:00", returnAt: "2026-09-16T14:41:00+03:00", bike: "classic", returnStation: "S01" }, STD, "minutes", 36],
  ["D-T1-3 0 s", ride(0), STD, "minutes", 0],
  ["D-T1-3 1 s", ride(1), STD, "minutes", 1],
  ["D-T1-3 60 s", ride(60), STD, "minutes", 1],
  ["D-T1-3 61 s", ride(61), STD, "minutes", 2],
  ["D-T2-1 50 s", ride(50), STD, "total", 0],
  ["D-T2-2 120 s", ride(120), STD, "total", 0],
  ["D-T2-2 121 s", ride(121), STD, "total", 2500],
  ["D-T2-3 1 min X02", ride(60, { station: "X02" }), STD, "total", 15000],
  ...[[30, 2500], [31, 5000], [60, 5000], [61, 7500], [50, 5000]].map(([m, e]) => [`D-T3 classic ${m} min`, ride(min(m)), STD, "total", e]),
  ...[[30, 4000], [31, 8000], [75, 12000]].map(([m, e]) => [`D-T3 ebike ${m} min`, ride(min(m), { bike: "ebike" }), STD, "total", e]),
  ...[[40, 0], [45, 0], [46, 2500], [75, 2500], [76, 5000], [100, 5000]].map(([m, e]) => [`D-T4 sub classic ${m} min`, ride(min(m)), SUB, "total", e]),
  ...[[3, 3200], [30, 3200], [31, 6400]].map(([m, e]) => [`D-T4-3 sub ebike ${m} min`, ride(min(m), { bike: "ebike" }), SUB, "total", e]),
  ["D-T5-1 reduced 40 min", ride(min(40)), RED, "total", 2500],
  ["D-T5-2 reduced classic 3 min", ride(min(3)), RED, "total", 1250],
  ["D-T5-2 reduced ebike 30 min", ride(min(30), { bike: "ebike" }), RED, "total", 2000],
  ...[[80, 3750], [46, 2500], [60, 2500], [75, 2500], [76, 3750], [105, 5000], [106, 5000], [2, 0]].map(([m, e]) => [`D-T5 sub+concession classic ${m} min`, ride(min(m)), SUBC, "total", e]),
  ["D-T5-7 sub+concession ebike 30 min", ride(min(30), { bike: "ebike" }), SUBC, "total", 2000],
  ["D-T6-2 360 min", ride(min(360)), STD, "total", 30000],
  ["D-T6-2 361 min", ride(min(361)), STD, "total", 30000],
  ["D-T6-5 reduced 25 h", ride(min(1500)), RED, "total", 230000],
  ["D-T7-1 20 min X01", ride(min(20), { station: "X01" }), STD, "total", 17500],
  ...["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08"].map((s) => [`D-T7-2 ${s}`, ride(min(20), { station: s }), STD, "total", 2500]),
  ...["X01", "X02", "X03"].map((s) => [`D-T7-2 ${s}`, ride(min(20), { station: s }), STD, "total", 17500]),
  ["D-T7-3 reduced 40 min X03", ride(min(40), { station: "X03" }), RED, "total", 17500],
  ["D-T8-1 1440 min", ride(min(1440)), STD, "total", 30000],
  ["D-T8-2 1441 min", ride(min(1441)), STD, "total", 230000],
  ["(not in the draft) 24 h + 1 s", ride(min(1440) + 1), STD, "total", 230000],
  ["D-T8-3 25 h", ride(min(1500)), STD, "total", 230000],
  ["D-T8-4 25 h X03", ride(min(1500), { station: "X03" }), STD, "total", 245000],
  ["D-T10-1 01:10-01:40", { pickupAt: "2026-09-16T01:10:00+03:00", returnAt: "2026-09-16T01:40:00+03:00", bike: "classic", returnStation: "S01" }, STD, "total", 1750],
  ["D-T10-2 ebike 00:10-00:40", { pickupAt: "2026-09-16T00:10:00+03:00", returnAt: "2026-09-16T00:40:00+03:00", bike: "ebike", returnStation: "S01" }, STD, "total", 2800],
  ["D-DST-1 minutes", { pickupAt: "2026-10-25T03:30:00+03:00", returnAt: "2026-10-25T03:30:00+02:00", bike: "classic", returnStation: "S01" }, STD, "minutes", 60],
  ["D-DST-1 total", { pickupAt: "2026-10-25T03:30:00+03:00", returnAt: "2026-10-25T03:30:00+02:00", bike: "classic", returnStation: "S01" }, STD, "total", 3500],
  ["D-DST-2 minutes", { pickupAt: "2027-03-28T02:50:00+02:00", returnAt: "2027-03-28T04:10:00+03:00", bike: "classic", returnStation: "S01" }, STD, "minutes", 20],
  ["D-DST-2 total", { pickupAt: "2027-03-28T02:50:00+02:00", returnAt: "2027-03-28T04:10:00+03:00", bike: "classic", returnStation: "S01" }, STD, "total", 1750],
  ["D-INV-2 return = pickup", ride(0), STD, "total", 0],
];

let ok = 0, bad = 0;
const report = (id, actual, expected) => {
  const pass = actual === expected;
  pass ? ok++ : bad++;
  console.log(`${pass ? "ok  " : "DIFF"} ${id}: draft ${expected}, code ${actual}`);
};
for (const [id, r, rider, field, expected] of rows) report(id, quote(r, rider)[field], expected);

// D-T5-4 / D-T5-6 / D-T5-8: a tie goes to the subscription (spec :90-91)
for (const m of [46, 60, 105]) {
  const codes = quote(ride(min(m)), SUBC).discounts.map((d) => d.code).join(",");
  report(`D-T5 tie ${m} min: discount code`, codes, "subscription");
}

// D-T6-1: three e-bike rides of 80 min on 16.09 (spec :105-106)
{
  const dayCap = createDayCap();
  const r = { ...STD, id: "U1" };
  ["09:00", "13:00", "18:00"].forEach((t, i) => {
    const at = Date.parse(`2026-09-16T${t}:00+03:00`);
    report(`D-T6-1 ride ${i + 1}`, quote(ride(min(80), { bike: "ebike", at }), r, { dayCap }).total, [12000, 12000, 6000][i]);
  });
}
// D-T6-4: the cap is used up; one more ride that day, returned at X01 → only the fee (spec :102-103)
{
  const dayCap = createDayCap();
  const r = { ...STD, id: "U2" };
  quote(ride(min(360), { at: Date.parse("2026-09-16T08:00:00+03:00") }), r, { dayCap });
  report("D-T6-4 after the cap, X01", quote(ride(min(20), { at: Date.parse("2026-09-16T15:00:00+03:00"), station: "X01" }), r, { dayCap }).total, 15000);
}
// D-INV-1, -3, -4, -5: rejected (spec :147-149)
const rejected = [
  ["D-INV-1 return 1 s before pickup", ride(-1), STD],
  ["D-INV-3 bike tandem", ride(min(20), { bike: "tandem" }), STD],
  ["D-INV-3 bike empty", ride(min(20), { bike: "" }), STD],
  ["D-INV-4 category vip", ride(min(20)), { type: "vip" }],
  ["D-INV-4 category empty", ride(min(20)), { type: "" }],
  ...["S09", "X04", ""].map((s) => [`D-INV-5 station "${s}"`, ride(min(20), { station: s }), STD]),
];
for (const [id, r, rider] of rejected) {
  let threw = false;
  try { quote(r, rider); } catch { threw = true; }
  report(id, threw ? "rejected" : "accepted", "rejected");
}
console.log(`\nok ${ok}, diff ${bad}`);
