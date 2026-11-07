// Open question Q-15: does the daily cap (T6) apply to POST /api/quote? Two rides of rider U1 on 16.09 are quoted separately.
// Spec: docs/spec/tariffs.md:100-101 (one rider's hourly charges per day ≤ 30 000 коп.); the server passes no ledger (app/src/server.js:33).
// Run from the repo root: node docs/evidence/b-api-day-cap.mjs
import { createHandler } from "../../app/src/server.js";

const handle = createHandler();
const rider = { type: "standard", id: "U1" };
const rides = [
  { pickupAt: "2026-09-16T08:00:00+03:00", returnAt: "2026-09-16T14:00:00+03:00", bike: "ebike", returnStation: "S01" },
  { pickupAt: "2026-09-16T15:00:00+03:00", returnAt: "2026-09-16T21:00:00+03:00", bike: "ebike", returnStation: "S01" },
];

async function post(ride) {
  const req = { method: "POST", url: "/api/quote", async *[Symbol.asyncIterator]() { yield JSON.stringify({ ride, rider }); } };
  let status, body;
  await handle(req, { writeHead: (s) => { status = s; }, end: (b) => { body = JSON.parse(b); } });
  return { status, body };
}

let sum = 0;
for (const [i, ride] of rides.entries()) {
  const { status, body } = await post(ride);
  console.log(`request ${i + 1}: ${ride.pickupAt} → ${ride.returnAt}: HTTP ${status}, quote.total = ${body.quote.total}`);
  sum += body.quote.total;
}
console.log(`day sum = ${sum}; spec limit = 30000; ${sum > 30000 ? "EXCEEDS the limit" : "within the limit"}`);
