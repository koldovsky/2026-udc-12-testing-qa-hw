// Task C, step 4 — evidence for the mutant verdicts in docs/test-quality.md (section 4).
// Differential test: the original app/src/tariff.js against a mutant of it, over a grid of
// valid inputs; prints how many outputs of quote() differ. Run from the repo root:
//   node docs/evidence/c-mutant-equivalence.mjs
// Mutants are rebuilt from the current source in a temp dir; the repo is not touched.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const MUTANTS = {
  "M016 tariff.js:47 `plan.amount > 0` → `> 1`": ["if (plan.amount > 0) discounts", "if (plan.amount > 1) discounts"],
  "M018 tariff.js:50 `due > 0` → `due >= 0`": ["if (due > 0 && kyivTime", "if (due >= 0 && kyivTime"],
  "M019 tariff.js:50 `due > 0` → `due > 1`": ["if (due > 0 && kyivTime", "if (due > 1 && kyivTime"],
};
const riders = [{ type: "standard" }, { type: "reduced" }, { type: "subscriber" }, { type: "subscriber", concession: true }];
// pickup 10:00 Kyiv (day), 01:00 Kyiv (night), 05:59:30 Kyiv (last night minute)
const pickups = ["2026-09-16T07:00:00Z", "2026-09-15T22:00:00Z", "2026-09-16T02:59:30Z"];

const dir = mkdtempSync(join(tmpdir(), "ws12-eq-"));
try {
  writeFileSync(join(dir, "package.json"), '{ "type": "module" }\n');
  const load = async (name, from, to) => {
    cpSync("app/src", join(dir, name), { recursive: true });
    const file = join(dir, name, "tariff.js");
    const src = readFileSync(file, "utf8");
    if (from && !src.includes(from)) throw new Error(`${name}: pattern not found`);
    if (from) writeFileSync(file, src.replace(from, to));
    return import(pathToFileURL(file));
  };
  const orig = await load("orig");
  for (const [label, [from, to]] of Object.entries(MUTANTS)) {
    const mut = await load(label.split(" ")[0], from, to);
    let n = 0, differ = 0, sample;
    for (const p of pickups) for (const bike of ["classic", "ebike"]) for (const st of ["S01", "X01"]) for (const r of riders)
      for (let s = 0; s <= 1500 * 60; s += 30) { // 0 … 25 h in 30-second steps
        const ride = { pickupAt: p, returnAt: new Date(Date.parse(p) + s * 1000).toISOString(), bike, returnStation: st };
        const a = JSON.stringify(orig.quote(ride, r)), b = JSON.stringify(mut.quote(ride, r));
        n++;
        if (a !== b) { differ++; sample ??= `${JSON.stringify({ ride, rider: r })}\n    original ${a}\n    mutant   ${b}`; }
      }
    console.log(`${label}: inputs ${n}, outputs differ ${differ}${sample ? `\n  first: ${sample}` : ""}`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
