## 2025-05-18 - Keyboard shortcut indicators on action dock buttons
**Learning:** Adding a subtle `<kbd>` indicator and helpful title/aria attributes on action buttons clarifies available global keyboard navigation (like `Enter`) without cluttering the UI or overriding visible label accessibility.
**Action:** Always verify global keydown listeners exist before advertising hotkeys with `<kbd>` badges and ensure aria attributes supplement rather than contradict visible button text.
