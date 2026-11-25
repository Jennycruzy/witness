---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# Backslash at end of line becomes a hard line break, not a literal backslash

## Type first line
In the empty editor, press the keys f, o, o, Backslash

## Insert line break
Press Shift+Enter to start a new line in the same paragraph

## Type second line
Press the keys b, a, z

## Leave the paragraph
Press Enter twice so the cursor moves into a new empty paragraph below

## Check rendered break
Verify the first paragraph shows "foo" on its first line and "baz" on its second line, and that no backslash character "\" is shown after "foo". MarkText draws a small curved arrow (↵) at the end of a line that has a line break; that arrow is expected and is not a backslash
