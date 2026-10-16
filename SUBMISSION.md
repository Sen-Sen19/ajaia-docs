# Submission: Ajaia Docs

**Live URL:** [add after deploy]
**Walkthrough video:** see `VIDEO_URL.txt`
**Time spent:** [add your real time]

## Try it in 60 seconds

| Account | Email | Password |
|---|---|---|
| Alice | alice@ajaia.test | demo1234 |
| Bob | bob@ajaia.test | demo1234 |
| Carol | carol@ajaia.test | demo1234 |

You can also create your own account on the sign-in screen.

1. Sign in as Alice and click **New document**. Type something and use the formatting toolbar.
2. Click **Share**, enter `bob@ajaia.test`, choose **Can view**, and share.
3. Sign out, sign in as Bob, and open the document under **Shared with me**. Bob can read it but cannot edit it.

Note: the free host resets its data after about 15 minutes idle or on redeploy. The demo accounts always come back. The first load after idle can take about a minute.

## What is included
- `src/`, `server.js`, `public/`, `test/`: source code
- `README.md`: setup, run, test and deploy steps
- `ARCHITECTURE.md`: what I prioritized and why
- `AI_WORKFLOW.md`: how I used AI
- `VIDEO_URL.txt`: walkthrough video link

## What works
- Create, rename, edit, autosave, reopen and delete documents
- Bold, italic, underline, H1/H2, bulleted and numbered lists
- Import of .txt, .md and .docx files (2 MB max) into a new document
- Sharing by email with view or edit access; the owner can change or remove it
- Owned and shared documents are shown separately, with role badges
- Sign-up, sign-in and sign-out
- Markdown export
- Stale-save protection: if someone else changed the document, you get a Reload banner instead of overwriting their work
- Data saved in SQLite
- 5 automated tests (permissions, sanitizing, import, stale saves and export, sign-in)

## Cut on purpose
- **Live editing.** I used a stale-save banner instead. Polling or a WebSocket merge adds risk for this timebox.
- **Admin role.** Each document has an owner, and the owner controls sharing. Admin tools were not needed for this scope.
- **Version history.**
- **Login rate limiting, password reset and email checks.**
- **Rich .docx formatting.** Import keeps basic formatting only.

## Known limits
- Free-tier hosting is temporary storage, so documents and new accounts can reset.
- The editor loads Tiptap from esm.sh, so it needs internet.
- No frontend tests.

## Next, with 2-4 more hours
- Keep data across restarts (a paid disk or an outside database)
- Login rate limiting
- Version history
- Frontend tests