WITNESS verdict: TEST_PROBLEM. The page changed where the test acts: it failed at an action, not at a check.
What to do: Re-record the test on the target build, then run it again.
Kane's own label was "automation_bug" (0.78). It is not used to decide; the comparison is.

Test: amount_is_greater_than_filter_hides_tran_test.md
1. Open Checking account: Click the "Checking" account in the sidebar.
2. Add small deposit: Click "Add New", type "Alpha" in the Payee field, type "100.00" in the Deposit field, and click "Add".   <-- FAILED HERE
3. Add large deposit: Click "Add New", type "Beta" in the Payee field, type "200.00" in the Deposit field, and click "Add".
4. Filter by amount: Click "Filter", choose "Amount", select "is greater than", type "150" in the value field, and click "Apply".
5. Check filtered list: Verify the transaction list shows the row with Payee "Beta" and Deposit "200.00" and does not show any row with Payee "Alpha".

What Kane saw: The saved target for the Deposit field appears to have drifted from the current form, so the replay could not fill the intended amount box.

Target build: https://deploy-preview-9640.demo.actualbudget.org   Reference build: https://edge.actualbudget.org

When done, say which file and lines you changed and why.