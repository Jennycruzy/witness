WITNESS verdict: ENV. The same recording does not pass on the reference build either.
What to do: Check the environment or the reference build before changing anything.
Kane's own label was "application_issue" (0.98). It is not used to decide; the comparison is.

Test: search_filter_stays_applied_after_toggli_test.md
1. Open Checking account: Click the "Checking" account in the sidebar.
2. Add first transaction: Click "Add New", type "Coffee Shop" in the Payee field, type 12.00 in the Payment field, and click "Add".
3. Add second transaction: Click "Add New", type "Book Store" in the Payee field, type 30.00 in the Payment field, and click "Add".
4. Search for Coffee: Type "Coffee" in the account Search box.
5. Toggle reconciled transactions: Open the account menu (⋯) next to the search box and click "Hide reconciled transactions" (or "Show reconciled transactions" if that is the option shown).
6. Verify search still applied: Verify the transaction list has no row whose Payee shows "Book Store", while the Search box still contains "Coffee".   <-- FAILED HERE

What Kane saw: The transaction search is not removing a row that does not match the entered search text.

Target build:    Reference build: 

When done, say which file and lines you changed and why.