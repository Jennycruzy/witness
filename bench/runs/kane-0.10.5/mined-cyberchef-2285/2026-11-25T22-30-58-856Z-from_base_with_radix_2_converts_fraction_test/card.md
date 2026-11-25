WITNESS verdict: APP_BUG. The same recording passes on the reference build and fails here at a check.
What to do: Fix the app, not the test.
Kane's own label was "application_issue" (0.98). It is not used to decide; the comparison is.

Test: from_base_with_radix_2_converts_fraction_test.md
1. Search operation: Type "From Base" in the Operations search box
2. Add From Base: Double-click the "From Base" operation in the Operations list to add it to the Recipe
3. Set radix: In the From Base recipe card, clear the Radix field and type "2"
4. Enter input: Click in the Input box and type "10.1"
5. Check output: Verify the Output box shows exactly "2.5"   <-- FAILED HERE

What Kane saw: The base-conversion operation is treating the valid binary value as an invalid number.

Target build:    Reference build: 
Change only the application source. Do not edit tests, recordings or build config.

When done, say which file and lines you changed and why.