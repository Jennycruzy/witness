# IT-Tools: "Add to favourites" from a tool's page stopped working in v2024.10.22

On a tool's own page, the heart button no longer adds the tool to favourites: the browser stores `[null]` and the home page shows no "Your favorite tools" section. It works in v2024.5.13. First reported three days after the release ([#1365](https://github.com/CorentinTh/it-tools/issues/1365)), then again in [#1384](https://github.com/CorentinTh/it-tools/issues/1384), [#1424](https://github.com/CorentinTh/it-tools/issues/1424), [#1639](https://github.com/CorentinTh/it-tools/issues/1639), [#1692](https://github.com/CorentinTh/it-tools/issues/1692), [#1707](https://github.com/CorentinTh/it-tools/issues/1707); v2024.10.22 is still the latest release.

Reference: v2024.5.13-a0bc346. Target: v2024.10.22-7ca5933. Both are the project's release zips:

```bash
cd examples/it-tools-favorites && mkdir -p builds
for v in v2024.5.13-a0bc346 v2024.10.22-7ca5933; do
  mkdir -p builds/it-tools-$v && curl -sL -o builds/it-tools-$v/it.zip "https://github.com/CorentinTh/it-tools/releases/download/$v/it-tools-${v#v}.zip"
  python3 -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" builds/it-tools-$v/it.zip builds/it-tools-$v
done
witness record tests/favorite_tool_test.md witness.json   # once, on v2024.5.13
witness guard witness.json
```
