---
test: ../offset_checker_shows_an_html_sample_deli_test.md
status: passed
started: 2026-11-24T20:55:05.879Z
duration_s: 109
session_id: 51c5a903-55ff-43c6-9185-3f596eb87992
---

# Offset checker shows an HTML sample delimiter as literal text in the Output — Result

## Find Offset checker ✓ passed (22.7s)
md5: 432fb889919d0e22e183666c838d63e3
Type "Offset checker" in the Operations search box.

## Add to recipe ✓ passed (19.4s)
md5: 573aae393195abf996a8c30026e447a0
Double-click "Offset checker" in the operations list to add it to the recipe.

## Set sample delimiter ✓ passed (16.3s)
md5: 31c2a7470a50849549ec6cf9e66bea1d
In the Offset checker recipe card, clear the Sample delimiter field and type <b>X</b>

## Enter input ✓ passed (20.3s)
md5: 0615032192437f7d6e9c3658fd095a1a
Click the Input box and type AA<b>X</b>AB

## Check output text ✓ passed (23.7s)
md5: 27c0b0472bdbe41d4a9f29f3396c0da9
Verify the Output box shows exactly "AA<b>X</b>AB" with the <b> and </b> tags visible as literal text.
