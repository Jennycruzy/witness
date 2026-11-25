---
test: ../renaming_a_schedule_keeps_its_skipped_oc_test.md
status: passed
started: 2026-11-24T22:06:15.713Z
duration_s: 164
session_id: 12a621ef-76ab-406a-95ab-a2135b551008
---

# Renaming a schedule keeps its skipped occurrence skipped — Result

## Open new schedule ✓ passed (29.8s)
md5: cfa24c72ccaedc36f1f0dd3b1dbafcc9
Click Schedules in the sidebar, then click Add new schedule.

## Fill schedule form ✓ passed (57.9s)
md5: 17ceccccfd08a087a42a2f2ad82ad66f
Set Schedule Name to Internet. In Payee, type Internet company and click Create payee "Internet company". Set Account to Checking and Amount to 50. Keep the default monthly recurrence starting today, leave Automatically add transaction unchecked, and click Add.

## Skip next occurrence ✓ passed (19.9s)
md5: 2393284c6305600cc914e9506d4a9ac5
In the "Internet" schedule row, click the Menu button (⋯) and click Skip next scheduled date.

## Rename the schedule ✓ passed (30.7s)
md5: 980c16c2127a394c2a5f47b21c357260
Click the "Internet" schedule row, change only Schedule Name to Broadband, and click Save.

## Check schedule status ✓ passed (19.3s)
md5: c453be8defb618e6ee145330c75efebf
Verify the Status cell of the "Broadband" row in the schedules list shows "Scheduled".
