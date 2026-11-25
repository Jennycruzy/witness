WITNESS verdict: APP_BUG. The same recording passes on the reference build and fails here at a check.
What to do: Fix the app, not the test.
Kane's own label was "automation_bug" (0.98). It is not used to decide; the comparison is.

Test: blank_ignored_test.md
1. Try a blank todo: Type three spaces in the new todo box and press Enter.
2. Add a real todo: Type "Buy milk" in the new todo box and press Enter.
3. Check the counter: Verify the footer counter reads "1 item left".   <-- FAILED HERE

What Kane saw: The recording did not set the todo list to the one-unfinished-item state required by its footer check.

Target build: ../builds/todomvc/lit/dist   Reference build: ../builds/todomvc/vue/dist
Change only the application source. Do not edit tests, recordings or build config.

When done, say which file and lines you changed and why.