# AI workflow note

**Tools used:** Claude (chat) for UI and CSS work, and for a code and docs review of the finished project.

**Where AI sped me up**
- Fixed the dashboard table so the header and rows line up. One shared `--cols` grid list replaced per-row `auto` columns.
- Made the table use the full page width, then rebalanced the columns with `fr` ratios so "Name" does not eat all the space.
- Restyled the editor top bar to match the dark sidebar and login page.
- Reviewed `app.js` and the project files. This found stale docs, a leftover copy of the server code in `public/`, and an optional stale-save check.

**What I changed or rejected**
- The first "dark top bar" fix did not work. The old white `.etop` rule sat later in the file and won. A second suggestion put the fix in the wrong block. I ended with one dark block at the end of the file that uses `header.etop`, so it wins whatever the order.
- The AI first said there was no sign-up. It had only seen an older `app.js`. The real project has `/api/auth/register`, so I ignored that note.
- I kept the editor page at 816px wide on purpose, because long lines are hard to read. Only the dashboard goes full width.
- The editor text area stays white. Only the top bar is dark.

**How I verified**
- `npm test` passes: 5 tests for permissions, sanitizing, import, stale saves, export and sign-in. The AI ran them on Node 22.
- The AI never saw the app in a browser, so the CSS changes were checked by me by looking at the page.
- [Add what you personally checked: two-user sharing, mobile width, keyboard use.]