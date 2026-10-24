# Clear Sudoku regions and a standard 9×9 opening

- Goal: issue #9, distinguish boxes on 6×6 and 9×9, with 9×9 as the default.
- Changed: first fresh session opens classic 9×9 Quick Play. Saved sessions and
  campaign progression stay intact; Pocket 6×6 remains in Quick create and the
  introductory campaign. The existing 9×9 generator needed no replacement.
- Region rules now use 3px inset lines in the theme's ink colour, while ordinary
  cell gaps use the lighter rule colour. Adjacent/selected cells cannot paint
  over the rules, including cells at the intersection of two region lines.
- Verification: 94 tests pass, including 4 independent-solver classic seeds;
  typecheck/build pass. Browser checks cover both sizes at 1280px and 320px in
  parchment and midnight, border counts, computed rules and no overflow.
- Before screenshots use the original HEAD stylesheet with the same boards and
  new-session flow, so the comparison isolates border rendering. After shots
  are the final implementation. Physical-device feel still needs Alexei.
- Re-sync: use the hub sync tool after source review; no hub bundle changed.
  Current source package is 0.1.0; build size/file count is in the PR.
