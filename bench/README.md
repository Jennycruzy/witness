# Triage bench

43 cases, each a real Kane test and two real builds, with the right answer written down before any run:

| Answer | Cases | What they are |
|---|---|---|
| APP_BUG | 28 | 12 hand cases (TodoMVC #2309 to #2315, CyberChef #2434, IT-Tools favourites, Actual Budget #6606, #6794, #8475) and the 16 regressions found by `witness mine` |
| TEST_PROBLEM | 2 | A recording made on one build replayed where the page differs at the step it acts on; re-recording on that build passes the step (Actual Budget 26.8.0 → 26.7.0, TodoMVC vue → web-components) |
| PASS | 13 | Controls: the good build of a pair as the target. Nothing should be flagged |

[`registration.json`](registration.json) holds the sha256 of [`cases.json`](cases.json), committed before the first run; `witness bench run` refuses to run if `cases.json` changed after that. The held-out half is fixed by each case id's hash, so nobody can choose it after seeing results.

```bash
witness bench run bench/cases.json kane-0.10.9      # every case, with the kane-cli on PATH; resumable
witness bench score bench/cases.json                # Kane's label and WITNESS's verdict against the answers, per run
```

Scoring. Kane's label is right when it tells an agent the right thing to do: `application_issue` on an app bug, `automation_bug` on a test problem, and a plain pass on a control. Passing a real bug counts as wrong. WITNESS is right when its verdict equals the answer. TodoMVC builds are `tastejs/todomvc` at ff43b02, built per example into `bench/builds/todomvc/<example>/dist`; Actual Budget builds come from npm, CyberChef and IT-Tools builds from their GitHub releases.

## Results (25 November 2026)

| kane-cli | Kane's label right | WITNESS right | Held-out half: Kane / WITNESS | Real app bugs where the agent is told to edit the test: Kane / WITNESS |
|---|---|---|---|---|
| 0.10.5 | 32 of 43 | **37 of 43** | 15 / **17** of 21 | 8 / **0** of 28 |
| 0.10.8 | 36 of 43 | 36 of 43 | 18 / 17 of 21 | 5 / **1** of 28 |
| 0.10.9 | 36 of 43 | **38 of 43** | 17 / 17 of 21 | 5 / **0** of 28 |

All 13 controls passed on every version, for both. Kane's label got better from 0.10.5 to 0.10.8; on 0.10.9 it still told an agent to edit the test on 5 real app bugs (lit, Actual #6794, #8475, mined #8587, #8763, all `automation_bug` at 0.95 to 0.98).

Where WITNESS was wrong on 0.10.9 (5 of 43):
- **TodoMVC es6 order** (#2311): the recording passes the bug, so there is nothing to compare. WITNESS flags this check as LOCKED from the recording before any run, but the bench scores only the verdict, PASS, so it counts as wrong.
- **Actual #6794, #8475 and the 26.8.0 → 26.7.0 layout case**: the reference build failed too on the bench machine, so the verdict was ENV: nobody is told to change the app or the test. Scored wrong, because the answer is APP_BUG or TEST_PROBLEM.
- **TodoMVC vue → web-components clear**: a test problem where the page difference made the recorded check fail rather than a click, so WITNESS said APP_BUG.

Every run is in [`runs/`](runs/) (`results.json` per version, one folder per case). Kane reported about 78 credits per full pass.
