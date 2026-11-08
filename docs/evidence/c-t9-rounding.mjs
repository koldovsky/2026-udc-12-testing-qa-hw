// Task C — evidence for the T9 rounding note (docs/traceability.md, row T9; docs/test-cases.md Q-3).
// (a) counts calls of discount() inside quote() whose result would have a fraction of a kopeck
//     (floor is a no-op otherwise); (b) fault check: Math.floor -> Math.ceil in discount(), full
//     suite in a temp copy of app/. Run from the repo root:
//   node docs/evidence/c-t9-rounding.mjs
// Works only in a mkdtemp dir that is removed at the end; app/ is not touched.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "ws12-t9-"));
try {
  // (a) instrumented copy of src
  cpSync("app/src", join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "package.json"), '{ "type": "module" }\n');
  const file = join(dir, "src", "tariff.js");
  const src = readFileSync(file, "utf8");
  const head = "export function discount(amount, percent) {\n";
  if (src.split(head).length !== 2) throw new Error("discount() head: expected exactly one match");
  writeFileSync(file, src.replace(head, head +
    "  globalThis.__calls = (globalThis.__calls ?? 0) + 1;\n" +
    "  if ((amount * (100 - percent)) % 100 !== 0) globalThis.__frac = (globalThis.__frac ?? 0) + 1;\n"));
  const { quote } = await import(pathToFileURL(file));
  const { createDayCap } = await import(pathToFileURL(join(dir, "src", "day-cap.js")));

  const riders = [{ type: "standard" }, { type: "reduced" }, { type: "subscriber" }, { type: "subscriber", concession: true }];
  // Kyiv (UTC+3 in September): 12:00 day, 00:30, 01:10, 05:30 night
  const pickups = ["2026-09-16T09:00:00Z", "2026-09-15T21:30:00Z", "2026-09-15T22:10:00Z", "2026-09-16T02:30:00Z"];
  let n = 0;
  for (const p of pickups) for (const bike of ["classic", "ebike"]) for (const st of ["S01", "X01"]) for (const r of riders)
    for (let s = 0; s <= 1500 * 60; s += 30) { // 0 … 25 h, 30-second steps
      quote({ pickupAt: p, returnAt: new Date(Date.parse(p) + s * 1000).toISOString(), bike, returnStation: st }, r);
      n++;
    }
  // day-cap ledger case: several long rides of one rider on one day
  const dayCap = createDayCap();
  for (const bike of ["classic", "ebike"]) for (const r of riders) for (let s = 0; s <= 600 * 60; s += 30) {
    const p = pickups[0];
    quote({ pickupAt: p, returnAt: new Date(Date.parse(p) + s * 1000).toISOString(), bike, returnStation: "S01" }, { ...r, id: `${bike}-${r.type}-${r.concession ?? false}` }, { dayCap });
    n++;
  }
  console.log(`(a) quote() inputs: ${n} (4 pickups x 2 bikes x 2 stations x 4 rider kinds x 3001 durations + day-cap ledger runs)`);
  console.log(`    discount() calls: ${globalThis.__calls}`);
  console.log(`    calls with a fraction: ${globalThis.__frac ?? 0}`);

  // (b) fault check
  cpSync("app", join(dir, "app"), { recursive: true, filter: (p) => !p.includes("node_modules") });
  const tf = join(dir, "app", "src", "tariff.js");
  const t = readFileSync(tf, "utf8");
  const line = "return amount - Math.floor((amount * (100 - percent)) / 100);";
  if (t.split(line).length !== 2) throw new Error("Math.floor: expected exactly one match");
  writeFileSync(tf, t.replace(line, line.replace("Math.floor(", "Math.ceil(")));
  const r = spawnSync(process.execPath, ["--test", "--test-reporter=tap", "test/unit/**/*.test.js", "test/spec/**/*.test.js"], { cwd: join(dir, "app"), encoding: "utf8" });
  const out = r.stdout;
  const num = (k) => out.match(new RegExp(`^# ${k} (\\d+)`, "m"))?.[1];
  console.log(`(b) Math.floor -> Math.ceil in discount(): tests ${num("tests")}, pass ${num("pass")}, fail ${num("fail")}`);
  const red = [...new Set([...out.matchAll(/^\s*not ok \d+ - (.+?)\s*$/gm)].map((m) => m[1]))];
  console.log(`    red tests:\n${red.map((x) => "      " + x).join("\n")}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
