---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# Account transactions stay visible after sorting by Date descending

## Open Checking account
Click the "Checking" account in the sidebar.

## Add a transaction
Click "Add New", type "Grocer" in the Payee field, type "12.50" in the Payment field, and click the "Add" button.

## Sort by Date
Click the "Date" column header of the transaction list.

## Sort Date descending
Click the "Date" column header again so its sort arrow points down.

## Check entry still shown
Verify the Payee cell of the transaction row in the Checking account list shows "Grocer".
