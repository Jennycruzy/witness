---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# Pressing End with a selection across two paragraphs keeps the text

## Type two paragraphs
Press the keys a, b, c, Enter, x, y, z

## Select across both
Press Shift+ArrowUp, then press Shift+Home so the selection runs from the start of "abc" to the end of "xyz"

## Press End key
Press the End key once

## Check text kept
Verify the first paragraph of the editor still shows "abc"
