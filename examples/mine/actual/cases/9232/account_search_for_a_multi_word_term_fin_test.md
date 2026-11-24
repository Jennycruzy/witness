---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# Account search for a multi-word term finds the transaction that contains it

## Open Checking account
Click the "Checking" account in the sidebar.

## Add matching transaction
Click "Add New", type "Camera Store" in Payee, type "XF 35mm lens" in Notes, type "500.00" in Payment, and click "Add".

## Add other transaction
Click "Add New", type "Grocery Mart" in Payee, type "weekly food" in Notes, type "20.00" in Payment, and click "Add".

## Search for term
Click the Search box above the transaction list and type XF 35mm.

## Verify search result
Verify the Notes cell of the first transaction row in the list shows "XF 35mm lens".
