WITNESS verdict: APP_BUG. The same recording passes on the reference build and fails here at a check.
What to do: Fix the app, not the test.
Kane's own label was "application_issue" (0.96). It is not used to decide; the comparison is.

Test: from_hex_then_url_encode_encodes_byte_0x_test.md
1. Add From Hex: Type "From Hex" in the Operations search box and double-click "From Hex" in the list to add it to the recipe
2. Set delimiter None: In the From Hex recipe card, choose "None" in the Delimiter dropdown
3. Add URL Encode: Type "URL Encode" in the Operations search box and double-click "URL Encode" in the list to add it to the recipe below From Hex
4. Enter hex input: Click in the Input box and type 6c6567697466696c6580
5. Check encoded output: Verify the Output box shows exactly "legitfile%80"   <-- FAILED HERE

What Kane saw: The conversion treated the final byte as a text character and encoded its UTF-8 form, adding C2, rather than preserving that byte as %80.

Target build:    Reference build: 
Change only the application source. Do not edit tests, recordings or build config.

When done, say which file and lines you changed and why.