---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# Gzip with comment and file checksum round-trips through Gunzip

## Add Gzip operation
Type "Gzip" in the Operations search box and double-click the "Gzip" operation to add it to the recipe.

## Set comment and checksum
In the Gzip recipe card, type "test" in the Comment field and tick the "Include file checksum" checkbox.

## Add Gunzip operation
Type "Gunzip" in the Operations search box and double-click the "Gunzip" operation to add it to the recipe below Gzip.

## Enter input text
Click in the Input box and type "hello hello hello".

## Check round-trip output
Verify the Output box shows exactly "hello hello hello".
