# Checklist for AI test artifacts

| # | Check | Why | A1 verdict and example | A2 verdict and example |
|---|---|---|---|---|
| 1 | Are expectations sourced to approved rules? | Avoid crystallizing defects | Fail: A1-05 cites code and bills 2 min | Pass: A2-03 cites T2 and expects 0 |
| 2 | Does duration round up for partial minutes? | Block-boundary money | Fail: A1-08 rounds down | Pass: A2-07 uses 31 min |
| 3 | Is the inclusive 2-minute boundary free? | Avoid false-start overcharge | Fail: A1-05 expects 2500 | Pass: A2-03 expects 0 |
| 4 | Are bike-specific subscription rules distinct? | Avoid free electric rides | Fail: A1-16 electric free minutes | Pass: A2-20 electric total 3200 |
| 5 | Are both fees excluded from concessions? | Avoid large undercharges | Fail: A1-36 halves both fees | Pass: A2-41 and A2-48 keep fees |
| 6 | Is the cap keyed to Kyiv pickup date? | Avoid incorrect date resets | Fail: A1-41 uses UTC date | Pass: A2-38 uses Kyiv date |
| 7 | Are undefined night combinations questions? | Avoid invented policy | Fail: A1-22/24/25 choose policy | Pass: A2-Q1..Q5 defer policy |
| 8 | Are all result-affecting inputs and state explicit? | Reproducibility | Pass: base, d, ledger records defined | Pass: common U1 data and prior charges |
| 9 | Are code API contracts separated from product expectations? | Avoid unsupported exception/schema requirements | Fail: A1-43..50 exact contracts | Pass: A2-53..56 require explanation only |
| 10 | Are monetary amounts integer kopecks? | Financial precision | Pass: A1-53 rounding example | Pass: rounding section gives 864 and 371 |
| 11 | Does every boundary expectation have a clear oracle? | Do not silently settle ambiguities | Fail: A1-22 crosses 06:00 | Partial: A2-45 needs Q-3 clarification |
| 12 | Do tests call the real SUT and verify exact prices? | Green tests can be meaningless | Not applicable to a case draft | Not applicable to a case draft; added after mock-only unit finding in Task C |

## Review conclusions

- Reuse A1 correct normal fares only after rechecking against specification; do not import its implementation contracts as product rules.
- Reuse A2 unambiguous cases; defer A2-45 pending clarification.
- Additional Task B/C checks: assert the real implementation, literal approved amounts, independent state, and no removed/weakened assertions for a green run.
- Participant sign-off remains required; these are agent-reviewed findings.
