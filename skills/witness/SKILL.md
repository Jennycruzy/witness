---
name: witness
description: Use when a Kane CLI test fails, when kane-cli says automation_bug or application_issue, or before changing an app or a Kane test because a Kane run failed. WITNESS replays the same Kane recording on a reference build and says whether to fix the app, re-record the test, or check the environment. Act on its verdict, never on Kane's label alone.
---

# WITNESS: decide app bug or test problem before you change anything

Kane's own label for a failed run (`automation_bug`, `application_issue`) is often wrong about real app bugs. Do not use it to decide what to change. Use WITNESS.

## When a Kane test fails

1. Find `witness.json` next to the Kane tests (it names the tests, the target build and a reference build). If there is none, ask the user which build is known to be right and write one:
   ```json
   { "tests": ["tests/<name>_test.md"], "target": { "dir": "dist" }, "reference": { "url": "<known good build>" } }
   ```
2. Build the app if the target is a folder, then run:
   ```bash
   witness guard witness.json --only <name>_test.md   # just the failing test; drop --only to run them all
   ```
   Runs take one to three minutes per test. Wait for the `VERDICT` line before editing anything.
   If it says `NO RECORDING`, ask the user before adding `--record-missing` (it records the test once on the reference build, about 50 Kane credits).
   A passing test costs no Kane credits. A failing test costs a few (Kane's triage), plus a free replay on the reference.
3. Act on the `VERDICT` line only:

| Verdict | What you do | What you never do |
|---|---|---|
| `APP_BUG` | Read the card (`.witness/runs/<run>/card.md`) and change the **application source** at the step marked FAILED HERE | Edit the test, its recording (`output-<name>/`), or build config |
| `TEST_PROBLEM` | Tell the user the page changed where the test acts; re-record with `witness record <test> witness.json` (costs about 50 credits: ask first) | Change the app to suit the old recording |
| `ENV` | Stop. The reference build fails too. Report it and check servers, data, logins | Change the app or the test |
| `STALE` | The run recorded steps again instead of replaying. Re-record on the reference (ask first: credits) | Trust the result of that run |
| `PASS` with `BLIND` | The step passed but read text its comparison strips. Rewrite that step's sentence so it states the count or exact list, then re-record (ask first) | Ignore it |
| `NO_RECORDING` | Tell the user; with their OK run again with `--record-missing` (about 50 credits) | Run Kane on the test yourself |
| `LOOSE` or `UNSTABLE` (printed by `record` or before the run) | That step's check cannot be replayed. Reword the step to name exactly what to read (for example "the footer reads 1 item left"), then record again (ask first) | Trust a verdict on that step |
| `LOCKED` (printed before the run) | The check finds the element by the text it expects, so it cannot fail on order or position. Rewrite the step to read the whole list in order | Ignore it on a step about order |

4. After an app fix: rebuild and run `witness guard witness.json --only <name>_test.md` again. The fix counts only when the **unchanged** recording passes. If it still fails, read the new card and try again; stop after three rounds and report.

## Hands-off loop

`witness fix <test> witness.json` runs steps 2 to 4 with a coding agent and rejects any change to the test, its recording, or files outside the app source.
`witness install-hook` adds a Claude Code Stop hook that runs `witness guard` when you try to finish and blocks you while an APP_BUG is open.

## Say what you did

End with: the verdict, Kane's label (and that it was not used), the file and lines you changed, and the final `witness guard` result.
