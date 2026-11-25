---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# Bare www domain followed by a period renders as a link

## Type domain with period
In the empty editor, press the keys w, w, w, Period, e, Period, c, o, Period

## Leave the line
Press the Enter key so the cursor moves to a new empty line below

## Verify link rendered
Verify the first paragraph shows "www.e.co" as a formatted link element (link-styled text, not plain text), with the final "." after it shown as plain text outside the link
