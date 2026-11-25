WITNESS verdict: APP_BUG. The same recording passes on the reference build and fails here at a check.
What to do: Fix the app, not the test.
Kane's own label was "application_issue" (0.98). It is not used to decide; the comparison is.

Test: extract_email_addresses_matches_an_email_test.md
1. Search for operation: Type "Extract email addresses" in the Operations search box.
2. Add operation to recipe: Double-click "Extract email addresses" in the Operations list to add it to the Recipe, leaving its checkboxes unchecked.
3. Enter input: Click in the Input box and type example@[127.0.0.1]
4. Check output: Verify the Output box shows exactly "example@[127.0.0.1]".   <-- FAILED HERE

What Kane saw: The selected email-extraction operation did not produce the expected address from the input, even though the input and recipe were present.

Target build:    Reference build: 
Change only the application source. Do not edit tests, recordings or build config.

When done, say which file and lines you changed and why.