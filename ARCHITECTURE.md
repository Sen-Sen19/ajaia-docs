# Architecture note

**Shape:** Express JSON API + SQLite (built-in `node:sqlite`) + a no-build vanilla JS single-page frontend with Tiptap.

**Why this stack:** one process, one file database, no build step. Reviewers can run it in two commands and deploy it free anywhere that runs Node.

**Data model:** `users`, `documents` (HTML content), `shares (doc_id, user_id, role)`. Content is stored as sanitized HTML, which is simple, human-readable and renders without the editor.

**Auth:** email + password registration/login. Passwords are hashed with scrypt (`node:crypto`, salted). Sessions are random tokens in an httpOnly, SameSite=Lax cookie; only a SHA-256 hash of each token is stored, with a 7-day expiry.

**Access control:** one `load` middleware resolves the caller's role (`owner | edit | view`) per document; `canEdit` and `ownerOnly` guards sit on top. Every route reuses it, so permissions live in one place and are tested directly.

**Safety:** server-side sanitization (allow-list of tags, no attributes), title validation, upload type/size limits, centralized error handler with user-readable messages.

**Prioritized:** correct sharing logic, a usable editor, reliable autosave with visible state, import flow.
**Deprioritized:** real-time collaboration, comments, version history, rich `.docx` fidelity.
**Next with 2-4 more hours:** login rate limiting, version history, PDF export, presence indicators, frontend tests.