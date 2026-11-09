# Traceability: rules to test cases and automated tests

| Rule | Description | Test cases | Automated tests | Status | Notes |
|---|---|---|---|---|---|
| T1 | Elapsed duration ceil | TC-01, TC-02, TC-03 | app/test/spec/tariffs.test.js: named T1 tests with the listed TC IDs | Covered for unambiguous cases | See docs/test-cases.md |
| T2 | Inclusive false start | TC-04, TC-05, TC-06, TC-07 | app/test/spec/tariffs.test.js: named T2 tests with the listed TC IDs | Covered for unambiguous cases | See docs/test-cases.md |
| T3 | Started blocks and bike rate | TC-08, TC-09, TC-10, TC-11 | app/test/spec/tariffs.test.js: named T3 tests with the listed TC IDs | Covered for unambiguous cases | See docs/test-cases.md |
| T4 | Subscription | TC-12, TC-13, TC-14, TC-15, TC-16, TC-17 | app/test/spec/tariffs.test.js: named T4 tests with the listed TC IDs | Covered for unambiguous cases | See docs/test-cases.md |
| T5 | Concession and cheaper plan | TC-18, TC-19, TC-20, TC-21, TC-22, TC-23 | app/test/spec/tariffs.test.js: named T5 tests with the listed TC IDs | Covered for unambiguous cases | See docs/test-cases.md |
| T6 | Kyiv pickup-day cap | TC-24, TC-25, TC-26, TC-27, TC-28 | app/test/spec/tariffs.test.js: named T6 tests with the listed TC IDs | Covered for unambiguous cases | See docs/test-cases.md |
| T7 | Station zones and fee | TC-07, TC-22, TC-28, TC-29, TC-30, TC-33 | app/test/spec/tariffs.test.js: named T7 tests with the listed TC IDs | Covered for unambiguous cases | See docs/test-cases.md |
| T8 | Unreturned and independent fees | TC-23, TC-31, TC-32, TC-33 | app/test/spec/tariffs.test.js: named T8 tests with the listed TC IDs | Covered for unambiguous cases | Q-3 resolved mathematically |
| T9 | Kopecks and receipt | TC-34, TC-35, TC-36 | app/test/spec/tariffs.test.js: named T9 tests with the listed TC IDs | Covered for unambiguous cases | Q-4/Q-5 remain open |
| T10 | Night discount | TC-37, TC-38, TC-39 | app/test/spec/tariffs.test.js: named T10 tests with the listed TC IDs | Covered for unambiguous cases | Q-1/Q-2 remain open |

- Rules covered by reviewed cases: 10/10.
- Rules covered by automated tests: 10/10, restricted to unambiguous behavior.
- Q-1/Q-2: no crossing-boundary or combined-plan night total expectations.
- Q-3 resolved: T1 ceil and T8 threshold give the same result for 24 h plus any positive fraction; the current suite uses exact 24 h and 24 h 1 min representatives.
- Q-4/Q-5: no zero discount-line or exact receipt padding expectation.
- Invalid requests: TC-40 through TC-43 additionally cover specification lines 147-149.
