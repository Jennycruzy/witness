WITNESS verdict: APP_BUG. The same recording passes on the reference build and fails here at a check.
What to do: Fix the app, not the test.
Kane's own label was "application_issue" (0.98). It is not used to decide; the comparison is.

Test: jwt_verify_test.md
1. Add the JWT Verify operation: In the "Search..." box above the Operations list, type "JWT Verify", then double-click the "JWT Verify" operation in the results so it is added to the Recipe.
2. Enter the secret: In the "JWT Verify" card in the Recipe, type "secret" into the "Public/Secret Key" field.
3. Enter the token: Click in the Input box and type eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoid2l0bmVzcyIsInJvbGUiOiJ0ZXN0ZXIifQ.oUTA0lWFpM_5NtPy7LCcTduzrMigH95qzsKxKMkhOkA
4. Check the output: Verify the Output box contains the word tester.   <-- FAILED HERE

What Kane saw: The JWT Verify operation fails while handling the supplied token and key, leaving an error message in the Output box rather than the verified payload.

Target build: builds/cyberchef-v10.23.0   Reference build: builds/cyberchef-v10.22.1
Change only the application source. Do not edit tests, recordings or build config.

When done, say which file and lines you changed and why.