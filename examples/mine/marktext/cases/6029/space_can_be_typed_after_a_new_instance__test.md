---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# Space can be typed after a new instance of the current find query at line end

## Open find box
Press Ctrl+F to open the find box

## Search for ab
Type "ab" in the find box

## Return to editor
Click in the empty editor area below the find box so the cursor is in the empty first line of the document

## Type query then more
Press the keys a, b, Space, c, d

## Check typed line
Verify the first paragraph in the editor shows exactly "ab cd" with a space between "ab" and "cd"
