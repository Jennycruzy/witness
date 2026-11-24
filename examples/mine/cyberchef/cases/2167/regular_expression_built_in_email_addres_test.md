---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# Regular expression built-in Email address regex matches an email with an IPv4 domain

## Add Regular expression
Type "Regular expression" in the Operations search box and double-click the "Regular expression" operation in the list to add it to the recipe.

## Choose email regex
In the Regular expression recipe card, choose "Email address" from the Built in regexes dropdown.

## List matches output
In the same recipe card, choose "List matches" from the Output format dropdown.

## Enter test input
Click the Input box and type false_negative@[1.2.3.4]

## Check matched address
Verify the Output box shows exactly "false_negative@[1.2.3.4]".
