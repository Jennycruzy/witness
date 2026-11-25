WITNESS verdict: APP_BUG. The same recording passes on the reference build and fails here at a check.
What to do: Fix the app, not the test.
Kane's own label was "application_issue" (0.98). It is not used to decide; the comparison is.

Test: backslash_at_end_of_line_becomes_a_hard__test.md
1. Type first line: In the empty editor, press the keys f, o, o, Backslash
2. Insert line break: Press Shift+Enter to start a new line in the same paragraph
3. Type second line: Press the keys b, a, z
4. Leave the paragraph: Press Enter twice so the cursor moves into a new empty paragraph below
5. Check rendered break: Verify the first paragraph shows "foo" on its first line and "baz" on its second line, and that no backslash character "\" is shown after "foo". MarkText draws a small curved arrow (↵) at the end of a line that has a line break; that arrow is expected and is not a backslash   <-- FAILED HERE

What Kane saw: The editor is rendering extra visible characters in the first line before the line break.

Target build:    Reference build: 
Change only the application source. Do not edit tests, recordings or build config.

When done, say which file and lines you changed and why.