WITNESS verdict: ENV. The same recording does not pass on the reference build either.
What to do: Check the environment or the reference build before changing anything.
Kane's own label was "automation_bug" (0.98). It is not used to decide; the comparison is.

Test: separator_test.md
1. Open the Wallet account: Click "Wallet" in the sidebar and wait for its transactions to show.
2. Add a deposit: Click "Add New", type 1'234.56 into the Deposit field of the new transaction and click "Add".
3. Check the amount: Verify the new transaction's Deposit shows 1'234.56.   <-- FAILED HERE

What Kane saw: The recorded flow did not reach the required completed-transaction state before checking the Deposit value. The live screen still shows the open row editor with an Add button and a date picker, rather than a saved transaction row.

Target build:    Reference build: 

When done, say which file and lines you changed and why.