# WITNESS

**Kane says why a test failed. WITNESS checks it against a second build before your coding agent acts.**

When a [Kane CLI](https://www.testmuai.com/kane-cli/) test fails, a coding agent has to choose: fix the app, or fix the test. Kane gives a label for that, and agents act on it. On 9 real app bugs we measured that label pointing at the test in 5. On a 10th, Kane passed the bug outright. An agent that trusts it rewrites the test to accept the bug.

WITNESS replays the **same recording** on a reference build (main, the last release, yesterday's nightly) and decides by comparison:

| Reference | Your build | Verdict | What the agent is told |
|---|---|---|---|
| passes | fails **at a check** | **APP_BUG** | Fix the app, not the test |
| passes | fails at a click or typing step | **TEST_PROBLEM** | The page changed where the test acts: re-record it |
| fails too | fails | **ENV** | Check the environment before changing anything |
| — | passes, but a check read hidden text | **BLIND** | That step cannot see the bug it should catch: harden it |

Then Kane proves the fix: the **unchanged** recording (same sha256) must pass on the rebuilt app.

## What it found on real software

All of it is real: public bugs in real apps, real Kane runs (kane-cli 0.10.5). Nothing is planted. `witness verify` recomputes every number below from the runs committed in [`evidence/`](evidence/) and checks their sha256.

| | Kane's own label | WITNESS |
|---|---|---|
| Real app bugs (9) | right on **4 of 9** | right on **9 of 9** |
| Real test problems (3) | right on 3 of 3 | right on **3 of 3** |
| Real bug Kane passed (1) | PASS | flagged the check as **LOCKED** from the recording, before any run |

- **TodoMVC Svelte, [#2315](https://github.com/tastejs/todomvc/issues/2315) (open).** Kane failed the edit test and labelled it `automation_bug` (0.88). WITNESS: the same recording passes on the Vue build and fails here at a check, so APP_BUG. Claude Code got WITNESS's card, changed one line in `src/Item.svelte` ([diff](evidence/todomvc-svelte-trim.patch)), WITNESS rebuilt the app, and the unchanged recording passed 5 of 5 with no self-healing.
- **A check that could not see the bug.** In the same test, Kane's check *"the list shows exactly one todo, b"* passed on the buggy build in every run, reading `"\nb"`: the blank todo was on the page, and the comparison stripped it away. WITNESS flags this as BLIND.
- **Actual Budget, [#8475](https://github.com/actualbudget/actual/issues/8475).** The running balance stopped updating after an edit. The recording passes on the 17 June 2026 nightly and fails on 20 June at the balance check (reads 20.00, expected 50.00). That bug shipped to everyone in 26.7.0 on 2 July and was first reported on 14 July.
- **Six more open TodoMVC bugs** ([#2309](https://github.com/tastejs/todomvc/issues/2309) react, [#2310](https://github.com/tastejs/todomvc/issues/2310) es5, [#2311](https://github.com/tastejs/todomvc/issues/2311) es6, [#2313](https://github.com/tastejs/todomvc/issues/2313) lit, [#2314](https://github.com/tastejs/todomvc/issues/2314) web-components), each a plain-English Kane test recorded once on the Vue build and replayed on the buggy one. Kane labelled three of them `automation_bug` (0.78 to 0.98). WITNESS: APP_BUG on all.
- **A check locked to its own answer.** On javascript-es6 ([#2311](https://github.com/tastejs/todomvc/issues/2311)), Kane passed *"the first todo is a and the second is b"* while the list showed b, a. Its recording finds each todo *by the text it expects* and reads that text back, so it can never see the order. WITNESS flags this as LOCKED from the recording alone (free, no run). Given only WITNESS's message, Claude Code rewrote the step to *"the todo list reads, from top to bottom: a, b"*; re-recorded, it fails on es6 and passes on Vue.
- **Actual Budget, a layout change between 26.8.0 and 26.7.0.** The replay failed at a click: TEST_PROBLEM. Re-recording on 26.7.0 passed the click, then failed at the balance check: the real #8475 bug, now an APP_BUG.

## Reported upstream

| Where | What we sent | Outcome |
|---|---|---|
| Kane CLI [#232](https://github.com/LambdaTest/kane-cli/issues/232) | Replay triage labels real app bugs `automation_bug`, so agents fix the test instead of the app | **Reproduced and fixed by the Kane team** (3 of 3 runs wrong before, 4 of 4 right after); the fix ships in kane-cli 0.10.7 |
| Kane CLI [#233](https://github.com/LambdaTest/kane-cli/issues/233) | A list check passes on a blank todo because the comparison strips the blank line | **Reproduced and fixed by the Kane team**: list checks are now recorded item by item, so the blank todo fails the check; ships in kane-cli 0.10.7 |
| TodoMVC [#2320](https://github.com/tastejs/todomvc/pull/2320) | Svelte fix for [#2315](https://github.com/tastejs/todomvc/issues/2315): trim edited todos, restore the filter on reload | The fixed build passes both Kane tests, and all 36 rules of TodoMVC's app spec in a Playwright check |

## Install

Needs Node 20+, Google Chrome, and a [Kane CLI](https://www.testmuai.com/kane-cli/) login (`npm i -g @testmuai/kane-cli && kane-cli login`).

```bash
git clone https://github.com/Jennycruzy/witness && cd witness
npm ci && npm run build && npm link     # gives you the `witness` command
```

## Check it yourself in 60 seconds (no login)

```bash
npx -y github:Jennycruzy/witness demo
```

One real case from start to finish (Kane's label, the second build, the card, the agent's one-line fix, the unchanged recording passing), then every number above recomputed from the committed runs. No Kane login, no credits, no network calls of its own. Or from a clone:

```bash
git clone https://github.com/Jennycruzy/witness && cd witness
npm ci && npm run build
npm test                    # unit tests on the real runs
node dist/cli.js demo       # the walk-through above
node dist/cli.js verify     # recomputes every number above from evidence/, checks sha256
```

## Judges: one minute per score

| Score | Look at | What you see |
|---|---|---|
| Ships | `npx -y github:Jennycruzy/witness demo` | The full flow on a real bug, from the real Kane runs, in under a second after install |
| Ships | [`examples/actual`](examples/actual) and [`evidence/actual-8475-search.json`](evidence/actual-8475-search.json) | The nightly watch set up on Actual Budget, and the build search that found the first bad nightly for #8475 (20 June 2026) unattended, with the commits in between |
| Verified | `node dist/cli.js verify` | Kane's label right on 4 of 9 real app bugs, WITNESS 9 of 9; 3 of 3 real test problems; every evidence file checked by sha256 |
| Verified | [Reported upstream](#reported-upstream) | Both Kane issues reproduced and fixed by the Kane team; the TodoMVC fix PR |
| Closed loop | [`evidence/todomvc-svelte-trim-hook-untold.patch`](evidence/todomvc-svelte-trim-hook-untold.patch) and its row in `verify` | A Claude Code session told about one bug tried to stop; the Stop hook blocked it on a second bug it was never told about; it fixed that too, and the unchanged recordings passed |
| Closed loop | [Pull request #1](https://github.com/Jennycruzy/witness/pull/1) | On GitHub: a PR puts back the upstream TodoMVC Svelte code; the check replays the Kane tests on the PR's build and the base build and comments APP_BUG with the card; a separate Claude Code agent given only that comment fixes two app files; the check goes green |
| Closed loop | [`src/commands/fix.ts`](src/commands/fix.ts) | Agent edits outside the app source are rolled back; a changed test or recording (sha256) is rejected |
| Craft | [How I tried to break it](#how-i-tried-to-break-it) | Each way the verdict could be wrong, and the run or test that covers it |

## How I tried to break it

| Attack | What WITNESS does | Covered by |
|---|---|---|
| Kane's label blames the test for a real app bug | Ignores the label; the second build decides | 5 of 9 real app bugs in `verify` |
| Kane self-heals past a bug | Replays with `--no-adaptive-heal`; a fix proof with any heal does not count | [`src/io/kane.ts`](src/io/kane.ts), fix rows in `verify` |
| Kane records steps again instead of replaying (stale recording) | Verdict STALE; a fix proof must replay every step | [`test/classify.test.ts`](test/classify.test.ts) "stale recording" |
| A check passes while reading a blank line it strips (`"\nb"`) | BLIND | [`test/blind.test.ts`](test/blind.test.ts), 2 real runs in `verify` |
| A check finds the item by the text it expects, so it cannot fail | LOCKED, from the recording alone, before any run | [`test/locked.test.ts`](test/locked.test.ts), es6 #2311 in `verify` |
| The reference build is broken too | ENV: nobody is told to change anything | [`test/classify.test.ts`](test/classify.test.ts) "reference build broken too" |
| The page layout changed where the test clicks | TEST_PROBLEM, not APP_BUG | 3 real test problems in `verify` |
| The agent edits the test or its recording to make it pass | Rejected: recording sha256 must not change | [`src/commands/fix.ts`](src/commands/fix.ts) |
| The agent edits files outside the app source | Rolled back and rejected | [`src/commands/fix.ts`](src/commands/fix.ts) |
| A click fails because the machine is busy | `witness search` replays that build once more before deciding | [`src/commands/search.ts`](src/commands/search.ts) |
| Someone edits the evidence | `verify` fails on any sha256 change | [`evidence/manifest.json`](evidence/manifest.json) |

## Use it

Put a `witness.json` next to your Kane tests:

```json
{
  "tests": ["tests/edit_trim_test.md"],
  "target":    { "dir": "dist" },
  "reference": { "url": "https://staging.example.com/" },
  "fix": { "agent": ["claude", "-p", "--allowedTools", "Read,Edit"], "cwd": ".", "source": "src", "build": "npm run build" }
}
```

| Command | What it does | Kane credits |
|---|---|---|
| `witness record <test>` | Records the test's steps with Kane on the reference build (with an npm channel: the newest release) and keeps the recording | ~50 for a short test |
| `witness guard` | Runs each test on your build; on a failure replays it on the reference and gives the verdict | 0 when the target passes |
| `witness fix <test>` | APP_BUG → the agent gets the card (it may change only `source/`) → rebuild → the unchanged recording must pass | rebuild + replays |
| `witness install-hook` | Adds a Claude Code Stop hook: the agent cannot stop while a verdict is open | — |
| `witness search <test> <good> <bad>` | Replays the test across published builds to find the first bad one, then lists the commits in between | ~5 per failing build |
| `witness watch` | Checks the newest nightly against the newest release; on an APP_BUG it runs the search | 0 on quiet nights |
| `witness verify` | Recomputes the headline numbers from `evidence/`, offline | 0 |

Builds can be a URL or a folder that WITNESS serves itself (with cross-origin isolation headers when an app needs them). Apps that need a starting state get a setup command (see [`examples/actual/setup.mjs`](examples/actual/setup.mjs); the full nightly setup for Actual Budget, with its recorded test, is in [`examples/actual`](examples/actual), run from that folder).

## How the decision is made

1. Replay the recording on your build with `kane-cli testmd run --override-start-url <your build> --no-adaptive-heal`, on a throwaway copy of the test folder, so nothing in your suite changes.
2. If it fails, replay the same recording on the reference build.
3. Read where it failed from Kane's own stream: a check (`assertion_failed`, final verification) or an action (`action_failed: click …`).
4. Decide by the table above. Kane's label is recorded next to the verdict and never used to decide.

## Limits

- Desktop web. Mobile targets need a paid Kane plan and are not covered.
- A Kane recording belongs to the account that made it. To replay ours, record the tests once with your own account.
- The comparison needs a reference build that is believed to be right.
- Replays can fail at a click when the machine is under load; `witness search` replays such a build once more before deciding.

## Licence

Apache-2.0
