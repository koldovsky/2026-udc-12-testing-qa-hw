# Test cases: ride price calculation

Every expected result comes from `docs/spec/tariffs.md`, with the spec line next to it.
Where the spec gives no single answer, there is no test case: the point is listed under
"Questions for the specification".

## Conventions

Unless a case says otherwise:

- Rider: standard, one rider (`R1`), no earlier rides on that Kyiv day.
- Bike: classic.
- Pickup: `2026-09-16T07:00:00Z` (10:00 Kyiv). "N min" means return = pickup + N minutes.
- Return station: `S03` (in zone).

Amounts are integer kopecks. `time` is the time charge after discounts (T4, T5, T10) and
the daily cap (T6), `fees` is the sum of T7 and T8 fees, `total` is the amount payable.
`time` equals `total` minus `fees`. It is not the `timeCharge` field of `quote`, which holds
the T3 price before discounts (`app/src/tariff.js:12`).
"At cap" means the rider already has 30000 in time charges on that Kyiv day (the three
rides of TC-45).

Clock times are Kyiv wall-clock time. The UTC instant is given wherever the offset matters.
The dates of the clock changes in TC-07, TC-08 and TC-98 come from the Europe/Kyiv time zone
(`docs/spec/tariffs.md:37`), not from the spec text. Their expected durations follow from the
UTC instants alone.
Text in `грн` and `До сплати` is the exact receipt wording required by the spec.

No expected value depends on Q-1 to Q-3. Only TC-69 and TC-100 combine T10 with T4 or T5: they
cross the night window, and their charge stays above the cap under every reading of Q-1 and Q-3.
Rides that cross the night window are chosen so that the daily cap gives the same result
under every reading of Q-1. TC-78 does not state the receipt lines that depend on Q-1.

Priority follows the risk for the rider's money:

- high: a defect here charges the wrong amount on an ordinary ride, or this case is the main
  guard of a rule, a fee or a rejection.
- medium: another high case guards the same behaviour, the ride is rare, or only the receipt
  is affected.
- low: a further check of a step that no ride reaches at current prices.

Rows are grouped by rule, so the IDs added last (TC-89 to TC-101) stand in their rule's block.

## Test cases

