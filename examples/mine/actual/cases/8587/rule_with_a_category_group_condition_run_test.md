---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# Rule with a category group condition runs when a new transaction is saved

## Open new rule
In the sidebar click More, then Rules, then click "Create new rule".

## Set group condition
In the rule's condition choose the field "category group", the operator "is" and the value "Usual Expenses".

## Set notes action
In the rule's action choose "set" "notes" to "grouptest", then click Save.

## Add Food transaction
In the sidebar click the "Checking" account, click "Add New", type "Grocer" as the Payee, choose "Food" as the Category, type 10.00 as the Payment, and click "Add".

## Check transaction notes
Verify the Notes cell of the "Grocer" transaction row shows "grouptest".
