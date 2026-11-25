---
test: ../account_transactions_stay_visible_after__test.md
status: passed
started: 2026-11-24T22:57:28.876Z
duration_s: 213
session_id: 7c81e352-94c4-4279-b30f-a8e4348733bd
---

# Account transactions stay visible after sorting by Date descending — Result

## Open Checking account ✓ passed (19.9s)
md5: 5e2a0d41e89331f972667dbe679d4f26
Click the "Checking" account in the sidebar.

## Add a transaction ✓ passed (144.6s)
md5: 709fd7cbbc56d4e0f7dec14c20bba302
Click "Add New", type "Grocer" in the Payee field, type "12.50" in the Payment field, and click the "Add" button.

## Sort by Date ✓ passed (12.5s)
md5: aef858151d71a36bfecf027389444f95
Click the "Date" column header of the transaction list.

## Sort Date descending ✓ passed (11.4s)
md5: 010ac043570bbc97d8c4cd45b1a3556a
Click the "Date" column header again so its sort arrow points down.

## Check entry still shown ✓ passed (18s)
md5: c0fd7fbaab6793a93a05a4c68fd7fccd
Verify the Payee cell of the transaction row in the Checking account list shows "Grocer".
