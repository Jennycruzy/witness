---
test: ../deleting_a_category_that_had_a_deposit_a_test.md
status: passed
started: 2026-11-24T21:34:14.422Z
duration_s: 318
session_id: c4dff413-4938-4f3b-9981-4bc4e072c9c5
---

# Deleting a category that had a deposit and a budget transfer out creates no phantom overspend next month — Result

## Add category deposit ✓ passed (91.8s)
md5: 4bcb3862fb6d1db647ee3eb12e30d701
Open the Checking account, click Add New, enter Payee "Refund", choose Category "Food", type 100.00 in the Deposit field and click Add.

## Move money out ✓ passed (108.3s)
md5: 1498d87595310467fb0cd7305f87ca9e
Go to the Budget page, click the Balance amount of the "Food" row in the current month, choose "Transfer to another category", enter 10.00, choose "General" and confirm.

## Delete the category ✓ passed (47.8s)
md5: 2f22da238b9e0a8c2184e98bad8964b8
Open the menu of the "Food" category, choose Delete, select "General" as the category to transfer to, and confirm the delete.

## Open next month ✓ passed (23.7s)
md5: b876730ab4f3234439a632bfeb2ca49d
Look at the month column to the right of the current month on the Budget page. If it is not shown, click the next-month arrow.

## Check overspent line ✓ passed (40s)
md5: 914163a8102e3cabaa8c56239bc293f6
Verify the "Overspent in" line of the next month's budget summary (above To Budget) shows "0.00".
