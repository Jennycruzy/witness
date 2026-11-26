# Kane bug memory on kane-cli 0.10.9: a follow-up to #241

Actual Budget nightly 26.9.0-nightly.20260831, test "category dropdown menu opens again after rename" ([#8760](https://github.com/actualbudget/actual/issues/8760), a real app bug). Kane had filed it as BUG-19 on `127.0.0.1:33881/budget`.

- `runs-teach/`: three runs on port 42460. The first one ran `witness guard --teach`: it marked BUG-19 real and its root cause wrong, and added a short note ([`teach.log`](teach.log)). Kane recalls a bug by its exact page, port included, so these runs could not recall it.
- `runs-teach2/`: six runs on port 33881, the page where BUG-19 was filed ([`teach2.log`](teach2.log)).

| Run (runs-teach2) | Kane recalled BUG-19 | Kane's label | WITNESS |
|---|---|---|---|
| 07-38-34 | yes | `application_issue` 0.91 | ENV (the reference failed too in this run) |
| 07-43-21 | no | `automation_bug` 0.93 | APP_BUG |
| 07-55-41 | no | `automation_bug` 0.94 | APP_BUG |
| 08-07-54 | no | `automation_bug` 0.98 | APP_BUG |
| 08-21-39 | yes | `automation_bug` 0.94 | APP_BUG |
| 08-32-41 | no | `automation_bug` 0.97 | APP_BUG |

Kane's label on the same bug, page and port moved between the app and the test. WITNESS's verdict comes from replaying the same recording on the next nightly, so it does not move with the label.
