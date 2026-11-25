WITNESS verdict: APP_BUG. The same recording passes on the reference build and fails here at a check.
What to do: Fix the app, not the test.
Kane's own label was "application_issue" (0.91). It is not used to decide; the comparison is.

Test: escape_discards_test.md
1. Add a todo: Type "buy milk" in the new todo box and press Enter.
2. Start editing: Double-click the "buy milk" todo to edit it.
3. Change the text and cancel: Replace the text in the edit box with "changed", then press Escape.
4. Click the new todo box: Click the "What needs to be done?" box.
5. Check the todo: Verify the todo list shows exactly one todo and its text is "buy milk".   <-- FAILED HERE

What Kane saw: The app displayed the wrong todo text for the required list state.

Target build: ../builds/todomvc/react/dist   Reference build: ../builds/todomvc/vue/dist
Change only the application source. Do not edit tests, recordings or build config.

When done, say which file and lines you changed and why.