---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# Set Difference returns each item only once when the first sample has duplicates

## Search for operation
Type "Set Difference" in the Operations search box

## Add to recipe
Double-click "Set Difference" in the Operations list to add it to the Recipe, leaving the Sample delimiter as \n\n and the Item delimiter as ,

## Enter first sample
Click in the Input box and type "red,red,blue", then press Enter twice

## Enter second sample
Type "blue" in the Input box on the new line

## Check output
Verify the Output box shows exactly "red"
