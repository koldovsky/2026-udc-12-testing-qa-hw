// quote() and formatReceipt() together, the way the API uses them.
// Every ride is written out: no random data, so every run checks the same cases,
// including the block boundaries 30 and 60 min that random durations hit only sometimes.
import test from "node:test";
import assert from "node:assert/strict";
import { formatReceipt } from "../../src/receipt.js";
import { quote } from "../../src/tariff.js";
import { ride, rider } from "../helpers/factory.js";

// Standard rider, daytime in Kyiv, returned in the zone: the amount due is the T3 time
// charge alone — "кожні розпочаті 30 хвилин" (tariffs.md:62), 25 / 40 грн per block
// (tariffs.md:66–67), whole minutes (tariffs.md:45–47).
// Rows "ebike 30 / 60 min" and "classic 60 min" are the failing inputs from
// ai-runs/d-repeat-before.txt. Rows "30 min 1 s": a part-minute past the block boundary is a
// full minute (tariffs.md:46), 31 min → 2 blocks — the 30:00 / 30:01 boundary of T1 and T3.
const RIDES = [
  { id: "classic-29", pickupAt: "2026-09-21T06:00:00Z", returnAt: "2026-09-21T06:29:00Z", bike: "classic", due: 2500, line: "До сплати .......................... 25,00 грн" },
  { id: "classic-30", pickupAt: "2026-09-21T06:00:00Z", returnAt: "2026-09-21T06:30:00Z", bike: "classic", due: 2500, line: "До сплати .......................... 25,00 грн" },
  { id: "classic-30m01s", pickupAt: "2026-09-21T06:00:00Z", returnAt: "2026-09-21T06:30:01Z", bike: "classic", due: 5000, line: "До сплати .......................... 50,00 грн" },
  { id: "classic-31", pickupAt: "2026-09-21T06:00:00Z", returnAt: "2026-09-21T06:31:00Z", bike: "classic", due: 5000, line: "До сплати .......................... 50,00 грн" },
  { id: "classic-60", pickupAt: "2026-09-21T14:44:00Z", returnAt: "2026-09-21T15:44:00Z", bike: "classic", due: 5000, line: "До сплати .......................... 50,00 грн" },
  { id: "classic-61", pickupAt: "2026-09-21T14:44:00Z", returnAt: "2026-09-21T15:45:00Z", bike: "classic", due: 7500, line: "До сплати .......................... 75,00 грн" },
  { id: "ebike-30", pickupAt: "2026-09-21T14:24:00Z", returnAt: "2026-09-21T14:54:00Z", bike: "ebike", due: 4000, line: "До сплати .......................... 40,00 грн" },
  { id: "ebike-30m01s", pickupAt: "2026-09-21T14:24:00Z", returnAt: "2026-09-21T14:54:01Z", bike: "ebike", due: 8000, line: "До сплати .......................... 80,00 грн" },
  { id: "ebike-31", pickupAt: "2026-09-21T14:24:00Z", returnAt: "2026-09-21T14:55:00Z", bike: "ebike", due: 8000, line: "До сплати .......................... 80,00 грн" },
  { id: "ebike-60", pickupAt: "2026-09-21T11:52:00Z", returnAt: "2026-09-21T12:52:00Z", bike: "ebike", due: 8000, line: "До сплати .......................... 80,00 грн" },
  { id: "ebike-61", pickupAt: "2026-09-21T11:52:00Z", returnAt: "2026-09-21T12:53:00Z", bike: "ebike", due: 12000, line: "До сплати ......................... 120,00 грн" },
];

test("T1 T3 T9: the receipt shows the amount due for rides at the 30 and 60 min block boundaries", () => {
  for (const { id, due, line, ...times } of RIDES) {
    const q = quote(ride({ ...times }), rider());

    assert.equal(q.total, due, id);
    assert.equal(formatReceipt(q).at(-1), line, id);
  }
});

test("a receipt lists the fee for a return outside the zone", () => {
  const lines = formatReceipt(
    quote(ride({ pickupAt: "2026-09-21T07:15:00Z", returnAt: "2026-09-21T07:35:00Z", returnStation: "X02" }), rider()),
  );

  assert.deepEqual(lines, [
    "Тривалість поїздки: 20 хв",
    "Погодинне нарахування .............. 25,00 грн",
    "Збір: повернення поза зоною ....... 150,00 грн",
    "До сплати ......................... 175,00 грн",
  ]);
});
