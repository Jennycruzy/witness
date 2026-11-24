---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# Deleting a category that had a deposit and a budget transfer out creates no phantom overspend next month

## Add category deposit
Open the Checking account, click Add New, enter Payee "Refund", choose Category "Food", type 100.00 in the Deposit field and click Add.

## Move money out
Go to the Budget page, click the Balance amount of the "Food" row in the current month, choose "Transfer to another category", enter 10.00, choose "General" and confirm.

## Delete the category
Open the menu of the "Food" category, choose Delete, select "General" as the category to transfer to, and confirm the delete.

## Open next month
Look at the month column to the right of the current month on the Budget page. If it is not shown, click the next-month arrow.

## Check overspent line
Verify the "Overspent in" line of the next month's budget summary (above To Budget) shows "0.00".
