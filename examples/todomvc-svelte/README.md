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

## Run it live

`live.json` serves a page where anyone can start this check and watch it. It needs two builds: the fixed one in `reference/dist`, and the upstream code in `builds/upstream/dist`:

```bash
# from the repository root
E=examples/todomvc-svelte
(cd $E/app && npm ci && npm run build && mkdir -p ../reference && rm -rf ../reference/dist && cp -r dist ../reference/dist)
rm -rf $E/builds/upstream && mkdir -p $E/builds/upstream && cp -r $E/app $E/builds/upstream/src
for f in Item.svelte router.js; do curl -sL https://raw.githubusercontent.com/tastejs/todomvc/ff43b02/examples/svelte/src/$f -o $E/builds/upstream/src/src/$f; done
(cd $E/builds/upstream/src && npm run build && mv dist ../dist)
node dist/cli.js live $E/live.json     # http://127.0.0.1:8797/
```

One run at a time; `perHour` and `perVisitorMinutes` cap how many runs (and Kane credits) visitors can start.
