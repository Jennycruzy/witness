---
test: ../sql_beautify_keeps_the_space_in_on_dupli_test.md
status: passed
started: 2026-11-24T19:50:50.934Z
duration_s: 101
session_id: b50d5a91-5dcf-4e43-9cd5-93351b7f845f
---

# SQL Beautify keeps the space in ON DUPLICATE KEY UPDATE — Result

## Search for operation ✓ passed (28.4s)
md5: 7210d0e301676f974bc9715fb64ad530
Type "SQL Beautify" in the Operations search box

## Add SQL Beautify ✓ passed (19.4s)
md5: dfc840330878243da0185a1d93f7fa57
Double-click "SQL Beautify" in the operations list to add it to the recipe

## Enter upsert SQL ✓ passed (21.1s)
md5: ac412fe46e6c3c25e701ac68cf71c222
Click the Input box and type: INSERT INTO Table1 SELECT * FROM (SELECT :Bind1 as Field1, :Bind2 as Field2, :id as id) as new_data ON DUPLICATE KEY UPDATE Field1 = new_data.Field1, Field2 = new_data.Field2;

## Check KEY UPDATE spacing ✓ passed (25.8s)
md5: 9bf32d2ba2806f131c5ea98931452437
Verify the Output box contains the text "DUPLICATE KEY UPDATE"
