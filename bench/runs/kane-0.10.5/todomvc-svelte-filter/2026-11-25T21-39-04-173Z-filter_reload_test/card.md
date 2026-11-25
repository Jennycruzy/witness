WITNESS verdict: APP_BUG. The same recording passes on the reference build and fails here at a check.
What to do: Fix the app, not the test.
Kane's own label was "application_issue" (0.96). It is not used to decide; the comparison is.

Test: filter_reload_test.md
1. Add two todos: Type "Buy milk" in the new todo box and press Enter, then type "Walk dog" and press Enter.
2. Complete one todo: Tick the checkbox next to "Buy milk".
3. Show completed todos: Click the "Completed" filter.
4. Reload: Reload the page.
5. Add a todo after the reload: Type "Call mom" in the new todo box and press Enter.
6. Check the filter: Verify the "Completed" filter is the selected filter.   <-- FAILED HERE

What Kane saw: The page address is set to the Completed view, but the filter selection and displayed todo list remain in the All view.

Target build: ../../examples/todomvc-svelte/builds/upstream/dist   Reference build: ../../examples/todomvc-svelte/reference/dist
Change only the application source. Do not edit tests, recordings or build config.

When done, say which file and lines you changed and why.