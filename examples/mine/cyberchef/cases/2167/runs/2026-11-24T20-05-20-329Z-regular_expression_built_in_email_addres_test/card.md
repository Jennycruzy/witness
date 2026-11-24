WITNESS verdict: TEST_PROBLEM. The page changed where the test acts: it failed at an action, not at a check.
What to do: Re-record the test on the target build, then run it again.
Kane's own label was "automation_bug" (0.92). It is not used to decide; the comparison is.

Test: regular_expression_built_in_email_addres_test.md
1. Add Regular expression: Type "Regular expression" in the Operations search box and double-click the "Regular expression" operation in the list to add it to the recipe.   <-- FAILED HERE
2. Choose email regex: In the Regular expression recipe card, choose "Email address" from the Built in regexes dropdown.
3. List matches output: In the same recipe card, choose "List matches" from the Output format dropdown.
4. Enter test input: Click the Input box and type false_negative@[1.2.3.4]
5. Check matched address: Verify the Output box shows exactly "false_negative@[1.2.3.4]".

What Kane saw: The search successfully showed the Regular expression operation, but the next recorded action did not match the required double-click interaction.

Target build:    Reference build: 

When done, say which file and lines you changed and why.