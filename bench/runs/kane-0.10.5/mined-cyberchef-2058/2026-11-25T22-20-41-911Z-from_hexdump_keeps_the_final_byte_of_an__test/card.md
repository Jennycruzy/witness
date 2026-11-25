WITNESS verdict: APP_BUG. The same recording passes on the reference build and fails here at a check.
What to do: Fix the app, not the test.
Kane's own label was "application_issue" (0.97). It is not used to decide; the comparison is.

Test: from_hexdump_keeps_the_final_byte_of_an__test.md
1. Search for operation: Type "From Hexdump" in the Operations search box
2. Add to recipe: Double-click "From Hexdump" in the Operations list to add it to the Recipe
3. Enter xxd hexdump: Click in the Input box and type "00000000: 6162 6364 65                             abcde"
4. Check decoded output: Verify the Output box shows exactly "abcde"   <-- FAILED HERE

What Kane saw: The hex decoding operation is leaving out the final byte of the supplied data.

Target build:    Reference build: 
Change only the application source. Do not edit tests, recordings or build config.

When done, say which file and lines you changed and why.