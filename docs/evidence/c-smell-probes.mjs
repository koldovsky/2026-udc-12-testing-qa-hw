// Task C — evidence for the «Доказ» column of docs/test-quality.md (section 2): fault-injection probes.
// One exact replacement in a fresh copy of app/src, then `node --test "test/unit/**/*.test.js"` in the copy.
//   node docs/evidence/c-smell-probes.mjs [--worktree]   (from the repo root)
// Default source: `git archive 5b5c48c app` (18 unit tests); --worktree: the current app/ working tree.
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const T = "src/tariff.js", D = "src/day-cap.js";
const NOW = "limit - (charged.get(keyOf(riderId, pickupAt)) ?? 0)";
const QUOTE = 'export function quote(ride, rider, { zones = stationZones, dayCap } = {}) {';
const PROBES = [
  ["baseline"],
  ["#1 quote throws", T, QUOTE, QUOTE + '\n  throw new Error("probe");'],
  ["#2 RATES.ebike 4000 -> 4500", T, "classic: 2500, ebike: 4000", "classic: 2500, ebike: 4500"],
  ["#4 NIGHT_PERCENT 30 -> 10", T, "NIGHT_PERCENT = 30", "NIGHT_PERCENT = 10"],
  ["#5 SUBSCRIPTION_EBIKE_PERCENT 20 -> 10", T, "SUBSCRIPTION_EBIKE_PERCENT = 20", "SUBSCRIPTION_EBIKE_PERCENT = 10"],
  ["#6 UNRETURNED_FEE 200000 -> 1", T, "UNRETURNED_FEE = 200000", "UNRETURNED_FEE = 1"],
  ["#7 day cap never applied", T, "if (due > allowance) {", "if (false) {"],
  ["#8 remaining subtracts half", D, NOW, NOW + " / 2"],
  ["#9 dayKey by UTC", D, "return kyivTime(pickupAt).date;", "return new Date(pickupAt).toISOString().slice(0, 10);"],
];
const worktree = process.argv.includes("--worktree");
console.log("$ node docs/evidence/c-smell-probes.mjs" + (worktree ? " --worktree" : ""));

const root = mkdtempSync(join(tmpdir(), "ws12-probes-"));
try {
  const tar = worktree ? null : execFileSync("git", ["archive", "5b5c48c", "app"], { maxBuffer: 1 << 28 });
  PROBES.forEach(([label, file, from, to], i) => {
    const dir = join(root, String(i));
    if (worktree) cpSync("app", join(dir, "app"), { recursive: true, filter: (s) => !s.includes("node_modules") });
    else { execFileSync("mkdir", ["-p", dir]); execFileSync("tar", ["-x", "-C", dir], { input: tar }); }
    if (file) {
      const p = join(dir, "app", file), src = readFileSync(p, "utf8");
      if (src.split(from).length !== 2) throw new Error(`${label}: pattern not found exactly once`);
      writeFileSync(p, src.replace(from, () => to));
    }
    const r = spawnSync("node", ["--test", "test/unit/**/*.test.js"], { cwd: join(dir, "app"), encoding: "utf8" });
    const out = r.stdout + r.stderr, n = (k) => out.match(new RegExp(`^ℹ ${k} (\\d+)`, "m"))?.[1];
    const red = [...new Set([...out.matchAll(/^\s*✖ (.+?)(?: \([\d.]+ms\))?$/gm)].map((m) => m[1]).filter((s) => s !== "failing tests:"))];
    console.log(`${label}: pass ${n("pass")}, fail ${n("fail")}${red.map((s) => `\n  ✖ ${s}`).join("")}`);
  });
} finally {
  rmSync(root, { recursive: true, force: true });
}
