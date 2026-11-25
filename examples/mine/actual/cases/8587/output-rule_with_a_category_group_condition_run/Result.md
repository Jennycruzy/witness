---
test: ../rule_with_a_category_group_condition_run_test.md
status: passed
started: 2026-11-24T21:09:01.834Z
duration_s: 242
session_id: 02a50274-4a41-4dfc-a8ed-954dfb1cb736
---

# Rule with a category group condition runs when a new transaction is saved — Result

## Open new rule ✓ passed (32.3s)
md5: 44479fa678d935e54550cccd10485185
In the sidebar click More, then Rules, then click "Create new rule".

## Set group condition ✓ passed (34.2s)
md5: e6c99478b19b354bd95238f81158ad4b
In the rule's condition choose the field "category group", the operator "is" and the value "Usual Expenses".

## Set notes action ✓ passed (35.2s)
md5: 2bc90130c3ff7266c1c19751629ac259
In the rule's action choose "set" "notes" to "grouptest", then click Save.

## Add Food transaction ✓ passed (110.1s)
md5: cd21404f47edde1b2af40a9500523264
In the sidebar click the "Checking" account, click "Add New", type "Grocer" as the Payee, choose "Food" as the Category, type 10.00 as the Payment, and click "Add".

## Check transaction notes ✓ passed (24.2s)
md5: e95e4e2c0a3d5a044c246e8c9e70a903
Verify the Notes cell of the "Grocer" transaction row shows "grouptest".
