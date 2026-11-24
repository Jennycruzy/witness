---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# Category is kept when an on-budget and an off-budget transaction are made into a transfer

## Create off-budget account
Click "Add account" in the sidebar, choose to create a local account named "Loan", tick the "Off budget" option, leave the starting balance at 0 and create it.

## Add Checking transaction
Open the "Checking" account, click "Add New", enter Payee "Store", Category "Food", Payment "50.00", and click "Add".

## Add Loan transaction
Open the "Loan" account, click "Add New", enter Payee "Store", Deposit "50.00", leave Category empty, and click "Add".

## Make the transfer
Open "All accounts", tick the checkboxes of both 50.00 transactions, open the selected-transactions menu, and choose "Make transfer".

## Open Checking account
Click the "Checking" account in the sidebar.

## Verify category kept
Verify the Category cell of the 50.00 payment row in the Checking account shows "Food".
