WITNESS verdict: APP_BUG. The same recording passes on the reference build and fails here at a check.
What to do: Fix the app, not the test.
Kane's own label was "application_issue" (0.97). It is not used to decide; the comparison is.

Test: renaming_a_schedule_keeps_its_skipped_oc_test.md
1. Open new schedule: Click Schedules in the sidebar, then click Add new schedule.
2. Fill schedule form: Set Schedule Name to Internet. In Payee, type Internet company and click Create payee "Internet company". Set Account to Checking and Amount to 50. Keep the default monthly recurrence starting today, leave Automatically add transaction unchecked, and click Add.
3. Skip next occurrence: In the "Internet" schedule row, click the Menu button (⋯) and click Skip next scheduled date.
4. Rename the schedule: Click the "Internet" schedule row, change only Schedule Name to Broadband, and click Save.
5. Check schedule status: Verify the Status cell of the "Broadband" row in the schedules list shows "Scheduled".   <-- FAILED HERE

What Kane saw: The schedules list is showing a status for Broadband that does not match the required Scheduled status.

Target build: https://deploy-preview-9336.demo.actualbudget.org   Reference build: https://edge.actualbudget.org
Change only the application source. Do not edit tests, recordings or build config.

When done, say which file and lines you changed and why.