---
test: ../running_balance_stays_visible_when_trans_test.md
status: passed
started: 2026-11-24T22:22:28.406Z
duration_s: 163
session_id: c2e70f93-569a-4342-8c6f-526852429b86
---

# Running balance stays visible when transactions are sorted oldest first — Result

## Add a deposit ✓ passed (90.4s)
md5: 27e1e5c067b0a47707350903eca092f9
Open the "Checking" account, click "Add New", type "Employer" in the Payee field, type "100.00" in the Deposit field, and click "Add".

## Show running balance ✓ passed (24.4s)
md5: a5cada3a23d84fdd81acc0adb7cc1988
Click the three-dots menu at the top right of the account and click "Show running balance".

## Sort newest first ✓ passed (11.3s)
md5: bc1e944f01d6cd9f38fa69dde2abbc92
Click the "Date" column header once.

## Sort oldest first ✓ passed (12.5s)
md5: dcf2d65954f2c38c6421afdfe92952f4
Click the "Date" column header again so the oldest transaction is on top.

## Check running balance ✓ passed (18.9s)
md5: 8b6dbe6bad082583d6b75a8693d59a92
Verify the "Employer" transaction row has a running Balance column cell that shows "100.00".
