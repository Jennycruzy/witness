---
mode: testing
url: http://127.0.0.1:5180/
max_steps: 60
---

# Actual Budget: accounts, transactions, rename and budget

## Create the Checking account
Click "Add account" in the sidebar and choose to create a local account. Enter the name "Checking", make sure it is on budget, enter a starting balance of 1250.00, and click "Create".

## Check the Checking account in the sidebar
Verify the sidebar lists an account named "Checking" with a balance of 1,250.00.

## Create the Savings account
Click "Add account" in the sidebar and choose to create a local account. Enter the name "Savings", make sure it is on budget, enter a starting balance of 5000.00, and click "Create".

## Check both accounts and the total
Verify the sidebar shows "Checking" with 1,250.00, "Savings" with 5,000.00, and the "All accounts" total as 6,250.00.

## Add a payment to Grocer in Checking
Click "Checking" in the sidebar, then click "Add New" to start a new transaction. Enter the payee "Grocer" (create it if asked), enter 45.20 in the Payment column, and press Enter or click "Add" to save it.

## Check the Grocer transaction and balance
Verify the Checking transaction list has a row with payee "Grocer" and a payment of 45.20, and the Checking account balance shows 1,204.80.

## Add a deposit from Salary in Checking
In the Checking account, click "Add New" to start another transaction. Enter the payee "Salary" (create it if asked), enter 300.00 in the Deposit column, and press Enter or click "Add" to save it.

## Check the Salary transaction
Verify the Checking transaction list has a row with payee "Salary" and a deposit of 300.00, and the "Grocer" row with a payment of 45.20 is still listed.

## Check the Checking balance and totals after both transactions
Verify the Checking account balance at the top of the page shows 1,504.80, the sidebar shows "Checking" with 1,504.80, and the "All accounts" total is 6,504.80.

## Open the Savings account
Click "Savings" in the sidebar.

## Check the Savings account is open
Verify the account page heading shows "Savings", its balance shows 5,000.00, and the transaction list does not contain "Grocer" or "Salary".

## Rename the Checking account
Click "Checking" in the sidebar, click the account name at the top of the page to edit it, change it to "Main checking", and press Enter.

## Check the renamed account
Verify the page heading and the sidebar both show "Main checking" with a balance of 1,504.80, and no account named "Checking" alone remains in the sidebar.

## Check the total is unchanged after the rename
Verify the sidebar shows "Main checking" with 1,504.80, "Savings" with 5,000.00, and the "All accounts" total is still 6,504.80.

## Open the Budget page
Click "Budget" in the sidebar.

## Check the To Budget amount
Verify the Budget page shows a "To Budget" amount of 6,250.00.
