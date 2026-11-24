---
test: ../parse_tlv_with_ber_reads_long_form_lengt_test.md
status: passed
started: 2026-11-24T20:42:40.683Z
duration_s: 131
session_id: 39d41186-2278-493f-aaf6-1e29591a1014
---

# Parse TLV with BER reads long-form length 82 00 05 as 5 — Result

## Add From Hex ✓ passed (32.8s)
md5: 7c84a4776033db1d5952187b2bd6d58c
Type "From Hex" in the Operations search box and double-click "From Hex" in the list to add it to the recipe

## Add Parse TLV ✓ passed (23.8s)
md5: 2554c3a799c58ca3bf7a081d98b9d54d
Type "Parse TLV" in the Operations search box and double-click "Parse TLV" in the list to add it to the recipe below From Hex

## Enable BER ✓ passed (21.4s)
md5: 449704efa050c46ea6d3acc8f7263326
In the Parse TLV recipe card, leave the type size and length size at 1 and tick the "Use BER" checkbox

## Enter TLV hex ✓ passed (21.1s)
md5: c093658c3ea3d0cc08a41084df880b2e
Click in the Input box and type: 01 82 00 05 48 65 6c 6c 6f 02 03 41 42 43

## Check parsed length ✓ passed (25.8s)
md5: db142270a29407416ae3989a7bd298d2
Verify the Output box contains the text "length": 5
