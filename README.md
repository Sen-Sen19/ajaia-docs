# Ajaia Docs

A lightweight collaborative document editor: rich-text editing, file import, per-user sharing, SQLite persistence.

## Run locally
Requires Node 22.13+ (uses the built-in `node:sqlite`, so there is no native module to compile).
```bash
npm install
npm start        # http://localhost:3000
npm test         # access-control, sanitization and import tests
```
The database (`data.db`) is created and seeded on first start.

## Accounts
Create your own account on the sign-in screen (email + password, 8+ characters), or use the seeded demo accounts, all with password `demo1234`:
`alice@ajaia.test`, `bob@ajaia.test`, `carol@ajaia.test`.

**Sharing demo:** sign in as Alice, create a document, click Share, enter `bob@ajaia.test` (view or edit). Sign out, sign in as Bob, and open it under "Shared with me".

## Features
- Create, rename, edit, autosave (700 ms debounce) and reopen documents
- Bold, italic, underline, H1/H2, bulleted and numbered lists (Tiptap)
- Import `.txt`, `.md`, `.docx` (2 MB max) into a new editable document
- Share by email with view or edit access; owner can change or remove access
- Delete and rename documents from the dashboard, search by title
- Export any document to Markdown
- Stale-save protection: if someone else changed the document, you get a Reload banner instead of overwriting their work
- Add your logo at `public/logo.png` (falls back to a text wordmark)
- Dashboard separates "Your documents" from "Shared with you", with role badges

## Deploy (Render, free tier)
New Web Service from the repo, build `npm install`, start `npm start`. Free-tier disks are ephemeral, so data resets on redeploy; attach a disk and set `DB_PATH` for durable storage.

## Known limits
No password reset or email verification, no rate limiting on login, no real-time collaboration, `.docx` import keeps basic formatting only, editor loads Tiptap from esm.sh (needs internet).
