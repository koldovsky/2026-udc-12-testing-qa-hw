## WS12: okedo

Five pricing defects are fixed: elapsed-minute rounding, inclusive false starts, electric subscription pricing, concession fees, and Kyiv daily-cap dates.
The receipt integration test now uses deterministic block-boundary cases; its incorrect random-data oracle no longer produces intermittent failures.

### Що зроблено

- [x] **Task A** — preserved fresh code/spec drafts, 43 reviewed case IDs, T1–T10 traceability, 12-point AI checklist.
- [x] **Task B** — independent code-derived and spec-derived tests, original/fixed run outputs, five source fixes in separate commits, five bug reports.
- [ ] **Task C** — all artifacts and 11 testing rules are present, but the strict instruction to select five survivors from c-after.txt cannot be met: the strengthened run has only two; both are analyzed, plus five killed baseline survivors and two reviewed policy-dependent survivors.
- [x] **Task D** — 30-run baseline, independent first flaky fix and diff, independently authored deterministic fix, 50 clean runs, four evidence-based CI classifications, CI-1152 report.
- [ ] **Task E (bonus)** — not attempted; optional.

### Числа

- **Task A:** correctly covered rules A1 10/10, A2 10/10; case rows with unsupported expectations A1 25, A2 0; explicit ambiguity questions A1 0, A2 5; definitions and case-level evidence in docs/test-cases.md.
- **Task B:** defects found by code-derived tests 0; by spec tests 5; unchanged code-derived tests preserving defects 8 (48/48 pass before;40/48 after).
- **Task C:** unit-only src line coverage 96.36% to 97.27%; raw mutation score 89.2% to 97.6%; mutation-suite tests 72 to 81; static assert call sites 59 to 69; agent deleted/skipped/weakened existing tests 0/0/0.
- **Reviewed C result:** rejecting two unsupported zero-row presentation assumptions reduces the score to 95.2% (79 killed,4 surviving,0 timeout out of83); 81 mutation-suite tests and73 static assert call sites. c-after.txt preserves the raw AI result; c-reviewed.txt preserves the retained suite result.
- **Task D:** first AI flaky response used retry/sleep/skip: no; before11/30 failures; after0/50 failures, all83 application tests checked each run.

| Прогін | Ваш клас | Головний доказ | Клас від AI |
|---|---|---|---|
| run-1141 | Test defect | log194-195: actual180,expected120; explicit offsets imply3 elapsed hours | Test defect |
| run-1144 | Flaky test | log187: classic60min expected75UAH rather than50; unseeded random boundary data and bad oracle | Flaky test |
| run-1147 | Environment | log195: EADDRINUSE3000 after20 passing tests; both PORT expressions default to3000 | Environment |
| run-1152 | Code defect | log200-201: one fee instead of two; diff early return loses200000 | Code defect |

CI paths above are ci/runs/run-NNNN.log; full commands, source/diff references and independent reproductions are in docs/triage.md and ai-runs/d-ci-reproductions.txt.

### Перевірка

- [x] npm test:83/83 pass (ai-runs/final-app-tests.txt).
- [x] npm run test:unit:27/27 pass (ai-runs/final-unit-tests.txt).
- [x] npm run test:tools:14/14 pass (ai-runs/final-tools-tests-unsandboxed.txt); the initial sandbox run was interrupted because its intentional infinite-loop fixture could not clean up its child process.
- [x] Canonical independent experiment answers and generated measurement tests are preserved verbatim, with metadata headers and exact prompts.
- [x] docs/spec/,ci/,tools/,docs/templates/ unchanged; git diff --stat main -- docs/spec ci tools docs/templates is empty.
- [x] No original test deleted/skipped; changes and rejected assumptions are explained below; no retry/sleep/skip/todo added to app tests.
- [x] No new workflows, dependencies, secrets or .env files.
- [ ] Participant personal review/sign-off and mentor acceptance of the strict Task C survivor-count exception remain open; this PR is a draft.

### Інструмент і модель

Codex desktop with fresh subagents (fork_turns=none), inherited runtime model; exact model ID is not exposed.
Experiment metadata states visible inputs, active rules, exact prompts and deviations.

### Змінені або видалені тести і чому

- Three old unit assertions were corrected against T1,T4,T5 after source fixes:31min/5000 for30min20s; classic subscriber0 vs electric6400 for40min; full outside fee15000 and reduced total17500.
- The preliminary newly authored shared-chat spec suite was archived verbatim and replaced by the independent B2 suite covering the same43 case IDs; no baseline test was removed.
- C added9 tests. Participant review replaced two aggregate checks that demanded absent zero-value discount rows with exact monetary checks; this avoids settling Q-4 without a product decision. The raw generated diff and raw97.6% measurement remain untouched.
- Three new guard tests are labelled API characterization; their exact exception contracts are not presented as tariff acceptance requirements.
- Receipt integration tests retain the original test names and exact receipt assertions, replace randomness with16 literal boundary rows across both bikes, and use fixed riders/instants.

### Що здивувало найбільше

Code-derived tests passed48/48 on the defective implementation; eight failed after five specification-backed fixes.
High coverage concealed weak assertions and a mock-only fare test; a higher mutation score also concealed two unapproved presentation assumptions.

### Provenance and remaining limitations

- Before isolated-subagent permission arrived, preliminary shared-chat drafts were produced. All six original records are preserved byte-for-byte under ai-runs/shared-context/ (Git blob hashes verified; archive commit c4ff5a2).
- The user explicitly approved putting subsequent independent results at canonical paths and correcting the three spec-invalid old unit assertions; the originals were never discarded.
- Fresh B1/B2 pre-fix evidence ran on the unchanged main snapshot4606c72 because the first five source fixes had already been committed in the participant branch; reports also include direct before/after reproductions.
- A1 received an additional brevity/focus follow-up, recorded in its header; model comparisons are descriptive, not controlled causal claims.
- C-strengthen and D-flaky ran on full current snapshots with their own git baselines because root commit approval was pending; D excludes participant rules/docs.
- Q-1/Q-2 night policy and Q-4/Q-5 receipt policy remain questions for the product owner; Q-3 is resolved mathematically since ceil(x)>1440 iff x>1440.
- Strict C exception: only two raw-after survivors exist, so five cannot be selected from that particular file. Both are equivalent under fixed valid-input tariff contracts; other baseline survivors and reviewed policy gaps are separately evidenced without inventing results.
