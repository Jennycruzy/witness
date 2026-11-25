WITNESS verdict: APP_BUG. The same recording passes on the reference build and fails here at a check.
What to do: Fix the app, not the test.
Kane's own label was "application_issue" (0.99). It is not used to decide; the comparison is.

Test: dechunk_http_response_drops_the_terminat_test.md
1. Search operation: Type "Dechunk HTTP response" in the Operations search box
2. Add to recipe: Double-click "Dechunk HTTP response" in the Operations list to add it to the Recipe
3. Enter chunked input: Click the Input box and type these lines, pressing Enter after each one: "7", "Mozilla", "9", "Developer", "7", "Network", "0", "Expires: Wed, 21 Oct 2015 07:28:00 GMT"
4. Check decoded output: Verify the Output box shows exactly "MozillaDeveloperNetwork"   <-- FAILED HERE

What Kane saw: The dechunk operation does not stop the output at the zero-length final chunk and includes the following trailer header.

Target build:    Reference build: 
Change only the application source. Do not edit tests, recordings or build config.

When done, say which file and lines you changed and why.