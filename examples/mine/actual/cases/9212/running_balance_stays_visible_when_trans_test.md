---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# Running balance stays visible when transactions are sorted oldest first

## Add a deposit
Open the "Checking" account, click "Add New", type "Employer" in the Payee field, type "100.00" in the Deposit field, and click "Add".

## Show running balance
Click the three-dots menu at the top right of the account and click "Show running balance".

## Sort newest first
Click the "Date" column header once.

## Sort oldest first
Click the "Date" column header again so the oldest transaction is on top.

## Check running balance
Verify the "Employer" transaction row has a running Balance column cell that shows "100.00".
