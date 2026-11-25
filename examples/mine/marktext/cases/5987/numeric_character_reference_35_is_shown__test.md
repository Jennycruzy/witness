---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# Numeric character reference &#35; is shown as # in the live editor

## Type numeric entity
Click in the empty editor and press the keys a, b, Space, &, #, 3, 5, Semicolon

## Move to new paragraph
Press the keys Enter, c, d so the cursor leaves the first paragraph

## Verify decoded text
Verify the first paragraph of the editor shows "ab #" and does not show "&#35;"
