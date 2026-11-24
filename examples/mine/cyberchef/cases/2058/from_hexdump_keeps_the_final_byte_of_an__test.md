---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# From Hexdump keeps the final byte of an xxd dump with an odd number of bytes

## Search for operation
Type "From Hexdump" in the Operations search box

## Add to recipe
Double-click "From Hexdump" in the Operations list to add it to the Recipe

## Enter xxd hexdump
Click in the Input box and type "00000000: 6162 6364 65                             abcde"

## Check decoded output
Verify the Output box shows exactly "abcde"
