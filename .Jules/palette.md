## 2025-05-18 - Keyboard shortcut hints and disabled step state tooltips
**Learning:** Floating action buttons and step navigation buttons with keyboard shortcuts (like Enter to advance) should communicate shortcuts via `aria-keyshortcuts` and `title` tooltips rather than bloating `aria-label`. Disabled step indicators should explicitly state why they are locked in `title` attributes.
**Action:** Add `aria-keyshortcuts="Enter"` and tooltip hints for active shortcuts, and append contextual feedback on disabled wizard steps.
