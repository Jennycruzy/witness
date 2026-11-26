---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# Search filter stays applied after toggling reconciled transactions

## Open Checking account
Click the "Checking" account in the sidebar.

## Add first transaction
Click "Add New", type "Coffee Shop" in the Payee field, type 12.00 in the Payment field, and click "Add".

## Add second transaction
Click "Add New", type "Book Store" in the Payee field, type 30.00 in the Payment field, and click "Add".

## Search for Coffee
Type "Coffee" in the account Search box.

## Toggle reconciled transactions
Open the account menu (⋯) next to the search box and click "Hide reconciled transactions" (or "Show reconciled transactions" if that is the option shown).

## Verify search still applied
Verify the transaction list has no row whose Payee shows "Book Store", while the Search box still contains "Coffee".
