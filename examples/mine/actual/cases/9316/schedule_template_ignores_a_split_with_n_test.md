---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# Schedule template ignores a split with no category (the transfer split) when budgeting a category

## Add Savings account
Click "Add account" in the sidebar and create a local on-budget account named "Savings" with a starting balance of 0.

## Create Paycheck schedule
Go to Schedules, click "Add new schedule", set Name to "Paycheck", Account to "Checking", Amount to 100.00 as a payment, check "Repeats" set to Monthly, and click "Add".

## Split the schedule rule
Open the "Paycheck" schedule, edit it as a rule, choose "Split into multiple transactions", set split 1 to category "Bills" with a fixed amount of 30.00, add split 2 with payee set to "Savings", and save the rule.

## Add template note
Go to the Budget page, open the menu of the "Bills" category, choose "Notes", type "#template-0 schedule Paycheck" and close the notes.

## Apply Bills template
Click the Budgeted cell of the "Bills" row for the current month, open its menu and choose "Apply budget template".

## Check Bills budgeted
Verify the Budgeted cell of the "Bills" row for the current month shows "30.00".
