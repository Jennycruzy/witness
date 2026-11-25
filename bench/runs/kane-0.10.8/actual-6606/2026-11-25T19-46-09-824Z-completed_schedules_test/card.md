WITNESS verdict: APP_BUG. The same recording passes on the reference build and fails here at a check.
What to do: Fix the app, not the test.
Kane's own label was "application_issue" (0.98). It is not used to decide; the comparison is.

Test: completed_schedules_test.md
1. Open Schedules: Click "Schedules" in the sidebar.
2. Complete the Rent schedule: Open the menu at the end of the "Rent" schedule's row and choose "Complete". The Rent schedule disappears from the list.
3. Show completed schedules: Click "Show completed schedules". The Rent schedule is listed again, marked Completed.
4. Leave and come back: Click "Budget" in the sidebar, then click "Schedules" in the sidebar again.
5. Check completed schedules are hidden: Verify the Rent schedule is not listed and the "Show completed schedules" link is shown.   <-- FAILED HERE

What Kane saw: The page is displaying a completed schedule in the regular list instead of hiding it and offering the completed-schedules link.

Target build: builds/actual-26.1.0/package/build   Reference build: builds/actual-26.2.0/package/build
Change only the application source. Do not edit tests, recordings or build config.

When done, say which file and lines you changed and why.