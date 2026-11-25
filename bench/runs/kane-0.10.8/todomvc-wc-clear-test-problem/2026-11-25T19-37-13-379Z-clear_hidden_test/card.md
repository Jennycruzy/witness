WITNESS verdict: APP_BUG. The same recording passes on the reference build and fails here at a check.
What to do: Fix the app, not the test.
Kane's own label was "application_issue" (0.99). It is not used to decide; the comparison is.

Test: clear_hidden_test.md
1. Add a todo: Type "Buy milk" in the new todo box and press Enter.
2. Check the button: Verify there is no visible "Clear completed" button.   <-- FAILED HERE

What Kane saw: The footer is showing the cleanup button when it should be hidden.

Target build: ../builds/todomvc/web-components/dist   Reference build: ../builds/todomvc/vue/dist
Change only the application source. Do not edit tests, recordings or build config.

When done, say which file and lines you changed and why.