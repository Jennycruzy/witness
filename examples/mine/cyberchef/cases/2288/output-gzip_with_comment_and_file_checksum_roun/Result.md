---
test: ../gzip_with_comment_and_file_checksum_roun_test.md
status: passed
started: 2026-11-24T20:38:52.038Z
duration_s: 128
session_id: a39586df-00f1-4118-8c37-2b3cf871ef59
---

# Gzip with comment and file checksum round-trips through Gunzip — Result

## Add Gzip operation ✓ passed (29.7s)
md5: 5ae294570e29f4e171cbfc86de04e034
Type "Gzip" in the Operations search box and double-click the "Gzip" operation to add it to the recipe.

## Set comment and checksum ✓ passed (25.9s)
md5: a95ba6e61c1b8a38049cb909af2e4b21
In the Gzip recipe card, type "test" in the Comment field and tick the "Include file checksum" checkbox.

## Add Gunzip operation ✓ passed (25.5s)
md5: 638b0d6b9edb791b62a024c0deefb880
Type "Gunzip" in the Operations search box and double-click the "Gunzip" operation to add it to the recipe below Gzip.

## Enter input text ✓ passed (17.3s)
md5: 512f7be539d9779fbdf4d1be24d8625f
Click in the Input box and type "hello hello hello".

## Check round-trip output ✓ passed (23.1s)
md5: 49a20e71180879993d0d385fcb327529
Verify the Output box shows exactly "hello hello hello".
