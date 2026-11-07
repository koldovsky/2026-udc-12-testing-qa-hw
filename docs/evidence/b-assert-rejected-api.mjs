// Usage (from the repo root): node docs/evidence/b-assert-rejected-api.mjs [path-to-app-dir]   (default: app)
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const dir = resolve(process.argv[2] ?? "app");
const { createHandler } = await import(pathToFileURL(resolve(dir, "src/server.js")).href);
const body = { ride: { pickupAt: "2026-09-16T10:00:00+03:00", returnAt: "2026-09-16T10:20:00+03:00", bike: "classic", returnStation: "S01" }, rider: { type: "vip" } };
const req = { method: "POST", url: "/api/quote", async *[Symbol.asyncIterator]() { yield JSON.stringify(body); } };
let status, out;
const res = { writeHead(s) { status = s; }, setHeader() {}, end(b) { out = b; } };
await createHandler()(req, res);
console.log(status, out);
