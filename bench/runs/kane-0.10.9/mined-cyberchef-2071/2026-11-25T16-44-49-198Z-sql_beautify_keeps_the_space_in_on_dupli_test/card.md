WITNESS verdict: APP_BUG. The same recording passes on the reference build and fails here at a check.
What to do: Fix the app, not the test.
Kane's own label was "application_issue" (0.98). It is not used to decide; the comparison is.

Test: sql_beautify_keeps_the_space_in_on_dupli_test.md
1. Search for operation: Type "SQL Beautify" in the Operations search box
2. Add SQL Beautify: Double-click "SQL Beautify" in the operations list to add it to the recipe
3. Enter upsert SQL: Click the Input box and type: INSERT INTO Table1 SELECT * FROM (SELECT :Bind1 as Field1, :Bind2 as Field2, :id as id) as new_data ON DUPLICATE KEY UPDATE Field1 = new_data.Field1, Field2 = new_data.Field2;
4. Check KEY UPDATE spacing: Verify the Output box contains the text "DUPLICATE KEY UPDATE"   <-- FAILED HERE

What Kane saw: The formatter joins two words in the SQL clause, so the output does not preserve the required text.

Target build:    Reference build: 
Change only the application source. Do not edit tests, recordings or build config.

When done, say which file and lines you changed and why.