| ID | Rule | Technique | Input | Expected result (per spec) | Spec line | Priority |
|---|---|---|---|---|---|---|
| TC-01 | T1 | EP | Pickup 10:00:00, return 10:12:40 | Duration 13 min | `docs/spec/tariffs.md:49` | medium |
| TC-02 | T1 | EP | Pickup 14:05:00, return 14:41:00 | Duration 36 min | `docs/spec/tariffs.md:50` | medium |
| TC-03 | T1 | EP | Pickup 10:00:40, return 10:30:40 | Duration 30 min: the elapsed time is rounded, not each moment. `time` 2500 | `docs/spec/tariffs.md:45-46` | medium |
| TC-04 | T1 | BVA | Return = pickup + 30 min 00 s | Duration 30 min, 1 block, `time` 2500 | `docs/spec/tariffs.md:46, 62` | high |
| TC-05 | T1 | BVA | Return = pickup + 30 min 01 s | Duration 31 min, 2 blocks, `time` 5000 | `docs/spec/tariffs.md:46, 62` | high |
| TC-06 | T1 | BVA | Return = pickup + 12 min 00.001 s | Duration 13 min | `docs/spec/tariffs.md:46` | medium |
| TC-07 | T1 | States and time | Pickup `2026-10-24T23:30:00Z` (02:30 summer time), return `2026-10-25T01:30:00Z` (03:30 winter time) | Duration 120 min: elapsed time, not the 60 min the wall clock shows | `docs/spec/tariffs.md:37, 45` | medium |
| TC-08 | T1 | States and time | Pickup `2026-10-25T00:50:00Z` (03:50 summer time), return `2026-10-25T01:10:00Z` (03:10 winter time) | Accepted: the clock shows an earlier time, but the return is 20 min later in real time. Duration 20 min | `docs/spec/tariffs.md:37, 45, 147-148` | medium |
| TC-98 | T1 | States and time | Pickup `2027-03-28T00:50:00Z` (02:50 winter time), return `2027-03-28T01:10:00Z` (04:10 summer time) | Duration 20 min: elapsed time, not the 80 min the wall clock shows | `docs/spec/tariffs.md:37, 45` | medium |
| TC-09 | T1 (§4) | BVA | Return = pickup - 1 s | Request rejected with an explanation, no price calculated | `docs/spec/tariffs.md:147-148` | high |
| TC-10 | T1 (§4) | BVA | Return = pickup | Accepted: duration 0 min, `time` 0 | `docs/spec/tariffs.md:54, 147-148` | medium |
| TC-11 | T2 | EP | Return = pickup + 50 s | Duration 1 min, `time` 0 | `docs/spec/tariffs.md:57` | medium |
| TC-12 | T2 | BVA | Return = pickup + 2 min 00 s | Duration 2 min, `time` 0 | `docs/spec/tariffs.md:54` | high |
| TC-13 | T2 | BVA | Return = pickup + 2 min 01 s | Duration 3 min, 1 block, `time` 2500 | `docs/spec/tariffs.md:46, 54` | high |
| TC-14 | T2 | EP | 4 min | 1 block, `time` 2500 | `docs/spec/tariffs.md:58` | medium |
| TC-15 | T2 | Decision table | E-bike, 2 min | `time` 0 | `docs/spec/tariffs.md:54` | medium |
| TC-16 | T2 | Decision table | 1 min, return `X01` | `time` 0, `fees` 15000, `total` 15000 | `docs/spec/tariffs.md:55, 112` | high |
| TC-90 | T2 | Decision table | Subscriber, e-bike, 2 min | No charge, so nothing to discount: `time` 0 | `docs/spec/tariffs.md:54` | medium |
| TC-17 | T3 | EP | Classic, 50 min | 2 blocks, `time` 5000 | `docs/spec/tariffs.md:69` | high |
| TC-18 | T3 | EP | E-bike, 75 min | 3 blocks, `time` 12000 | `docs/spec/tariffs.md:70` | high |
| TC-19 | T3 | BVA | Classic, 60 min | 2 blocks, `time` 5000 | `docs/spec/tariffs.md:62, 66` | medium |
| TC-20 | T3 | BVA | Classic, 61 min | 3 blocks, `time` 7500 | `docs/spec/tariffs.md:62, 66` | medium |
| TC-21 | T3 | BVA | E-bike, 30 min | 1 block, `time` 4000 | `docs/spec/tariffs.md:62, 67` | medium |
| TC-22 | T3 | BVA | E-bike, 31 min | 2 blocks, `time` 8000 | `docs/spec/tariffs.md:62, 67` | medium |
| TC-23 | T3 (§4) | EP | Bike type `scooter` | Request rejected with an explanation | `docs/spec/tariffs.md:147-148` | high |
| TC-24 | T4 | EP | Subscriber, classic, 40 min | `time` 0 | `docs/spec/tariffs.md:81` | medium |
| TC-25 | T4 | BVA | Subscriber, classic, 45 min | `time` 0 | `docs/spec/tariffs.md:74` | high |
| TC-26 | T4 | BVA | Subscriber, classic, 46 min | 1 paid min, 1 block, `time` 2500 | `docs/spec/tariffs.md:74-75` | high |
| TC-27 | T4 | BVA | Subscriber, classic, 75 min | 30 paid min, 1 block, `time` 2500 | `docs/spec/tariffs.md:74-75` | medium |
| TC-28 | T4 | BVA | Subscriber, classic, 76 min | 31 paid min, 2 blocks, `time` 5000 | `docs/spec/tariffs.md:74-75` | medium |
| TC-29 | T4 | EP | Subscriber, classic, 100 min | 55 paid min, 2 blocks, `time` 5000 | `docs/spec/tariffs.md:82` | high |
| TC-30 | T4 | EP | Subscriber, e-bike, 30 min | 4000 - 20 %, `time` 3200 | `docs/spec/tariffs.md:76` | high |
| TC-31 | T4 | EP | Subscriber, e-bike, 40 min | No free minutes: 2 blocks, 8000 - 20 %, `time` 6400 | `docs/spec/tariffs.md:76-77` | high |
| TC-32 | T4 | EP | Subscriber, e-bike, 75 min | 12000 - 20 %, `time` 9600 | `docs/spec/tariffs.md:76` | medium |
| TC-33 | T4 | States and time | Subscriber, classic, two rides of 40 min on one day, pickups `2026-09-16T07:00:00Z`, `2026-09-16T10:00:00Z` | Free minutes apply to each ride: `time` 0 on both | `docs/spec/tariffs.md:74` | medium |
| TC-34 | T5 | EP | Concession, classic, 40 min | 2 blocks, 5000 - 50 %, `time` 2500 | `docs/spec/tariffs.md:93` | high |
| TC-35 | T5 | EP | Concession, e-bike, 30 min | 4000 - 50 %, `time` 2000 | `docs/spec/tariffs.md:86` | medium |
| TC-36 | T5 | Decision table | Subscriber with concession, classic, 80 min | Subscription 5000, concession 3750: `time` 3750, concession applied, discounts not added together | `docs/spec/tariffs.md:94-96` | high |
| TC-37 | T5 | Decision table | Subscriber with concession, classic, 40 min | Subscription 0, concession 2500: `time` 0, subscription applied | `docs/spec/tariffs.md:89-90` | high |
| TC-38 | T5 | Decision table | Subscriber with concession, classic, 60 min | Subscription 2500, concession 2500, a tie: `time` 2500, subscription applied, no concession discount | `docs/spec/tariffs.md:90-91` | high |
| TC-39 | T5 | Decision table | Subscriber with concession, classic, 91 min | Subscription 5000, concession 5000, a tie: `time` 5000, subscription applied, no concession discount | `docs/spec/tariffs.md:90-91` | medium |
| TC-40 | T5 | BVA | Subscriber with concession, classic, 75 min | Subscription 2500, concession 3750: `time` 2500, subscription applied | `docs/spec/tariffs.md:89-90` | medium |
| TC-41 | T5 | BVA | Subscriber with concession, classic, 76 min | Subscription 5000, concession 3750: `time` 3750, concession applied | `docs/spec/tariffs.md:89-90` | medium |
| TC-42 | T5 | Decision table | Subscriber with concession, e-bike, 30 min | Subscription 3200, concession 2000: `time` 2000, concession applied | `docs/spec/tariffs.md:89-90` | medium |
| TC-91 | T5 | Decision table | Subscriber with concession, e-bike, 2 min | Subscription 0, concession 0, a tie: `time` 0 | `docs/spec/tariffs.md:54, 90-91` | medium |
| TC-43 | T5 | Decision table | Concession, 20 min, return `X01` | `time` 1250, `fees` 15000 with no discount, `total` 16250 | `docs/spec/tariffs.md:86-87` | high |
| TC-99 | T5 | Decision table | Subscriber with concession, classic, 80 min, return `X01` | Concession applied as in TC-36: `time` 3750, `fees` 15000 with no discount, `total` 18750 | `docs/spec/tariffs.md:87, 94-96, 112` | medium |
| TC-101 | T5 | Decision table | Concession, 1 min, return `X01` | False start, no time charge to discount: `time` 0, `fees` 15000 with no discount, `total` 15000 | `docs/spec/tariffs.md:55, 87, 112` | medium |
| TC-44 | T5 (§4) | EP | Rider category `vip` | Request rejected with an explanation | `docs/spec/tariffs.md:147-148` | high |
| TC-45 | T6 | States and time | Three e-bike rides of 80 min, pickups `2026-09-16T06:00:00Z`, `10:00:00Z`, `15:00:00Z` (09:00, 13:00, 18:00) | `time` 12000, 12000, 6000: day total 30000 | `docs/spec/tariffs.md:105-106` | high |
| TC-46 | T6 | BVA | At cap, classic, 30 min, pickup `2026-09-16T18:00:00Z` | Full price 2500 reduced by the cap: `time` 0 | `docs/spec/tariffs.md:100-101` | high |
| TC-47 | T6 | BVA | Classic, 360 min | 12 blocks, `time` 30000, no cap reduction | `docs/spec/tariffs.md:100-101` | medium |
| TC-48 | T6 | BVA | Classic, 361 min | 13 blocks = 32500, `time` 30000, cap reduction 2500 | `docs/spec/tariffs.md:100-101` | high |
| TC-49 | T6 | Decision table | E-bike, pickup `2026-09-16T21:10:00Z` (00:10 on 17.09), return `2026-09-17T02:50:00Z` (05:50) | 340 min, 12 blocks = 48000, night 33600, then the cap: `time` 30000, cap reduction 3600 | `docs/spec/tariffs.md:100-101, 141` | high |
| TC-50 | T6 | States and time | At cap on 16.09, then classic, 30 min, pickup `2026-09-17T07:00:00Z` | New day, new cap: `time` 2500 | `docs/spec/tariffs.md:34, 100-101` | medium |
| TC-51 | T6 | States and time | At cap on 16.09, then classic, pickup `2026-09-16T21:30:00Z` (00:30 on 17.09), return `2026-09-16T22:00:00Z` (01:00) | The Kyiv date decides, not the UTC date: not capped, night ride, `time` 1750 | `docs/spec/tariffs.md:34, 101-102, 141` | high |
| TC-52 | T6 | BVA | At cap on 16.09, then classic, 30 min, pickup `2026-09-16T20:59:59Z` (23:59:59) | Last second of 16.09: the ride counts towards the capped day, `time` 0 | `docs/spec/tariffs.md:34, 101-102` | medium |
| TC-97 | T6 | BVA | At cap on 16.09, then classic, pickup `2026-09-16T21:00:00Z` (00:00:00 on 17.09), return `2026-09-16T21:30:00Z` (00:30) | First moment of 17.09: not capped, night ride, `time` 1750 | `docs/spec/tariffs.md:34, 101-102, 141` | medium |
| TC-53 | T6 | States and time | Rides on 16.09: e-bike 80 min (`06:00:00Z`), e-bike 80 min (`10:00:00Z`), classic 50 min (`15:00:00Z`), 29000 in total. Then classic, pickup `2026-09-16T20:40:00Z` (23:40), return `2026-09-16T21:20:00Z` (00:20 on 17.09) | The ride counts towards 16.09: `time` 1000, the rest of that day's cap. Every reading of Q-1 prices the ride above 1000 before the cap, so the result does not depend on it | `docs/spec/tariffs.md:101-102, 107` | high |
| TC-54 | T6 | States and time | After TC-53, classic, 360 min, pickup `2026-09-17T07:00:00Z` | Nothing from TC-53 counts towards 17.09: `time` 30000, no cap reduction | `docs/spec/tariffs.md:101-102, 107` | medium |
| TC-55 | T6 | EP | `R1` at cap, then rider `R2`, classic, 30 min, pickup `2026-09-16T18:00:00Z` | The cap is per rider: `time` 2500 for `R2` | `docs/spec/tariffs.md:100-101` | high |
| TC-56 | T6 | States and time | Concession, four e-bike rides of 80 min on one day, pickups `06:00:00Z`, `08:00:00Z`, `10:00:00Z`, `12:00:00Z` | The cap counts amounts after discounts: `time` 6000 on each of the four rides | `docs/spec/tariffs.md:100-101` | high |
| TC-94 | T6 | Decision table | Subscriber, e-bike, 300 min | 10 blocks = 40000, 20 % off = 32000, then the cap: `time` 30000, cap reduction 2000 | `docs/spec/tariffs.md:67, 76, 100-101` | high |
| TC-57 | T6 | States and time | Classic 20 min, return `X01` (`06:00:00Z`), then three e-bike rides of 80 min (`07:00:00Z`, `10:00:00Z`, `15:00:00Z`) | Fees do not use up the cap: `time` 2500, 12000, 12000, 3500; `fees` 15000 on the first ride only | `docs/spec/tariffs.md:102-103` | high |
| TC-58 | T6 | Decision table | At cap, classic, 20 min, pickup `2026-09-16T18:00:00Z`, return `X01` | The cap does not limit fees: `time` 0, `fees` 15000, `total` 15000 | `docs/spec/tariffs.md:102-103` | high |
| TC-59 | T7 | EP | 20 min, return `X01` | `time` 2500, `fees` 15000, `total` 17500 | `docs/spec/tariffs.md:114-115` | high |
| TC-60 | T7 | EP | 20 min, return at each of `S01`-`S08` (one automated row per station) | `fees` 0, `total` 2500 | `docs/spec/tariffs.md:166-173` | high |
| TC-61 | T7 | EP | 20 min, return at each of `X01`, `X02`, `X03` (one automated row per station) | `fees` 15000, `total` 17500 | `docs/spec/tariffs.md:174-176` | high |
| TC-62 | T7 | Decision table | Subscriber, e-bike, 30 min, return `X01` | `time` 3200, `fees` 15000 with no discount, `total` 18200 | `docs/spec/tariffs.md:76, 112` | medium |
| TC-63 | T7 (§4) | EP | Return station `S09` | Request rejected with an explanation | `docs/spec/tariffs.md:147-149` | high |
| TC-64 | T7 (§4) | EP | Return station `X04` | Request rejected with an explanation | `docs/spec/tariffs.md:147-149` | medium |
| TC-65 | T8 | EP | 25 h | 50 blocks = 125000, `time` 30000, `fees` 200000, `total` 230000 | `docs/spec/tariffs.md:124-125` | high |
| TC-66 | T8 | BVA | Exactly 24 h | 48 blocks = 120000, `time` 30000, no T8 fee, `total` 30000 | `docs/spec/tariffs.md:119` | high |
| TC-67 | T8 | BVA | 24 h 00 min 01 s | Duration 1441 min, 49 blocks, `time` 30000, `fees` 200000, `total` 230000 | `docs/spec/tariffs.md:46, 119-120` | high |
| TC-68 | T8 | Decision table | 25 h, return `X02` | Both fees: `time` 30000, `fees` 215000, `total` 245000 | `docs/spec/tariffs.md:121-122` | high |
| TC-69 | T8 | Decision table | Concession, e-bike, 25 h | 200000 - 50 % = 100000, capped after the discount: `time` 30000, `fees` 200000 with no discount, `total` 230000 | `docs/spec/tariffs.md:67, 87, 100-101, 120` | high |
| TC-100 | T8 | Decision table | Concession, e-bike, 25 h, return `X01` | 200000 - 50 % = 100000, capped after the discount: `time` 30000, both fees with no discount: `fees` 215000, `total` 245000 | `docs/spec/tariffs.md:67, 87, 100-101, 120-122` | medium |
| TC-70 | T8 | Decision table | At cap, 25 h, pickup `2026-09-16T18:00:00Z` | `time` 0, `fees` 200000, `total` 200000 | `docs/spec/tariffs.md:102-103, 120` | medium |
| TC-71 | T8 | EP | 72 h | The whole ride belongs to the pickup day, the fee is flat: `time` 30000, `fees` 200000, `total` 230000 | `docs/spec/tariffs.md:101-102, 119-120` | medium |
| TC-72 | T9 | BVA | 30 % discount on 1235, applied directly to the rounding step | Payable 864 (864.5 rounded down), discount 371 | `docs/spec/tariffs.md:129-130, 137` | high |
| TC-73 | T9 | BVA | 50 % discount on 999, applied directly to the rounding step | Payable 499 (499.5 rounded down), discount 500 | `docs/spec/tariffs.md:129-130` | low |
| TC-74 | T9 | BVA | 50 % discount on 1, applied directly to the rounding step | Payable 0, discount 1 | `docs/spec/tariffs.md:129-130` | low |
| TC-75 | T9 | EP | Receipt amount 230000 | `2 300,00 грн` | `docs/spec/tariffs.md:133` | medium |
| TC-76 | T9 | BVA | Receipt amounts 99999 and 100000 | `999,99 грн` and `1 000,00 грн` | `docs/spec/tariffs.md:132-133` | medium |
| TC-77 | T9 | BVA | Receipt amounts 0, 5 and 1750 | `0,00 грн`, `0,05 грн`, `17,50 грн` | `docs/spec/tariffs.md:132-133` | medium |
| TC-78 | T9 | Decision table | Receipt for a 25 h ride returned at `X01` | Duration 1500 min; T3 line `1 250,00 грн`; a cap line with a minus sign; T7 line `150,00 грн`; T8 line `2 000,00 грн`; summary line `До сплати` with `2 450,00 грн`. The amount of the cap line and any night line depend on Q-1 and are not asserted | `docs/spec/tariffs.md:133-135` | high |
| TC-79 | T9 | Decision table | Receipt for concession, classic, 40 min | T3 line `50,00 грн`; discount line with a minus sign, `25,00 грн`; `До сплати` with `25,00 грн` | `docs/spec/tariffs.md:93, 133-135` | medium |
| TC-80 | T9 | Decision table | Receipt for classic, 50 min | T3 line `50,00 грн`; `До сплати` with `50,00 грн`; no discount, cap or fee lines | `docs/spec/tariffs.md:133-135` | medium |
| TC-89 | T9 | Decision table | Receipt for classic, 361 min, return `X01` | Duration 361 min; T3 line `325,00 грн`; cap line with a minus sign, `25,00 грн`; T7 line `150,00 грн`; summary line `До сплати` with `450,00 грн` | `docs/spec/tariffs.md:133-135` | medium |
| TC-95 | T9 | Decision table | Receipt for the ride of TC-81 | T3 line `25,00 грн`; discount line with a minus sign, `7,50 грн`; `До сплати` with `17,50 грн` | `docs/spec/tariffs.md:133-135, 143` | medium |
| TC-96 | T9 | Decision table | Receipt for subscriber, e-bike, 30 min | T3 line `40,00 грн`; discount line with a minus sign, `8,00 грн`; `До сплати` with `32,00 грн`. The discount is a percentage, so Q-4 does not apply | `docs/spec/tariffs.md:67, 76, 133-135` | medium |
| TC-81 | T10 | EP | Pickup `2026-09-16T22:10:00Z` (01:10 on 17.09), return `2026-09-16T22:40:00Z` (01:40) | 2500 - 30 %, `time` 1750 | `docs/spec/tariffs.md:143` | high |
| TC-82 | T10 | EP | E-bike, same times as TC-81 | 4000 - 30 %, `time` 2800 | `docs/spec/tariffs.md:67, 141` | medium |
| TC-83 | T10 | BVA | Pickup `2026-09-16T21:00:00Z` (00:00 on 17.09), return `2026-09-16T21:30:00Z` (00:30) | First moment of the window, "from 00:00": `time` 1750 | `docs/spec/tariffs.md:141` | high |
| TC-84 | T10 | BVA | Pickup `2026-09-17T02:29:00Z` (05:29), return `2026-09-17T02:59:00Z` (05:59) | Whole ride before 06:00: `time` 1750 | `docs/spec/tariffs.md:141` | high |
| TC-92 | T10 | BVA | Pickup `2026-09-16T03:01:00Z` (06:01), return `2026-09-16T03:31:00Z` (06:31) | Whole ride after the window: no discount, `time` 2500 | `docs/spec/tariffs.md:141` | high |
| TC-93 | T10 | BVA | Pickup `2026-09-16T20:29:00Z` (23:29), return `2026-09-16T20:59:00Z` (23:59) | Whole ride before the window: no discount, `time` 2500 | `docs/spec/tariffs.md:141` | medium |
| TC-85 | T10 | States and time | Pickup `2026-12-16T03:10:00Z` (05:10 winter time), return `2026-12-16T03:40:00Z` (05:40) | Kyiv offset is +2 in winter, the ride is at night: `time` 1750 | `docs/spec/tariffs.md:37, 141` | high |
| TC-86 | T10 | States and time | Pickup `2026-09-16T04:00:00Z` (07:00), return `2026-09-16T04:30:00Z` (07:30) | Night by UTC, day by Kyiv time: no discount, `time` 2500 | `docs/spec/tariffs.md:37, 141` | high |
| TC-87 | T10 | Decision table | Same times as TC-81, return `X01` | The discount does not touch fees: `time` 1750, `fees` 15000, `total` 16750 | `docs/spec/tariffs.md:31, 112, 141` | high |
| TC-88 | T10 | Decision table | Pickup `2026-09-16T22:10:00Z` (01:10 on 17.09), 1 min | False start wins: `time` 0 | `docs/spec/tariffs.md:54` | medium |

