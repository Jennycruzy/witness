# WITNESS

**Kane says why a test failed. WITNESS checks it against a second build before your coding agent acts.**

When a [Kane CLI](https://www.testmuai.com/kane-cli/) test fails, a coding agent has to choose: fix the app, or fix the test. Kane gives a label for that, and agents act on it. On real bugs we measured that label pointing at the test when the app was broken in 2 of 4 cases. An agent that trusts it rewrites the test to accept the bug.

WITNESS replays the **same recording** on a reference build (main, the last release, yesterday's nightly) and decides by comparison:

| Reference | Your build | Verdict | What the agent is told |
|---|---|---|---|
| passes | fails **at a check** | **APP_BUG** | Fix the app, not the test |
| passes | fails at a click or typing step | **TEST_PROBLEM** | The page changed where the test acts: re-record it |
| fails too | fails | **ENV** | Check the environment before changing anything |
| — | passes, but a check read hidden text | **BLIND** | That step cannot see the bug it should catch: harden it |

Then Kane proves the fix: the **unchanged** recording (same sha256) must pass on the rebuilt app.

## What it found on real software

All of it is real: public bugs in real apps, real Kane runs (kane-cli 0.10.5). Nothing is planted. `npx witness verify` recomputes every number below from the runs committed in [`evidence/`](evidence/) and checks their sha256.

| | Kane's own label | WITNESS |
|---|---|---|
| Real app bugs (4) | right on **2 of 4** | right on **4 of 4** |
| Real test problems (2) | right on 2 of 2 | right on **2 of 2** |

- **TodoMVC Svelte, [#2315](https://github.com/tastejs/todomvc/issues/2315) (open).** Kane failed the edit test and labelled it `automation_bug` (0.88). WITNESS: the same recording passes on the Vue build and fails here at a check, so APP_BUG. Claude Code got WITNESS's card, changed one line in `src/Item.svelte` ([diff](evidence/todomvc-svelte-trim.patch)), WITNESS rebuilt the app, and the unchanged recording passed 5 of 5 with no self-healing.
- **A check that could not see the bug.** In the same test, Kane's check *"the list shows exactly one todo, b"* passed on the buggy build in every run, reading `"\nb"`: the blank todo was on the page, and the comparison stripped it away. WITNESS flags this as BLIND.
- **Actual Budget, [#8475](https://github.com/actualbudget/actual/issues/8475).** The running balance stopped updating after an edit. The recording passes on the 17 June 2026 nightly and fails on 20 June at the balance check (reads 20.00, expected 50.00). That bug shipped to everyone in 26.7.0 on 2 July and was first reported on 14 July.
- **Actual Budget, a layout change between 26.8.0 and 26.7.0.** The replay failed at a click: TEST_PROBLEM. Re-recording on 26.7.0 passed the click, then failed at the balance check: the real #8475 bug, now an APP_BUG.

## Install

Needs Node 20+, Google Chrome, and a [Kane CLI](https://www.testmuai.com/kane-cli/) login (`npm i -g @testmuai/kane-cli && kane-cli login`).

```bash
git clone https://github.com/Jennycruzy/witness && cd witness
npm ci && npm run build && npm link     # gives you the `witness` command
```

## Check it yourself in 60 seconds (no login)

```bash
git clone https://github.com/Jennycruzy/witness && cd witness
npm ci && npm run build
npm test                    # unit tests on the real runs
node dist/cli.js verify     # recomputes every number above from evidence/, checks sha256
```

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
