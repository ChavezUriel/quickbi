## 2025-05-18 - Avoid aria-hidden on containers with sr-only children
**Learning:** Placing `aria-hidden` or `aria-hidden="true"` on a container element suppresses all descendant nodes in the accessibility tree, including visually hidden screen reader text (`.sr-only`).
**Action:** Remove `aria-hidden` from the parent wrapper and apply `aria-hidden="true"` specifically to the decorative or visual child nodes, keeping screen reader text nodes exposed.
