---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# Amount 'is greater than' filter hides transactions at or below the value

## Open Checking account
Click the "Checking" account in the sidebar.

## Add small deposit
Click "Add New", type "Alpha" in the Payee field, type "100.00" in the Deposit field, and click "Add".

## Add large deposit
Click "Add New", type "Beta" in the Payee field, type "200.00" in the Deposit field, and click "Add".

## Filter by amount
Click "Filter", choose "Amount", select "is greater than", type "150" in the value field, and click "Apply".

## Check filtered list
Verify the transaction list shows the row with Payee "Beta" and Deposit "200.00" and does not show any row with Payee "Alpha".
