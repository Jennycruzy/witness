---
test: ../search_filter_stays_applied_after_toggli_test.md
status: passed
started: 2026-11-24T22:46:52.726Z
duration_s: 297
session_id: 2e807ed0-79b4-48ec-b262-4e1b1dabc96d
---

# Search filter stays applied after toggling reconciled transactions — Result

## Open Checking account ✓ passed (19.2s)
md5: 5e2a0d41e89331f972667dbe679d4f26
Click the "Checking" account in the sidebar.

## Add first transaction ✓ passed (82.4s)
md5: b00f47d1806a1e925da32992bca97d58
Click "Add New", type "Coffee Shop" in the Payee field, type 12.00 in the Payment field, and click "Add".

## Add second transaction ✓ passed (103.5s)
md5: 42561c3f49256eec133cbefc76117042
Click "Add New", type "Book Store" in the Payee field, type 30.00 in the Payment field, and click "Add".

## Search for Coffee ✓ passed (9.7s)
md5: 807ea44c2e26e874dc8ae3d33c6d793b
Type "Coffee" in the account Search box.

## Toggle reconciled transactions ✓ passed (47.1s)
md5: 2af9bc238c2612c03d6415bdc320fc63
Open the account menu (⋯) next to the search box and click "Hide reconciled transactions" (or "Show reconciled transactions" if that is the option shown).

## Verify search still applied ✓ passed (29.1s)
md5: 41bb20101f53155c329b7114dc2653a8
Verify the transaction list has no row whose Payee shows "Book Store", while the Search box still contains "Coffee".