TC-72 tests the rounding step on its own. T3 prices cannot reach it through a full ride:
2500 and 4000 with 20 %, 30 % or 50 % off always give whole kopecks.

## Questions for the specification

These points have no test case and no automated test until the product owner answers.

| # | Rule | What is unclear | Possible readings | Who to ask |
|---|---|---|---|---|
| Q-1 | T10 | Line 141 says "night rides from 00:00 to 06:00" but not what makes a ride a night ride when only part of it is in that window (pickup 05:50, return 06:20; pickup 23:50, return 00:20). | (1) The pickup moment decides. (2) The whole ride must be inside the window. (3) The discount covers only the part inside the window. (4) Any overlap with the window gives the discount on the whole ride. (5) Each block is priced by the moment it starts. | Product owner |
| Q-2 | T10 | Line 141 says "from 00:00 to 06:00". "From 00:00" includes 00:00 (TC-83), but it is not stated whether 06:00 belongs to the window: a pickup at exactly 06:00:00, a return at exactly 06:00:00. | (1) 06:00 is outside the window. (2) 06:00 is inside the window. | Product owner |
| Q-3 | T10, T4, T5 | Line 89 rules out adding T4 and T5 together, but nothing says how T10 combines with them. Concession, classic, 01:10-01:40, 2500 before discounts. A subscriber on an e-bike and a classic subscriber's paid blocks raise the same question, and so does the "lower amount" comparison on line 90: before or after T10? | (1) One after another: 2500 x 0.5 x 0.7 = 875. (2) Added: 80 % off = 500. (3) Only the larger discount: 1250. | Product owner, financial controller |
| Q-4 | T9, T2, T4, T5 | Line 134 requires a T3 line and a separate line for each discount. It is not clear what these show for T4 free minutes and for a T2 false start. Subscriber, classic, 100 min: 4 blocks with a free-minutes line, or 2 blocks with no discount line? | (1) T3 line shows all blocks, free time is a minus line: `100,00 грн`, then minus `50,00 грн`. (2) T3 line shows paid blocks only: `50,00 грн`, no discount line. | Product owner, financial controller |
| Q-5 | T9 | Line 134 says "with a minus sign" but not which character, and only `До сплати` has fixed wording. Spec examples use `−` (U+2212). | (1) `−` (U+2212) as in the spec. (2) `-` (ASCII hyphen). Wording of other lines: fixed by the owner, or free. | Product owner |
| Q-6 | T8 | T8 is named "unreturned bike" but is worded as "the ride lasts over 24 hours". The spec does not say what happens while the bike is still out, when no return moment or return station exists. | (1) The fee is charged only once the bike is returned. (2) The fee is charged after 24 h, the rest is calculated at return. | Product owner, head of operations |
| Q-7 | T6 | The example on lines 105-106 has rides in sequence. If one rider's rides overlap or are recorded out of pickup order, the day total is still capped, but which ride gets the remaining cap is not stated. It is also not stated whether a rider can hold two bikes at once. | (1) Order of pickup. (2) Order of return. (3) Order of calculation. | Product owner |
| Q-8 | §4 | Lines 147-149 list the invalid data. A missing or unreadable pickup or return moment is not on the list. | (1) Rejected like the other invalid data. (2) Handled some other way, for example by support. | Product owner |
| Q-9 | Version | Line 8 gives the effective date, 2026-09-15, but not which version prices a ride that starts before that date and ends on or after it. Version 3 changed the cap, the T7 fee and T10 (lines 153-155). | (1) The pickup moment decides. (2) The return moment decides. | Product owner, community lawyer |
| Q-10 | T6 | Line 100 caps the sum of time charges, but does not say what happens when the same ride is calculated twice, for example a repeated request or a preview. | (1) A ride counts towards the cap once. (2) Every calculation counts. | Product owner |
| Q-11 | T6 | Line 100 caps the sum per rider and day, but the spec does not mention the API. `POST /api/quote` passes no ledger (`server.js:33`), and its documented request has no rider id (`app/README.md:28`). It is not stated whether a request is a charged ride or only a price calculation. | (1) A price calculation: the day total is kept elsewhere. (2) A charged ride: every request counts towards the day total, so the API needs a rider id. | Product owner |

