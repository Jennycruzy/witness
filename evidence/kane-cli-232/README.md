# Repro packs for LambdaTest/kane-cli#232

Two real, public application bugs. Each test was recorded on a build where the app is correct, then replayed with
`kane-cli testmd run <test> --agent --no-adaptive-heal --override-start-url <build> --cdp-endpoint <chrome>`
on a build that has the bug. Every run's NDJSON is included, for 0.10.5 and 0.10.7. Local paths and account ids are replaced with `<local>` / `<removed>`.

## 1. TodoMVC: whitespace-only edit leaves an empty todo (tastejs/todomvc#2315)

- Test: `todomvc-edit-trim/edit_trim_test.md`, recording: `todomvc-edit-trim/output-edit_trim/`
- Recorded on `examples/vue`, replayed on `examples/svelte` (tastejs/todomvc ff43b02, the built `dist/` folders served as static files).

| kane-cli | vue (correct) | svelte (bug) |
|---|---|---|
| 0.10.5 | passed | automation_bug 0.88, automation_bug 0.93 |
| 0.10.7 | passed | **application_issue / validation_defect 0.98, 0.99** |

On 0.10.7 the fix works here: same recording, same failing step (5), and the verdict now blames the app.

## 2. Actual Budget: 1'234.56 saved as 1.00 with the 1'000.33 number format (actualbudget/actual#6794)

- Test: `actual-6794/separator_test.md`, recording: `actual-6794/output-separator/`
- Builds: `@actual-app/web` 26.2.0 (fixed) and 26.1.0 (bug), `package/build` served with `setup/serve.mjs` (adds the cross-origin isolation headers Actual needs).
- State: `node setup/fmtsetup.mjs http://127.0.0.1:<port>/ <profile-dir>` creates a fresh local budget, an account "Wallet" and sets the number format to 1'000.33. Then start Chrome on a copy of that profile with `--remote-debugging-port` and pass `--cdp-endpoint`. Run the setup on the same port you replay on (the budget lives in that origin's storage).

| kane-cli | 26.2.0 (correct) | 26.1.0 (bug), runs that reached the check | 26.1.0, runs stopped at the Deposit click |
|---|---|---|---|
| 0.10.5 | passed (1/1) | automation_bug / state_transition_bug 0.87 (1/1) | automation_bug / locator_rot 0.98 (2/2) |
| 0.10.7 | passed 1/3, other 2 stopped at the Deposit click | **application_issue / ui_data_defect 0.96** (r1), **automation_bug / locator_rot 0.96** (r5) | automation_bug / locator_rot 0.90–0.98 (5/7) |

What the runs show:

- **Deposit click flake (our test, not the app).** In many runs the recorded Deposit-field click opened the Date calendar before anything was typed, on the correct 26.2.0 build too. `automation_bug` is the right label for those, so they are a reverse case: 0.10.7 did not flip a real test problem to `application_issue`.
- **r1 and r5 on 0.10.7 took the identical path** (all actions succeeded, the check read the value) and got opposite verdicts. r5's root cause is "the live page shows the Date field selected with its calendar open". But the passing 26.2.0 run ends in the same state, with the calendar open after Add (compare `runs-0.10.7/26.2.0-r1.ndjson`). The only difference on the page is the Deposit: `1'234.56` vs `1.00`.
- **The observed value cannot show the wrong amount.** The recorded check is
  `(el(92).textContent.match(/1'234\.56/) || [null])[0]` with expected `1'234.56`.
  On 26.1.0 the cell shows `1.00`, so the read returns `None`, not `1.00`. The fix passes expected vs observed to triage, but here the observed value is `None`, which looks the same as "element not found" and points back to test drift.
