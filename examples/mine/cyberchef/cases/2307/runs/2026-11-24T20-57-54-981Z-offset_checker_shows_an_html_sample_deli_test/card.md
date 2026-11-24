WITNESS verdict: APP_BUG. The same recording passes on the reference build and fails here at a check.
What to do: Fix the app, not the test.
Kane's own label was "application_issue" (0.99). It is not used to decide; the comparison is.

Test: offset_checker_shows_an_html_sample_deli_test.md
1. Find Offset checker: Type "Offset checker" in the Operations search box.
2. Add to recipe: Double-click "Offset checker" in the operations list to add it to the recipe.
3. Set sample delimiter: In the Offset checker recipe card, clear the Sample delimiter field and type <b>X</b>
4. Enter input: Click the Input box and type AA<b>X</b>AB
5. Check output text: Verify the Output box shows exactly "AA<b>X</b>AB" with the <b> and </b> tags visible as literal text.   <-- FAILED HERE

What Kane saw: The Output box is treating the angle-bracket text as formatting instead of showing it as ordinary text.

Target build:    Reference build: 
Change only the application source. Do not edit tests, recordings or build config.

When done, say which file and lines you changed and why.