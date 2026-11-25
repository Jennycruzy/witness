WITNESS verdict: ENV. The same recording does not pass on the reference build either.
What to do: Check the environment or the reference build before changing anything.
Kane's own label was "automation_bug" (0.98). It is not used to decide; the comparison is.

Test: rule_with_a_category_group_condition_run_test.md
1. Open new rule: In the sidebar click More, then Rules, then click "Create new rule".   <-- FAILED HERE
2. Set group condition: In the rule's condition choose the field "category group", the operator "is" and the value "Usual Expenses".
3. Set notes action: In the rule's action choose "set" "notes" to "grouptest", then click Save.
4. Add Food transaction: In the sidebar click the "Checking" account, click "Add New", type "Grocer" as the Payee, choose "Food" as the Category, type 10.00 as the Payment, and click "Add".
5. Check transaction notes: Verify the Notes cell of the "Grocer" transaction row shows "grouptest".

What Kane saw: The test did not wait for the app to finish starting before trying to click More.

Target build: https://deploy-preview-9640.demo.actualbudget.org   Reference build: https://edge.actualbudget.org

When done, say which file and lines you changed and why.