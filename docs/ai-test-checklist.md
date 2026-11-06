# Checklist for test artifacts from AI

Applied to both Task A drafts: `ai-runs/a1-from-code.md` and `ai-runs/a2-from-spec.md`.
Counts come from `node docs/evidence/task-a-check.mjs`, run on the code from `main`.
After the Task B fixes, pass a copy of that code: `mkdir -p ../ws12-main && git archive main app | tar -x -C ../ws12-main`, then `node docs/evidence/task-a-check.mjs ../ws12-main/app/src`.

## Checklist

| # | Check | Why it matters | A1 - from code | A2 - from spec |
|---|---|---|---|---|
| 1 | Does every expected value point to the spec, not to the code? | Code cannot be its own oracle: a test built from it repeats its defects | ❌ A-04 cites `tariff.js:20` and `:79` | ✅ TC-T2-02 cites the T2 wording on 2 minutes |
| 2 | Does every priced expected value agree with the spec? | One wrong value turns a defect into a green test | ❌ 17 of the 109 totals in sections A-F contradict it. A-04: 2500, spec 0 | ✅ 97 of 97 agree. TC-T8-05: 230000, spec 230000 |
| 3 | Does each of T1-T10 have a case that agrees with the spec? | A rule with no case is not tested at all | ✅ 10 of 10, one case per rule in the `A1 rules` line of the script, for example B-05 for T10. This count hides item 2 | ✅ 10 of 10, counts per rule in the `A2 rules` line of the script, for example TC-T9-01 for T9 |
| 4 | Is every point the spec leaves open shown as a question, with no value picked? | A silent choice becomes a product decision nobody made | ❌ C-04 states 875 for concession at night with no warning | ⚠️ TC-U-07 lists 875, 500 and 1250 with no value picked, but Q-4, Q-5, Q-8, Q-10 and Q-11 are not shown |
| 5 | Are the values that turn out wrong among the ones the draft marks as doubtful? | A warning only helps if it is on the right cases | ❌ 12 of the 17 wrong values have no mark. П3 even suggests halving the fee on D-14 | ✅ 97 of 97 priced cases agree, for example TC-T2-02, so no wrong values to mark |
| 6 | Does every boundary the spec names have a case on each side of it? | Most pricing defects sit on a boundary | ⚠️ Sides exist, but on the code's boundary: D-07 and D-08 test 24 h 29 s and 24 h 30 s | ✅ TC-T2-02 and TC-T2-03; TC-T8-02 and TC-T8-03 |
| 7 | Do the cases show that discounts leave fees untouched? | T5 and T10 apply to the time charge only | ❌ D-11 halves the T7 fee. D-04 is right for T10 | ✅ TC-T7-05, TC-T7-08, TC-T8-05 |
| 8 | Do the time cases separate Kyiv time from UTC, and winter from summer? | The rules use Kyiv time, instants arrive in UTC | ⚠️ B-01 and B-03 do it for T10, but F-07b asserts the UTC day for T6 | ⚠️ TC-T1-07 to TC-T1-09 carry offsets, all other cases are Kyiv wall-clock time only |
| 9 | Are expected results free of details the spec does not define? | Such a test breaks on a harmless change and proves nothing about the rules | ❌ G-08 expects the text `unknown bike type: scooter` | ✅ TC-E-02 expects only a rejected request |
| 10 | Does the draft file say whether its values were checked by a run? | An unchecked number must not read like a measured one | ✅ «Код не запускався.», near the top of the draft | ⚠️ «Автоматичний перерахунок не відбувся» is only in the final chat message, not in the draft body |
| 11 | Does the draft's own summary match the file? | A summary is what gets read first | ✅ «Набір із 134 тест-кейсів»: the file has 134 with the F steps grouped, 144 table rows | ✅ «119 рядків»: the file has 119 IDs |
| 12 | Does the set cover the receipt text required by T9? | The receipt is what the rider sees | ⚠️ H-01 and H-02 check only the last line | ❌ Section 13 lists «Формат чека (T9)» as not covered |
| 13 | Do the cases cover all four kinds of invalid data from section 4 of the spec? | A wrong input must not produce a price | ✅ G-07, G-08, G-10, G-15 | ✅ TC-E-01 to TC-E-04 |

## Conclusion

- What can be taken from A1 unchanged: inputs of the 70 priced cases that agree with the spec, for example C-07 to C-10, E-01, E-02 and the ledger steps F-01a to F-01d. Its П1 is a useful lead for Task B, and its П2 is an open question (Q-11). Its expected values cannot be trusted without a check against the spec.
- What can be taken from A2 unchanged: sections 1 to 11 (97 priced cases, 4 rounding cases, 5 invalid data cases). Its section 12 maps to Q-1, Q-2, Q-3, Q-6, Q-7 and Q-9 in `docs/test-cases.md`. It does not cover the receipt text.
- Items added after Task B or Task C: none yet.
