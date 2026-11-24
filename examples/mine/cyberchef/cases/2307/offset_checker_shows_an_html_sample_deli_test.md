---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# Offset checker shows an HTML sample delimiter as literal text in the Output

## Find Offset checker
Type "Offset checker" in the Operations search box.

## Add to recipe
Double-click "Offset checker" in the operations list to add it to the recipe.

## Set sample delimiter
In the Offset checker recipe card, clear the Sample delimiter field and type <b>X</b>

## Enter input
Click the Input box and type AA<b>X</b>AB

## Check output text
Verify the Output box shows exactly "AA<b>X</b>AB" with the <b> and </b> tags visible as literal text.
