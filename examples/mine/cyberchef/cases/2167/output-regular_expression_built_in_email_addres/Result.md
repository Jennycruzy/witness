---
test: ../regular_expression_built_in_email_addres_test.md
status: passed
started: 2026-11-24T20:01:36.436Z
duration_s: 148
session_id: d321ace9-15a4-4d01-b900-4e330dfe8eb0
---

# Regular expression built-in Email address regex matches an email with an IPv4 domain — Result

## Add Regular expression ✓ passed (33.9s)
md5: 96eb853971e32adcc5c683e67b8d9525
Type "Regular expression" in the Operations search box and double-click the "Regular expression" operation in the list to add it to the recipe.

## Choose email regex ✓ passed (25.7s)
md5: 4dcaf834ced7d7702a1159e63a589431
In the Regular expression recipe card, choose "Email address" from the Built in regexes dropdown.

## List matches output ✓ passed (27.2s)
md5: 653975fef915ac4eaa758d5849d276cc
In the same recipe card, choose "List matches" from the Output format dropdown.

## Enter test input ✓ passed (25s)
md5: 1bf8baf31618abb99bf0504c359007fd
Click the Input box and type false_negative@[1.2.3.4]

## Check matched address ✓ passed (30.1s)
md5: 934a6b7bc2a2ba135d8af7220f68d9ae
Verify the Output box shows exactly "false_negative@[1.2.3.4]".
