---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# Renaming a schedule keeps its skipped occurrence skipped

## Open new schedule
Click Schedules in the sidebar, then click Add new schedule.

## Fill schedule form
Set Schedule Name to Internet. In Payee, type Internet company and click Create payee "Internet company". Set Account to Checking and Amount to 50. Keep the default monthly recurrence starting today, leave Automatically add transaction unchecked, and click Add.

## Skip next occurrence
In the "Internet" schedule row, click the Menu button (⋯) and click Skip next scheduled date.

## Rename the schedule
Click the "Internet" schedule row, change only Schedule Name to Broadband, and click Save.

## Check schedule status
Verify the Status cell of the "Broadband" row in the schedules list shows "Scheduled".
