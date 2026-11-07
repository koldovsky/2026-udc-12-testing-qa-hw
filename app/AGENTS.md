# AGENTS.md — app/

Rules for an agent that writes or changes tests of this app. The product specification is
`docs/spec/tariffs.md` (rules T1–T10).

## Тести

1. **The oracle is the specification.** Take every expected value from `docs/spec/tariffs.md`
   and put the rule ID in the test name (`T3: …`) and the spec line next to the value. Never take
   an expected value from what the code currently returns. If the spec is not available, or gives
   no single answer, do not write that expected value: list the case as an open question for the
   product owner instead.
2. **No expected value built from the code.** Do not compute expectations with the code's own
   constants or formulas (`RATES`, `BLOCK_MINUTES`, `DAY_CAP`, `Math.ceil(minutes / BLOCK_MINUTES)`).
   Write the literal number from the spec: `12000`, not `3 * RATES.ebike`.
3. **Exact values, not directions.** Where the spec gives a number, assert that number
   (`assert.equal(result.total, 1750)`). Do not replace it with `<`, `<=`, `>= 0`, `typeof`,
   `Array.isArray` or a `length` check.
4. **Test the real unit.** Call the function under test. Never assert on a mock's own return
   value or call count instead of the result of the code.
5. **Both sides of every boundary.** Each boundary the spec names (2 min, 45 min, 30-min blocks,
   24 h, the daily cap) gets one case on each side, as separate rows of a data table with the case
   in the test name, not several cases hidden in one loop.
6. **Kyiv time in the test data.** Rules that depend on the day or the hour use instants where the
   Kyiv date or hour differs from UTC (`2026-09-16T21:30:00Z` is 00:30 on 17.09 in Kyiv), or an
   explicit offset (`2026-09-17T00:30:00+03:00`).
7. **Do not test what the spec does not define.** No assertions on error texts, the order of
   `fees` or `discounts`, lines with a zero amount, or which date formats are accepted. These are
   questions for the product owner, not tests.
8. **Never make a test pass by changing it.** Do not delete, skip (`skip` / `todo`) or weaken a
   test, and do not change an assertion or an expected value to make it pass. If an expected value
   is wrong, change it only with the spec line that gives the right one, and say so.
