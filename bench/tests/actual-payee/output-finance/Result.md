---
test: ../finance_test.md
status: passed
started: 2026-11-17T14:48:13.462Z
duration_s: 748
session_id: 902bad97-7a69-4f26-9a58-1e45c9df93b4
---

# Actual Budget: accounts, transactions, rename and budget — Result

## Create the Checking account ✓ passed (48.3s)
md5: 070218af45eebfcd015084bb2ac95814
Click "Add account" in the sidebar and choose to create a local account. Enter the name "Checking", make sure it is on budget, enter a starting balance of 1250.00, and click "Create".

## Check the Checking account in the sidebar ✓ passed (18.9s)
md5: f5dbd5377512fe71ec501385907bf08b
Verify the sidebar lists an account named "Checking" with a balance of 1,250.00.

## Create the Savings account ✓ passed (34.6s)
md5: 9d5a14e0ba45748fb95f9b890626c0d3
Click "Add account" in the sidebar and choose to create a local account. Enter the name "Savings", make sure it is on budget, enter a starting balance of 5000.00, and click "Create".

## Check both accounts and the total ✓ passed (20.3s)
md5: 2e4c0e547ebb46c6e2bb297a44cfa2c9
Verify the sidebar shows "Checking" with 1,250.00, "Savings" with 5,000.00, and the "All accounts" total as 6,250.00.

## Add a payment to Grocer in Checking ✓ passed (114.2s)
md5: 3975227485c836d2a43887751355ef17
Click "Checking" in the sidebar, then click "Add New" to start a new transaction. Enter the payee "Grocer" (create it if asked), enter 45.20 in the Payment column, and press Enter or click "Add" to save it.

## Check the Grocer transaction and balance ✓ passed (22.6s)
md5: 7771c73ffdd7e05a906366ec34c48404
Verify the Checking transaction list has a row with payee "Grocer" and a payment of 45.20, and the Checking account balance shows 1,204.80.

## Add a deposit from Salary in Checking ✓ passed (149.3s)
md5: 36d300b7e76c7893fc16d38724811cc6
In the Checking account, click "Add New" to start another transaction. Enter the payee "Salary" (create it if asked), enter 300.00 in the Deposit column, and press Enter or click "Add" to save it.

## Check the Salary transaction ✓ passed (28.3s)
md5: 52f8333fa4aa43af67e942543d3faa93
Verify the Checking transaction list has a row with payee "Salary" and a deposit of 300.00, and the "Grocer" row with a payment of 45.20 is still listed.

## Check the Checking balance and totals after both transactions ✓ passed (29.2s)
md5: 6e883a2ca493f58c75131b8575f7f605
Verify the Checking account balance at the top of the page shows 1,504.80, the sidebar shows "Checking" with 1,504.80, and the "All accounts" total is 6,504.80.

## Open the Savings account ✓ passed (14.2s)
md5: bdfa1d80a6febf45531172dbf1198ac5
Click "Savings" in the sidebar.

## Check the Savings account is open ✓ passed (28s)
md5: c150df01007be6dd4fbc2cf2b418766c
Verify the account page heading shows "Savings", its balance shows 5,000.00, and the transaction list does not contain "Grocer" or "Salary".

## Rename the Checking account ✓ passed (125.8s)
md5: 4dd05fe9db209a70f493c496df5cf8a7
Click "Checking" in the sidebar, click the account name at the top of the page to edit it, change it to "Main checking", and press Enter.

## Check the renamed account ✓ passed (31.7s)
md5: 04a95b452a7ef5468f557e4313b9c6d6
Verify the page heading and the sidebar both show "Main checking" with a balance of 1,504.80, and no account named "Checking" alone remains in the sidebar.

## Check the total is unchanged after the rename ✓ passed (19s)
md5: 5161a9bee6b31d9d8a96f22b59d6dc4b
Verify the sidebar shows "Main checking" with 1,504.80, "Savings" with 5,000.00, and the "All accounts" total is still 6,504.80.

## Open the Budget page ✓ passed (12.1s)
md5: 5abe4bef475f69c74b5653ac1bb1443a
Click "Budget" in the sidebar.

## Check the To Budget amount ✓ passed (18.5s)
md5: 8680e3bdf4b12fd6a7253ca08308f3f3
Verify the Budget page shows a "To Budget" amount of 6,250.00.
