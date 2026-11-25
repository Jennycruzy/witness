---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# Folded heading content stays folded after switching tabs and back

## Write heading and text
Press the keys #, Space, h, i, Enter, x, y, z so the editor shows a heading "hi" with a paragraph "xyz" below it

## Fold the heading
Hover over the heading "hi" and click its fold arrow on the left so the paragraph "xyz" is hidden

## Open another tab
Press Ctrl+T to open a new empty tab

## Switch back
Click the "note.md" tab at the top of the editor to switch back to it

## Check fold kept
Verify the heading "hi" is shown and the paragraph text "xyz" is not visible anywhere in the editor
