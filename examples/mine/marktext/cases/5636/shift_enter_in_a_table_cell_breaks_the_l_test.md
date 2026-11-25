---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# Shift+Enter in a table cell breaks the line without showing a <br/> tag

## Create a table
Press the keys |, Space, a, Space, |, Space, b, Space, |, Enter to create a table with header cells "a" and "b".

## Place cursor in cell
Click right after the letter "a" in the first header cell of the table.

## Insert soft line break
Press Shift+Enter, then press the key c.

## Verify no br tag
Verify the first header cell of the table shows "a" and "c" on two separate lines and does not show the text "<br/>".
