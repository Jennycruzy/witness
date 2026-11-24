---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# Parse TLV with BER reads long-form length 82 00 05 as 5

## Add From Hex
Type "From Hex" in the Operations search box and double-click "From Hex" in the list to add it to the recipe

## Add Parse TLV
Type "Parse TLV" in the Operations search box and double-click "Parse TLV" in the list to add it to the recipe below From Hex

## Enable BER
In the Parse TLV recipe card, leave the type size and length size at 1 and tick the "Use BER" checkbox

## Enter TLV hex
Click in the Input box and type: 01 82 00 05 48 65 6c 6c 6f 02 03 41 42 43

## Check parsed length
Verify the Output box contains the text "length": 5
