---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# Loading a saved recipe keeps the Translate DateTime Format input format string

## Open load dialog
Click the "Load recipe" (folder) icon at the top of the Recipe area

## Type saved recipe
Click the recipe text box in the Load recipe dialog and type: Fork('\\n','\\n',false) Translate_DateTime_Format('Standard date and time','HH:mm:ss a MMM DD, YYYY','UTC','DD/MM/YYYY HH:mm:ss','UTC')

## Load the recipe
Click the "Load" button in the dialog

## Check input format
Verify the "Input format string" field of the Translate DateTime Format recipe card shows "HH:mm:ss a MMM DD, YYYY"
