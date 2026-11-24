---
test: ../dechunk_http_response_drops_the_terminat_test.md
status: passed
started: 2026-11-24T20:46:14.865Z
duration_s: 88
session_id: 9ae9792b-3aa6-4cea-b222-4d4d425f9c21
---

# Dechunk HTTP response drops the terminating zero chunk and trailer headers — Result

## Search operation ✓ passed (23.5s)
md5: e451a37118ef3e402082a53679bcbfe0
Type "Dechunk HTTP response" in the Operations search box

## Add to recipe ✓ passed (15.9s)
md5: a0186b4f93fed6cccfa74066b8946c93
Double-click "Dechunk HTTP response" in the Operations list to add it to the Recipe

## Enter chunked input ✓ passed (21.3s)
md5: 667d91a318e087ddcea8145cb1a665e1
Click the Input box and type these lines, pressing Enter after each one: "7", "Mozilla", "9", "Developer", "7", "Network", "0", "Expires: Wed, 21 Oct 2015 07:28:00 GMT"

## Check decoded output ✓ passed (20.2s)
md5: b5dd3fa53da2fa4fd0ce81ab4aa004b2
Verify the Output box shows exactly "MozillaDeveloperNetwork"
