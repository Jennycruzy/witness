---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# Dechunk HTTP response drops the terminating zero chunk and trailer headers

## Search operation
Type "Dechunk HTTP response" in the Operations search box

## Add to recipe
Double-click "Dechunk HTTP response" in the Operations list to add it to the Recipe

## Enter chunked input
Click the Input box and type these lines, pressing Enter after each one: "7", "Mozilla", "9", "Developer", "7", "Network", "0", "Expires: Wed, 21 Oct 2015 07:28:00 GMT"

## Check decoded output
Verify the Output box shows exactly "MozillaDeveloperNetwork"
