---
test: ../backslash_at_end_of_line_becomes_a_hard__test.md
status: passed
started: 2026-11-25T22:13:23.432Z
duration_s: 152
session_id: 2cdcd042-50c4-480c-b5bc-46a27425cf5f
---

# Backslash at end of line becomes a hard line break, not a literal backslash — Result

## Type first line ✓ passed (48.8s)
md5: 8e14ef704b9b6c3649f1ea2b43980669
In the empty editor, press the keys f, o, o, Backslash

## Insert line break ✓ passed (10.7s)
md5: 4ff1a5f623e74ffbcc02701f7ae31a52
Press Shift+Enter to start a new line in the same paragraph

## Type second line ✓ passed (25.3s)
md5: 0e2328c102da765882ee6ef76c1e470a
Press the keys b, a, z

## Leave the paragraph ✓ passed (18.2s)
md5: a0faefc74430d45cf896421c00de6c00
Press Enter twice so the cursor moves into a new empty paragraph below

## Check rendered break ✓ passed (42.9s)
md5: cf40b8b97078d5d977be2545aa0ba318
Verify the first paragraph shows "foo" on its first line and "baz" on its second line, and that no backslash character "\" is shown after "foo". MarkText draws a small curved arrow (↵) at the end of a line that has a line break; that arrow is expected and is not a backslash
