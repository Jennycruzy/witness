WITNESS verdict: APP_BUG. The same recording passes on the reference build and fails here at a check.
What to do: Fix the app, not the test.
Kane's own label was "application_issue" (0.9). It is not used to decide; the comparison is.

Test: to_html_entity_encodes_as_a_well_formed__test.md
1. Search for operation: Type "To HTML Entity" in the Operations search box.
2. Add operation to recipe: Double-click "To HTML Entity" in the Operations list to add it to the Recipe.
3. Enter the character: Click in the Input box and type the single character "⇌".
4. Check encoded output: Verify the Output box shows exactly "&rlhar;".   <-- FAILED HERE

What Kane saw: The HTML entity conversion is producing an extra character at the end of the named entity.

Target build:    Reference build: 
Change only the application source. Do not edit tests, recordings or build config.

When done, say which file and lines you changed and why.