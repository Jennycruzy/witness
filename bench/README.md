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
