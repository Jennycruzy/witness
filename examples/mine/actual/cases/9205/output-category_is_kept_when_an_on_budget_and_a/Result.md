---
test: ../category_is_kept_when_an_on_budget_and_a_test.md
status: passed
started: 2026-11-24T22:13:43.178Z
duration_s: 371
session_id: 56bf29a3-a638-4f69-a03d-a4473d755459
---

# Category is kept when an on-budget and an off-budget transaction are made into a transfer — Result

## Create off-budget account ✓ passed (30.2s)
md5: 409ed6095c2907f73c1353a51dad67e2
Click "Add account" in the sidebar, choose to create a local account named "Loan", tick the "Off budget" option, leave the starting balance at 0 and create it.

## Add Checking transaction ✓ passed (98.5s)
md5: d314f2bff19e851e95d3a9d02d7a7675
Open the "Checking" account, click "Add New", enter Payee "Store", Category "Food", Payment "50.00", and click "Add".

## Add Loan transaction ✓ passed (136.2s)
md5: b9b1bfa99acd6e4eabbfba5d0f2f82d4
Open the "Loan" account, click "Add New", enter Payee "Store", Deposit "50.00", leave Category empty, and click "Add".

## Make the transfer ✓ passed (67.6s)
md5: 057603b59f20c68bff2ca108df4d4d6d
Open "All accounts", tick the checkboxes of both 50.00 transactions, open the selected-transactions menu, and choose "Make transfer".

## Open Checking account ✓ passed (13.8s)
md5: 5e2a0d41e89331f972667dbe679d4f26
Click the "Checking" account in the sidebar.

## Verify category kept ✓ passed (18.6s)
md5: 6810be399d3ed8b5cc2a802fedb93175
Verify the Category cell of the 50.00 payment row in the Checking account shows "Food".
