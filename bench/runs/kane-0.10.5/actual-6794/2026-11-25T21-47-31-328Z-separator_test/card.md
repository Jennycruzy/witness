WITNESS verdict: ENV. The same recording does not pass on the reference build either.
What to do: Check the environment or the reference build before changing anything.
Kane's own label was "automation_bug" (0.86). It is not used to decide; the comparison is.

Test: separator_test.md
1. Open the Wallet account: Click "Wallet" in the sidebar and wait for its transactions to show.
2. Add a deposit: Click "Add New", type 1'234.56 into the Deposit field of the new transaction and click "Add".
3. Check the amount: Verify the new transaction's Deposit shows 1'234.56.   <-- FAILED HERE

What Kane saw: The test tried to read the new transaction while it was still being edited. The screen shows a deposit of 1.00 and an available Add button, so there was no completed transaction with the expected amount to check.

Target build:    Reference build: 

When done, say which file and lines you changed and why.