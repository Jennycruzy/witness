---
test: ../from_hex_then_url_encode_encodes_byte_0x_test.md
status: passed
started: 2026-11-24T21:00:18.053Z
duration_s: 134
session_id: a60c013e-1c6e-48c6-818a-68c9c0db58db
---

# From Hex then URL Encode encodes byte 0x80 as %80 without an extra %C2 — Result

## Add From Hex ✓ passed (33.7s)
md5: 7c84a4776033db1d5952187b2bd6d58c
Type "From Hex" in the Operations search box and double-click "From Hex" in the list to add it to the recipe

## Set delimiter None ✓ passed (20.6s)
md5: 8bb3428e094c14a463a3f20ad09e1a19
In the From Hex recipe card, choose "None" in the Delimiter dropdown

## Add URL Encode ✓ passed (26.7s)
md5: 90bbeab7b9dedb0e7e7e0b63387ca730
Type "URL Encode" in the Operations search box and double-click "URL Encode" in the list to add it to the recipe below From Hex

## Enter hex input ✓ passed (20.2s)
md5: 3969cdde91599cb508ff586738fa1304
Click in the Input box and type 6c6567697466696c6580

## Check encoded output ✓ passed (26.2s)
md5: 7d6396fa6cf5ed9e8d2a61927e5c9c73
Verify the Output box shows exactly "legitfile%80"
