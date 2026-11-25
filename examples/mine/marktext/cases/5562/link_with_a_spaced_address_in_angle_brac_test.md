---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# Link with a spaced address in angle brackets renders as a link

## Type bracketed link
In the empty editor, press the keys [, a, ], (, <, /, b, Space, c, >, )

## Move to new line
Press the key Enter to move the cursor to a new line below

## Verify link rendered
Verify the first paragraph of the editor shows only the word "a" as a link, and the text "](</b c>)" does not appear in that paragraph
