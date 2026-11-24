---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# jq operation returns the selected field value instead of an error

## Search jq operation
Type "Jq" in the Operations search box

## Add jq to recipe
Double-click the "Jq" operation in the Operations list to add it to the recipe

## Enter jq query
Type ".a" in the Query field of the Jq recipe card

## Enter JSON input
Click the Input box and type {"a": 42}

## Check output value
Verify the Output box shows exactly "42"