## Comparison of the AI drafts

Drafts: `ai-runs/a1-from-code.md` (code only) and `ai-runs/a2-from-spec.md` (spec only).

Run notes from the session logs: the A1 agent edited its own draft with `Edit` after `Write`.
The edit added `2000` to the list of multiples in the intro of section I and changed no
expected value. The A1 log has a lost connection (`api_error`, 08:34:43 UTC) and one automatic
reminder (`silent_turn_reminder`, 08:35:20 UTC). The A2 log has one automatic harness message
after a cut-off response (`isMeta: true`, 08:34:43 UTC). None of these is a participant hint.

The logs stay on the participant's machine, outside the repo. `A1` and `A2` below hold the paths
of the two session logs:

```bash
grep -c '"subtype":"api_error"' "$A1"
grep -c '"type":"silent_turn_reminder"' "$A1"
grep -o '"type":"tool_use","id":"[^"]*","name":"Edit"' "$A1" | sort -u | wc -l
grep -c '"isMeta":true' "$A2"
```

Each of the four commands prints 1.

| Metric | A1 - from code | A2 - from spec |
|---|---|---|
| Rules covered (of 10) | 10 | 10 |
| Expectations not in the spec | 13 | 0 |
| Ambiguities marked as questions | 4 | 6 |

A rule is covered when at least one case checks it with an expectation that agrees with the
spec. Coverage of A1 is 10 of 10 by this definition, although the same draft contradicts the
spec on T1, T2, T4, T5 and T6. The `A1 rules` and `A2 rules` lines of the script output below
show the cases behind both counts.

