---
test: ../amount_is_greater_than_filter_hides_tran_test.md
status: passed
started: 2026-11-24T21:20:18.929Z
duration_s: 269
session_id: 8dbee29a-9997-4ae6-9ca3-698cfc98bc6d
---

# Amount 'is greater than' filter hides transactions at or below the value — Result

## Open Checking account ✓ passed (22s)
md5: 5e2a0d41e89331f972667dbe679d4f26
Click the "Checking" account in the sidebar.

## Add small deposit ✓ passed (94s)
md5: 647c8ef75627479019f7bf98c68aa735
Click "Add New", type "Alpha" in the Payee field, type "100.00" in the Deposit field, and click "Add".

## Add large deposit ✓ passed (81.1s)
md5: c4d61379a0fe0676ee43d5d583977cf5
Click "Add New", type "Beta" in the Payee field, type "200.00" in the Deposit field, and click "Add".

## Filter by amount ✓ passed (34.7s)
md5: b060fc1155e410d7c6f64a00df54b87d
Click "Filter", choose "Amount", select "is greater than", type "150" in the value field, and click "Apply".

## Check filtered list ✓ passed (31.4s)
md5: b76b019d22d7b23551b90fc440761c2d
Verify the transaction list shows the row with Payee "Beta" and Deposit "200.00" and does not show any row with Payee "Alpha".
