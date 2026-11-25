---
test: ../account_search_for_a_multi_word_term_fin_test.md
status: passed
started: 2026-11-24T22:27:46.768Z
duration_s: 251
session_id: dead9575-6547-4c3e-a3fb-27a31d7fa78d
---

# Account search for a multi-word term finds the transaction that contains it — Result

## Open Checking account ✓ passed (19.5s)
md5: 5e2a0d41e89331f972667dbe679d4f26
Click the "Checking" account in the sidebar.

## Add matching transaction ✓ passed (97.7s)
md5: f4703e269bd93a98d4c46320f485899c
Click "Add New", type "Camera Store" in Payee, type "XF 35mm lens" in Notes, type "500.00" in Payment, and click "Add".

## Add other transaction ✓ passed (82.8s)
md5: 99a1ed13bdf906734f7cd12d13cb9c44
Click "Add New", type "Grocery Mart" in Payee, type "weekly food" in Notes, type "20.00" in Payment, and click "Add".

## Search for term ✓ passed (17.1s)
md5: d40dadd7116c8148f7bd1e84fd59496a
Click the Search box above the transaction list and type XF 35mm.

## Verify search result ✓ passed (28.5s)
md5: 7469430078f1ae2050c19d9cba7215ef
Verify the Notes cell of the first transaction row in the list shows "XF 35mm lens".
