---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# Rule condition 'notes matches' accepts a value containing a backslash

## Open Rules page
In the sidebar, click More, then click Rules.

## Create new rule
Click the "Create new rule" button.

## Set notes matches
In the first condition row, change the field to "notes" and the operator to "matches".

## Type backslash value
Click the value field of that condition and type asdfasdf\

## Check value field
Verify the value field of the notes "matches" condition in the rule editor shows "asdfasdf\".
