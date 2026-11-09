# Test quality: coverage versus mutations

## 1. Before

Measurements pending Task C; do not infer test effectiveness from coverage alone.

## 2. Participant-side smell inventory (before independent AI review)

| Smell | File:line / test | Why it matters | AI found? |
|---|---|---|---|
| Weak assertion | app/test/unit/day-cap.test.js:9 / charges recorded for a day | Any decrease passes; exact remaining 18000 is unchecked | pending |
| Weak assertions | app/test/unit/tariff.test.js:20 / itemised price | A nonnegative wrong fare passes | pending |
| Mirrored implementation | app/test/unit/tariff.test.js:35 / e-bikes rate | Imports rate constants and recomputes formula; changing both can pass | pending |
| Weak assertions | app/test/unit/tariff.test.js:49 / long electric subscription | Any discount and any reduction pass | pending |
| Weak assertions | app/test/unit/tariff.test.js:70 / night | Does not assert 1750 | pending |
| Incomplete fee check | app/test/unit/tariff.test.js:76 / both fees | Only checks count, not codes or amounts | pending |
| Weak cap check | app/test/unit/tariff.test.js:88 / daily cap | Any final total below 30000 passes; expected 6000 unchecked | pending |
| Mocking SUT | app/test/unit/tariff.test.js:92 / 45-minute classic price | Tests a mock returning 5000; never calls quote | pending |
| Weak receipt check | app/test/unit/receipt-format.test.js:21 / every item | Count and substring do not prove labels/signs/order | pending |

## 3. Strengthening

Pending Task C.

## 4. Surviving mutants

Pending Task C.

## 5. Testing rules

Pending Task C.

## 6. Repeat with rules

Pending Task C.
