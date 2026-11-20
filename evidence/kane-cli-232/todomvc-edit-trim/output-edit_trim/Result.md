---
test: ../edit_trim_test.md
status: passed
started: 2026-11-17T17:41:12.143Z
duration_s: 91
session_id: c0a2bdcc-83bd-4182-b4d6-303568df3441
---

# Editing a todo trims the text and removes empty todos — Result

## Add two todos ✓ passed (5.24s)
md5: a44dfad4a39196fd158a7bc8dfd70fce
Type "a" in the new todo box and press Enter, then type "b" and press Enter.

## Clear the first todo by editing ✓ passed (3.15s)
md5: f7c98898fcb145db1e2511c4b9e71a0c
Double-click the todo "a", replace its text with three spaces and press Enter.

## Check the empty todo is gone ✓ passed (0.39s)
md5: 07e6e212e2fcd891ffbcb30ba8d3f050
Verify the todo list shows exactly one todo, "b".

## Edit with surrounding spaces ✓ passed (40.5s)
md5: ebf88f1077e514ddd12815ff47a98fee
Double-click the todo "b", select all of its text, type two spaces, the word spaced, two more spaces, then press Enter. Do not check the result in this step; the app is expected to change the text and the next step checks it.

## Check the text is trimmed ✓ passed (21.3s)
md5: 103ce218ae2867265bc8a2d537a30343
Verify the todo's text is exactly "spaced" with no leading or trailing spaces.
