WITNESS verdict: ENV. The same recording does not pass on the reference build either.
What to do: Check the environment or the reference build before changing anything.
Kane's own label was "application_issue" (0.93). It is not used to decide; the comparison is.

Test: running_balance_test.md
1. Open the Wallet account: Click "Wallet" in the sidebar and wait for its transactions to show.
2. Edit the deposit: Click the Deposit amount 20.00 of the transaction, change it to 50.00 and press Enter.
3. Check the running balance: Verify the Balance column for the transaction shows 50.00.   <-- FAILED HERE

What Kane saw: The account page displayed a value other than 50.00 for the transaction balance.

Target build:    Reference build: 

When done, say which file and lines you changed and why.