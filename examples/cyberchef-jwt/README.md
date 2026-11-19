# CyberChef: JWT Sign and Verify broke in v10.23.0

[gchq/CyberChef#2434](https://github.com/gchq/CyberChef/issues/2434) (also #2748): from v10.23.0, **JWT Sign** and **JWT Verify** fail in the browser with *"Have you entered the key correctly? … TypeError: Right-hand side of 'instanceof' is not an object"*. It works in v10.22.1. The fix ([#2473](https://github.com/gchq/CyberChef/pull/2473)) is not merged; v11.5.0 still fails.

Reference: v10.22.1. Target: v10.23.0. Both are CyberChef's own release zips:

```bash
cd examples/cyberchef-jwt && mkdir -p builds
for v in v10.22.1 v10.23.0; do
  mkdir -p builds/cyberchef-$v && cd builds/cyberchef-$v
  curl -sL -o cc.zip "$(curl -s https://api.github.com/repos/gchq/CyberChef/releases/tags/$v | grep -o 'https://[^"]*CyberChef[^"]*\.zip' | head -1)"
  python3 -c "import zipfile; zipfile.ZipFile('cc.zip').extractall('.')" && cp CyberChef_*.html index.html && cd ../..
done
witness record tests/jwt_verify_test.md witness.json   # once, on v10.22.1
witness guard witness.json
```

The test uses **JWT Verify** on a fixed token signed with `secret`, so the output is the same on every run. A test of JWT Sign cannot be replayed: Sign stamps the current time (`iat`) into every token, and Kane recorded that exact token in the check's locator, so the recording failed on every build, the good one included. WITNESS called those runs ENV and blamed nobody.
