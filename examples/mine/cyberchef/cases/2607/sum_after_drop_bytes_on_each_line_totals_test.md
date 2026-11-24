---
mode: testing
url: http://127.0.0.1:1/
max_steps: 25
---

# Sum after Drop bytes on each line totals a list of numbers

## Add Drop bytes
Type "Drop bytes" in the Operations search box and double-click "Drop bytes" in the list to add it to the recipe

## Set Drop bytes args
In the Drop bytes recipe card, set Start to 0, set Length to 23, and tick the "Apply to each line" checkbox

## Add Sum
Type "Sum" in the Operations search box, double-click "Sum" in the list to add it below Drop bytes, and make sure its Delimiter dropdown is set to "Line feed"

## Enter number list
Click the Input box and type these 18 lines, one per line, with a single space between the timestamp and the number:
2026-06-15 13:00:00+00 92
2026-06-15 14:00:00+00 21392
2026-06-15 15:00:00+00 20437
2026-06-15 16:00:00+00 20221
2026-06-15 17:00:00+00 10857
2026-06-15 18:00:00+00 12474
2026-06-15 19:00:00+00 16607
2026-06-15 20:00:00+00 19655
2026-06-15 21:00:00+00 18221
2026-06-15 22:00:00+00 20587
2026-06-15 23:00:00+00 14631
2026-06-16 00:00:00+00 17175
2026-06-16 01:00:00+00 20496
2026-06-16 02:00:00+00 16385
2026-06-16 03:00:00+00 16188
2026-06-16 04:00:00+00 14440
2026-06-16 05:00:00+00 12327
2026-06-16 06:00:00+00 5393

## Check summed output
Verify the Output box shows exactly "277578"
