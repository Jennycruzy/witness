---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# JWT Verify decodes a valid token

## Add the JWT Verify operation
In the "Search..." box above the Operations list, type "JWT Verify", then double-click the "JWT Verify" operation in the results so it is added to the Recipe.

## Enter the secret
In the "JWT Verify" card in the Recipe, type "secret" into the "Public/Secret Key" field.

## Enter the token
Click in the Input box and type eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoid2l0bmVzcyIsInJvbGUiOiJ0ZXN0ZXIifQ.oUTA0lWFpM_5NtPy7LCcTduzrMigH95qzsKxKMkhOkA

## Check the output
Verify the Output box contains the word tester.
