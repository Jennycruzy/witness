WITNESS verdict: UNKNOWN. Could not tell whether the failure was at a check or an action.
What to do: Read the evidence.
Kane's own label was "application_issue" (0.93). It is not used to decide; the comparison is.

Test: deleting_a_category_that_had_a_deposit_a_test.md
1. Add category deposit: Open the Checking account, click Add New, enter Payee "Refund", choose Category "Food", type 100.00 in the Deposit field and click Add.
2. Move money out: Go to the Budget page, click the Balance amount of the "Food" row in the current month, choose "Transfer to another category", enter 10.00, choose "General" and confirm.
3. Delete the category: Open the menu of the "Food" category, choose Delete, select "General" as the category to transfer to, and confirm the delete.
4. Open next month: Look at the month column to the right of the current month on the Budget page. If it is not shown, click the next-month arrow.
5. Check overspent line: Verify the "Overspent in" line of the next month's budget summary (above To Budget) shows "0.00".   <-- FAILED HERE

What Kane saw: The summary is formatting a zero overspent amount as negative zero.

Target build:    Reference build: 

When done, say which file and lines you changed and why.