"Expectations not in the spec" counts distinct behaviours, one per row of the next section.

Ambiguities marked as questions:

- A1: П2 (Q-11), П6 (Q-1), П8 (Q-10) and the closing note on `2026-02-30` (Q-8). The spec
  answers П1 and П3-П5, and П7 is about the code only.
- A2: sections 12.1 (Q-1), 12.2 (Q-2), 12.3 (Q-3) and TC-U-11 to TC-U-13 (Q-7, Q-6, Q-9).

Summary lines of the script on the code from `main`. Before the Task B fixes the command is
`node docs/evidence/task-a-check.mjs`. After them it needs a copy of that code:

```bash
mkdir -p ../ws12-main && git archive main app | tar -x -C ../ws12-main
node docs/evidence/task-a-check.mjs ../ws12-main/app/src
```

```text
A1: 144 case IDs, 109 with a price
A1 vs code: 109 of 109 totals match
A1 vs spec: 70 agree, 17 contradict, 16 depend on Q-1 to Q-3, 6 have inputs the spec does not define
A1 contradictions: 5 flagged by the draft, 12 stated with no warning
A1 dates: 108 of 109 priced cases are before 2026-09-15
A1 rules: 10 of 10 have an agreeing case: T1 A-07, T2 A-01, T3 A-05, T4 C-07, T5 C-01, T6 E-02, T7 D-02, T8 D-06, T9 I-02, T10 B-05
A2: 119 case IDs, 97 with a price, 4 rounding, 5 invalid data, 13 with no expected value
A2 vs spec: 97 agree, 0 contradict, 0 depend on Q-1 to Q-3
A2 rules: 10 of 10 have agreeing cases: T1 9, T2 9, T3 6, T4 11, T5 12, T6 23, T7 9, T8 10, T9 4, T10 8
```

