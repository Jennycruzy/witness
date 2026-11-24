---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# SQL Beautify keeps the space in ON DUPLICATE KEY UPDATE

## Search for operation
Type "SQL Beautify" in the Operations search box

## Add SQL Beautify
Double-click "SQL Beautify" in the operations list to add it to the recipe

## Enter upsert SQL
Click the Input box and type: INSERT INTO Table1 SELECT * FROM (SELECT :Bind1 as Field1, :Bind2 as Field2, :id as id) as new_data ON DUPLICATE KEY UPDATE Field1 = new_data.Field1, Field2 = new_data.Field2;

## Check KEY UPDATE spacing
Verify the Output box contains the text "DUPLICATE KEY UPDATE"
