# Repro pack for LambdaTest/kane-cli#241

A bug marked `real` and `rca-wrong` with a note is recalled by the next diagnosis, and the diagnosis repeats the root cause that was marked wrong. Local paths are replaced with `<local>`, and account ids with `<removed>`.

- kane-cli 0.10.8, Linux, headless Chrome
- App: TodoMVC `examples/lit` at tastejs/todomvc ff43b02, served as static files. Its real bug: Enter on a blank entry adds an empty todo and counts it (tastejs/todomvc#2313).
- Test: `blank_ignored_test.md`, recording: `output-blank_ignored/`
- Known-good build: `examples/vue` at the same commit. The same recording passes there, with every step replayed.

## Runs

Each run is `kane-cli testmd run blank_ignored_test.md --agent --no-adaptive-heal --override-start-url http://127.0.0.1:<port>/`.

| File | Time (UTC, 23 Nov) | Port | Result | Diagnosis | `known_bug_id` |
|---|---|---|---|---|---|
| `runs/1-before-note-port-42443.ndjson` | 00:06 | 42443 | failed at step 3 | automation_bug 0.96 (filed as BUG-5) | (none) |
| `runs/1-reference-vue.ndjson` | 00:07 | vue build | passed | | |
| `runs/2-after-note-other-port-a.ndjson` | 00:16 | 46295 | failed at step 3 | automation_bug 0.96 | (none) |
| `runs/3-after-note-other-port-b.ndjson` | 00:20 | 40809 | failed at step 3 | automation_bug 0.96 | (none) |
| `runs/4-after-note-port-42443-a.ndjson` | 01:26 | 42443 | failed at step 3 | automation_bug 0.99 | BUG-5 |
| `runs/5-after-note-port-42443-b.ndjson` | 01:30 | 42443 | failed at step 3 | automation_bug 0.98 | BUG-5 |
| `runs/6-short-note-port-42443-a.ndjson` | 20:01 | 42443 | failed at step 3 | automation_bug 0.98 | BUG-5 |
| `runs/7-short-note-port-42443-b.ndjson` | 20:02 | 42443 | failed at step 3 | automation_bug 0.98 | BUG-5 |
| `runs/8-kane-0109-port-42443.ndjson` | 25 Nov 12:28 | 42443 | failed at step 3 | automation_bug 0.91, answering the note (below) | (none) |
| `runs/8-reference-vue.ndjson` | 25 Nov 12:29 | vue build | passed | | |

The feedback was given at 00:13, between runs 1 and 2: `bugs mark BUG-5 real`, `bugs mark BUG-5 rca-wrong`, and `bugs note BUG-5 "..."`. `BUG-5.json` is `kane-cli bugs show BUG-5 --agent` after run 5. It shows the three pieces of feedback and their times, status `confirmed`, and every occurrence: `new` for run 1, `similar` for runs 2 and 3, and `claim_confirmed` for runs 4 and 5.

Runs 6 and 7 test a short note, after the cause "the note is cut at 120 characters" was confirmed on the issue. At 19:59 a new note of 112 characters was added, so all of it fits: *"Real app bug: Enter on a blank entry adds an empty todo and the counter counts it. Same recording passes on vue."* Both runs recalled BUG-5 and still said automation_bug 0.98. On 0.10.8 the length of the note is not what keeps it from being used.

Runs 2 and 3 were served on other ports. The bug's page key is `127.0.0.1:42443/`, so their diagnosis was not told about BUG-5. Runs 4 and 5 are the ones that test the note.

## Run 8: kane-cli 0.10.9, after the issue was closed as fixed

The issue was closed as fixed in 0.10.9 on 25 November. The same recording, on the same port, with the same marks and the short note: the diagnosis now reads the note and answers it: *"This run's screenshot therefore contradicts BUG-5's last note that this is a real app bug: it visibly shows two unchecked todos and "2 items left."* It returns `automation_bug` 0.91 and leaves `known_bug_id` empty. One of the two todos it saw is the blank one: that is the app bug (tastejs/todomvc#2313). The Vue build passes the same recording.

