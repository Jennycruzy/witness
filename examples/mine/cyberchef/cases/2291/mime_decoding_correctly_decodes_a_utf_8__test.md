---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# MIME Decoding correctly decodes a UTF-8 Base64 encoded word containing é

## Search MIME Decoding
Type "MIME Decoding" in the Operations search box.

## Add operation
Double-click "MIME Decoding" in the Operations list to add it to the Recipe.

## Enter encoded input
Click in the Input box and type: Subject: =?UTF-8?B?Y2Fmw6k=?=

## Check decoded output
Verify the Output box shows exactly "Subject: café".
