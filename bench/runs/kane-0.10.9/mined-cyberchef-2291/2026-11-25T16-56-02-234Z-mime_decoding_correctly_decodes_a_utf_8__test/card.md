WITNESS verdict: APP_BUG. The same recording passes on the reference build and fails here at a check.
What to do: Fix the app, not the test.
Kane's own label was "application_issue" (0.99). It is not used to decide; the comparison is.

Test: mime_decoding_correctly_decodes_a_utf_8__test.md
1. Search MIME Decoding: Type "MIME Decoding" in the Operations search box.
2. Add operation: Double-click "MIME Decoding" in the Operations list to add it to the Recipe.
3. Enter encoded input: Click in the Input box and type: Subject: =?UTF-8?B?Y2Fmw6k=?=
4. Check decoded output: Verify the Output box shows exactly "Subject: café".   <-- FAILED HERE

What Kane saw: The MIME decoder is interpreting the encoded accented character with the wrong character encoding, so it displays a corrupted symbol instead of “é”.

Target build:    Reference build: 
Change only the application source. Do not edit tests, recordings or build config.

When done, say which file and lines you changed and why.