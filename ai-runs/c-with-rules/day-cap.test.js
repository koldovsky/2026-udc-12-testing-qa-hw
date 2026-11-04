// Unit tests for app/src/day-cap.js.
// The spec was not available for this task (AGENTS.md rule 2): no expected values are
// invented; every behaviour that needs the spec is recorded as test.todo("Q: …").
import { test } from "node:test";

test.todo("Q: T6 — what is the daily cap on time charges, in kopecks?");
test.todo("Q: T6 — is the ride's day the Kyiv calendar date of pickup? E.g. pickup 2026-09-16T01:10:00+03:00 (= 2026-09-15T22:10Z): booked on 16.09 or 15.09?");
test.todo("Q: T6 — two rides at 2026-09-15T23:30+03:00 and 2026-09-16T00:30+03:00 (both 20:30Z/21:30Z on 15.09 UTC): one day or two?");
test.todo("Q: T6 — is a ride booked on its pickup day or split across days when it crosses midnight?");
test.todo("Q: T6 — once 299 UAH is charged, a 25 UAH ride is charged 1 UAH; after 300 UAH, 0 — correct?");
test.todo("Q: T6 — is the cap per rider (rider.id) and independent between riders?");
test.todo("Q: T6 — does the cap apply to the time charge after night/reduced/subscription discounts, and never to fees?");
