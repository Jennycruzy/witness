WITNESS verdict: APP_BUG. The same recording passes on the reference build and fails here at a check.
What to do: Fix the app, not the test.
Kane's own label was "application_issue" (0.96). It is not used to decide; the comparison is.

Test: amount_is_greater_than_filter_hides_tran_test.md
1. Open Checking account: Click the "Checking" account in the sidebar.
2. Add small deposit: Click "Add New", type "Alpha" in the Payee field, type "100.00" in the Deposit field, and click "Add".
3. Add large deposit: Click "Add New", type "Beta" in the Payee field, type "200.00" in the Deposit field, and click "Add".
4. Filter by amount: Click "Filter", choose "Amount", select "is greater than", type "150" in the value field, and click "Apply".
5. Check filtered list: Verify the transaction list shows the row with Payee "Beta" and Deposit "200.00" and does not show any row with Payee "Alpha".   <-- FAILED HERE

What Kane saw: The list includes a transaction with payee Alpha in the result shown to the user.

Target build:    Reference build: 
Change only the application source. Do not edit tests, recordings or build config.

When done, say which file and lines you changed and why.