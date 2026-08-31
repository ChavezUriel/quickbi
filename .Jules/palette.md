## 2026-08-24 - Focus Ring Consistency for Custom Interactive Button Lists
**Learning:** Custom interactive item buttons inside cards or custom list components (like `MovementsList`) can easily miss visual focus states if only hover styles (`hover:bg-muted`) are specified.
**Action:** Always include explicit `focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50` styles when rendering custom interactive `<button>` elements to maintain keyboard navigation clarity across theme modes.
