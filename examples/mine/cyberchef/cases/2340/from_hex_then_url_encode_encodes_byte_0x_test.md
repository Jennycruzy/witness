---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# From Hex then URL Encode encodes byte 0x80 as %80 without an extra %C2

## Add From Hex
Type "From Hex" in the Operations search box and double-click "From Hex" in the list to add it to the recipe

## Set delimiter None
In the From Hex recipe card, choose "None" in the Delimiter dropdown

## Add URL Encode
Type "URL Encode" in the Operations search box and double-click "URL Encode" in the list to add it to the recipe below From Hex

## Enter hex input
Click in the Input box and type 6c6567697466696c6580

## Check encoded output
Verify the Output box shows exactly "legitfile%80"
