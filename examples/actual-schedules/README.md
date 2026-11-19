# Actual Budget: completed schedules kept showing in 26.1.0

[actualbudget/actual#6606](https://github.com/actualbudget/actual/issues/6606): after "Show completed schedules", completed schedules stayed visible every time the Schedules page was opened again, with no way to hide them. Introduced by [#6158](https://github.com/actualbudget/actual/pull/6158) (the setting moved to local storage), shipped in 26.1.0 (4 January 2026), fixed before 26.2.0. 25.12.0 and 26.2.0 hide them again.

Reference: 26.2.0. Target: 26.1.0. Both from npm (`@actual-app/web`). `setup.mjs` makes a local budget with a Checking account and a monthly "Rent" schedule before Kane runs.

```bash
cd examples/actual-schedules && mkdir -p builds
for v in 26.1.0 26.2.0; do mkdir -p builds/actual-$v && curl -sL https://registry.npmjs.org/@actual-app/web/-/web-$v.tgz | tar xz -C builds/actual-$v; done
witness record tests/completed_schedules_test.md witness.json   # once, on 26.2.0
witness guard witness.json
```
