---
mode: testing
url: http://127.0.0.1:5191/
max_steps: 25
---

# Editing a todo trims the text and removes empty todos

## Add two todos
Type "a" in the new todo box and press Enter, then type "b" and press Enter.

## Clear the first todo by editing
Double-click the todo "a", replace its text with three spaces and press Enter.

## Check the empty todo is gone
Verify the todo list shows exactly one todo, "b".

## Edit with surrounding spaces
Double-click the todo "b", select all of its text, type two spaces, the word spaced, two more spaces, then press Enter. Do not check the result in this step; the app is expected to change the text and the next step checks it.

## Check the text is trimmed
Verify the todo's text is exactly "spaced" with no leading or trailing spaces.
