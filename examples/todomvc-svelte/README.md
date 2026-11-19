# TodoMVC Svelte: the pull request check

`app/` is the Svelte example from [tastejs/todomvc](https://github.com/tastejs/todomvc) at `ff43b02`, with the two fixes for [#2315](https://github.com/tastejs/todomvc/issues/2315) sent upstream in [#2320](https://github.com/tastejs/todomvc/pull/2320) (trim edited todos; restore the filter on reload). `tests/` holds two plain-English Kane tests and their recordings, made on this fixed build.

On every pull request that touches this folder, [`pr-check.yml`](../../.github/workflows/pr-check.yml):

1. builds the app from the pull request (target) and from the base branch (reference);
2. replays each recording on the target with `--no-adaptive-heal`;
3. when one fails, replays the same recording on the reference and decides APP_BUG, TEST_PROBLEM or ENV;
4. posts the verdict table and the card for the coding agent as a comment on the pull request.

Run the same check on your machine (needs a Kane login, Chrome, and the reference built into `reference/dist`):

```bash
cd examples/todomvc-svelte
(cd app && npm ci && npm run build)
node ../../dist/cli.js guard witness.json
```
