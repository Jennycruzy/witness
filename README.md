# WITNESS

Kane says why a test failed. WITNESS checks it against a second build before your coding agent acts.

When a [Kane CLI](https://www.testmuai.com/kane-cli/) test fails, a coding agent has to choose: fix the app, or fix the test. WITNESS replays the same recording on a reference build (main, the last release, yesterday's nightly). If it passes there and fails here at a check, the app changed. If it fails here at a click or a typing step, the page changed and the test needs re-recording.

Work in progress.
