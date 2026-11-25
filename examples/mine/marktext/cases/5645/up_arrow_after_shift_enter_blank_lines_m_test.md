---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# Up arrow after Shift+Enter blank lines moves to the previous blank line

## Create blank paragraph
Press the Enter key once in the empty editor

## Type test text
Press the keys t, e, s, t

## Insert blank lines
Press Shift+Enter, then press Shift+Enter again

## Move up and type
Press the Up arrow key once, then press the key x

## Check cursor position
Verify the letter "x" appears on the line directly below the word "test", not on the line above "test"
