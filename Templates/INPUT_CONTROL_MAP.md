# Input / Control Map

The single source of truth for how the game is controlled. Update this before or with any input change; the playtest checklist verifies against it.

## Primary Controls

| Action | Keyboard | Mouse / Touch | Gamepad (if supported) |
|---|---|---|---|
| Select cell | Arrow keys | Tap or click a cell | Not supported |
| Enter digit | `1`–`9` | Tap number pad | Not supported |
| Toggle notes | `N` | Tap Notes | Not supported |
| Erase | `Backspace` or `Delete` | Tap Erase | Not supported |
| Undo | `Ctrl/Cmd+Z` | Tap Undo | Not supported |
| Hint | `H` | Tap Hint | Not supported |
| New puzzle | — | Tap New, then choose setup | Not supported |

## Rules

- Keyboard-first by default; every core action must be reachable without a mouse unless the genre demands otherwise.
- Do not bind core actions to keys that conflict with browser shortcuts (avoid `Ctrl`-combinations for core play).
- Held vs tapped behavior must be deliberate and documented here when it differs.
- Remapping, if offered, is a later-milestone feature; a stable default map comes first.

## Notes

- Input model (polled / event-driven / hybrid): `Event-driven DOM controls and keydown mapping.`
- Dead zones, buffering, or coyote-time decisions: `Not applicable; one discrete action is processed per keydown or activation.`
- Notes apply to empty editable cells. Digit input in note mode leaves filled cells unchanged.
- Undo and Hint leave completed or failed trials unchanged; Replay starts a fresh attempt.
- Open dialogs leave game shortcuts alone and pause active play time. The saved puzzle and input selection resume automatically after refresh.