"109 with a price" means sections A-F of the draft. H-01 to H-03 repeat prices through the API
and are not counted.

All 109 priced A1 values equal the output of the code, including the 17 that contradict the
spec. The A1 session did not run the code, it derived the values by reading it.

The script compares totals only. A-02 and A-15 are among the 70 that agree, but their `m=1`
contradicts T1: 1 min 29 s is 2 min (`docs/spec/tariffs.md:46`).

108 of the 109 priced A1 cases are dated before 2026-09-15, when version 3 took effect
(`docs/spec/tariffs.md:8`), as the `A1 dates` line shows. They are compared with version 3 as
sample dates. This is an assumption.

## What the AI invented

Expectations from the AI drafts that the spec does not contain. A2 has none: all 97 priced
cases agree with the spec, and its 13 `TC-U` cases list readings without choosing one.

Line numbers of `tariff.js` and `day-cap.js` in this table are for the code on `main` (`4606c72`),
the code the drafts read. The Task B fixes moved them.

| Draft | AI case | What was invented | What the spec says (line) |
|---|---|---|---|
| A1 | A-02, A-06, A-15, D-07 | Minutes are rounded to the nearest (`tariff.js:71`): 30 min 29 s is 30 min, 24 h 29 s has no T8 fee | Always rounded up: `docs/spec/tariffs.md:46` |
| A1 | A-03, A-04, A-11 | A ride of exactly 2 min is paid (`tariff.js:79`) | "Not more than 2 minutes" is free: `docs/spec/tariffs.md:54` |
| A1 | C-11, C-12, C-13, C-14, C-21 | A subscriber on an e-bike gets 45 free minutes, then 20 % off (`tariff.js:84-85`) | 20 % off the T3 charge, no free minutes: `docs/spec/tariffs.md:76-77` |
| A1 | D-11, D-12, D-13, D-19, D-20 | The concession halves T7 and T8 fees (`tariff.js:63-65`) | The concession does not apply to fees: `docs/spec/tariffs.md:87` |
| A1 | F-06, F-07 | The cap day is the UTC date (`day-cap.js:7`) | The cap day is the Kyiv date of the pickup: `docs/spec/tariffs.md:34, 101-102` |
| A1 | H-03 | Through the API the cap does not build up between rides (`server.js:33`) | Not stated, see Q-11: `docs/spec/tariffs.md:100-101` |
| A1 | B-01, B-03, B-06, B-07, B-08, E-05, E-08, E-09, F-05a, F-06a | Only the pickup moment makes a ride a night ride (`tariff.js:50`) | Not stated, see Q-1: `docs/spec/tariffs.md:141` |
| A1 | B-02, B-04, B-09 | 06:00 is outside the window for a pickup, and a return at 06:00 keeps the discount (`tariff.js:50`) | Not stated, see Q-2: `docs/spec/tariffs.md:141` |
| A1 | C-04, C-05, C-14, C-15 | T10 is applied after T4 or T5, one after the other (`tariff.js:48-53`) | Not stated, see Q-3: `docs/spec/tariffs.md:89, 141` |
| A1 | C-06 to C-13 | The T3 line of a subscriber shows all blocks, free time is a discount line (`tariff.js:92`) | Not stated, see Q-4: `docs/spec/tariffs.md:134` |
| A1 | F-12 | A second calculation of the same ride is booked into the cap again (`tariff.js:61`) | Not stated, see Q-10: `docs/spec/tariffs.md:100` |
| A1 | G-01 to G-19, H-04 to H-07, A-14 | Exact error texts, HTTP codes and accepted time formats (`tariff.js:113-133`, `server.js:38`) | Only "rejected with an explanation": `docs/spec/tariffs.md:147-149` |
| A1 | C-23 to C-26, D-09, F-11, G-17, G-18, J-02 | Handling of the `concession` field, a required `rider.id`, a custom ledger limit, the order of `fees`, no lines with a zero amount (`tariff.js:47, 94, 105-110, 125`, `day-cap.js:10`) | Not in the spec, these are code details: `docs/spec/tariffs.md:38-39` lists the categories only, `:133-135` lists the receipt lines with no order |
