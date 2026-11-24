WITNESS verdict: APP_BUG. The same recording passes on the reference build and fails here at a check.
What to do: Fix the app, not the test.
Kane's own label was "application_issue" (0.99). It is not used to decide; the comparison is.

Test: parse_ip_range_reports_the_network_addre_test.md
1. Search for operation: Type "Parse IP range" in the Operations search box
2. Add to recipe: Double-click "Parse IP range" in the Operations list to add it to the Recipe
3. Enter CIDR input: Click in the Input box and type "10.1.2.3/24"
4. Check network line: Verify the first line of the Output box shows "Network: 10.1.2.0"   <-- FAILED HERE

What Kane saw: The IP-range result is showing the entered device address on the Network line rather than the network address calculated from the /24 range.

Target build:    Reference build: 
Change only the application source. Do not edit tests, recordings or build config.

When done, say which file and lines you changed and why.