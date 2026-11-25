WITNESS verdict: APP_BUG. The same recording passes on the reference build and fails here at a check.
What to do: Fix the app, not the test.
Kane's own label was "application_issue" (0.96). It is not used to decide; the comparison is.

Test: rule_with_a_category_group_condition_run_test.md
1. Open new rule: In the sidebar click More, then Rules, then click "Create new rule".
2. Set group condition: In the rule's condition choose the field "category group", the operator "is" and the value "Usual Expenses".
3. Set notes action: In the rule's action choose "set" "notes" to "grouptest", then click Save.
4. Add Food transaction: In the sidebar click the "Checking" account, click "Add New", type "Grocer" as the Payee, choose "Food" as the Category, type 10.00 as the Payment, and click "Add".
5. Check transaction notes: Verify the Notes cell of the "Grocer" transaction row shows "grouptest".   <-- FAILED HERE

What Kane saw: The application is not showing the saved note text for the Grocer transaction.

Target build:    Reference build: 
Change only the application source. Do not edit tests, recordings or build config.

When done, say which file and lines you changed and why.