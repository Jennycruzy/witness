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
   If `witness.json` has `carryState` and the bug may need data an older version saved (it appears after an update, or "clearing site data fixes it"), add `--carry-state`.
   Runs take one to three minutes per test. Wait for the `VERDICT` line before editing anything.
   If it says `NO RECORDING`, ask the user before adding `--record-missing` (it records the test once on the reference build, about 50 Kane credits).
   A passing test costs no Kane credits. A failing test costs a few (Kane's triage), plus a free replay on the reference.
3. Act on the `VERDICT` line only:

| Verdict | What you do | What you never do |
|---|---|---|
| `APP_BUG` | Read the card (`.witness/runs/<run>/card.md`) and change the **application source** at the step marked FAILED HERE | Edit the test, its recording (`output-<name>/`), or build config |
| `STATE_BUG` | The app fails only with the browser data the older build saved. Read the card and fix the **application source** so it opens that data (often a migration) | Edit the test, clear the saved data, or call it flaky |
| `TEST_PROBLEM` | Tell the user the page changed where the test acts; re-record with `witness record <test> witness.json` (costs about 50 credits: ask first) | Change the app to suit the old recording |
| `ENV` | Stop. The reference build fails too. Report it and check servers, data, logins | Change the app or the test |
| `STALE` | The run recorded steps again instead of replaying. Re-record on the reference (ask first: credits) | Trust the result of that run |
| `PASS` with `BLIND` | The step passed but read text its comparison strips. Rewrite that step's sentence so it states the count or exact list, then re-record (ask first) | Ignore it |
| `NO_RECORDING` | Tell the user; with their OK run again with `--record-missing` (about 50 credits) | Run Kane on the test yourself |
| `LOOSE` or `UNSTABLE` (printed by `record` or before the run) | That step's check cannot be replayed. Reword the step to name exactly what to read (for example "the footer reads 1 item left"), then record again (ask first) | Trust a verdict on that step |
| `LOCKED` (printed before the run) | The check finds the element by the text it expects, so it cannot fail on order or position. Rewrite the step to read the whole list in order | Ignore it on a step about order |
| `LOCKED`, "only extracts its expected text" | The check's code returns the expected text or nothing, so a failure reads `None` and hides what the page showed. Trust the WITNESS verdict, not Kane's label; to see the real value, re-record the step to read the whole field (ask first) | Read `None` as "the value seen" |

4. After an app fix: rebuild and run `witness guard witness.json --only <name>_test.md` again. The fix counts only when the **unchanged** recording passes. If it still fails, read the new card and try again; stop after three rounds and report.

## Hands-off loop

`witness fix <test> witness.json` runs steps 2 to 4 with a coding agent and rejects any change to the test, its recording, or files outside the app source.
`witness guard … --teach` also writes the verdict into Kane's bug memory (real or not, root cause right or wrong, one short note); it never closes a bug.
`witness install-hook` adds a Claude Code Stop hook that rebuilds the app and runs `witness guard` when you try to finish. It blocks you while an APP_BUG or STATE_BUG is open, when a pinned test or its recording has changed (put them back and fix the app), and when it could not check the fix at all. When everything passes it writes `.witness/PROVEN.md` (`witness install-hook --carry-state` adds the saved-data check).

## Say what you did

End with: the verdict, Kane's label (and that it was not used), the file and lines you changed, and the final `witness guard` result.
