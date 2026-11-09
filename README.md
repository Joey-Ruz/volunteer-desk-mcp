▶️ **Demo video:** _[link coming soon](#)_

# volunteer-desk-mcp

An MCP server that gives Claude a volunteer desk for a small neighborhood food pantry: who's signed up, which shifts are short, and who hasn't heard from us in a while.

## The problem

Small civic nonprofits run on volunteers, and the coordinator is usually one overstretched person with a spreadsheet. Every week they have to answer the same questions: Which shifts are still short? Who haven't we checked in with lately? What did we last hear from this person? Then they write a dozen near-identical reminder messages by hand. This server lets Claude answer those questions directly from the pantry's records and draft personal, well-timed reminders in chat. Every message is still sent by a human, and Claude can't change a record until the coordinator approves it.

## Setup

Requires **Node.js 22.13 or newer** and **Claude Desktop**.

1. **Clone and install**
   ```sh
   git clone https://github.com/Joey-Ruz/volunteer-desk-mcp.git
   cd volunteer-desk-mcp
   npm install
   ```
2. **Build**
   ```sh
   npm run build
   ```
3. **Add the server to Claude Desktop.** Open Claude Desktop → Settings → Developer → Edit Config, and add this block to `claude_desktop_config.json`. Replace both paths with absolute paths on your machine:
   ```json
   {
     "mcpServers": {
       "volunteer-desk": {
         "command": "/absolute/path/to/node",
         "args": ["/absolute/path/to/volunteer-desk-mcp/dist/src/index.js"]
       }
     }
   }
   ```
   Get the first path from `which node` (macOS/Linux) or `where node` (Windows), and the second from `pwd` inside the repo. Claude Desktop doesn't load your terminal's environment, so `"command": "node"` may start the wrong Node or fail to find one. If you use a version manager (nvm, fnm, volta), use the path of the installed Node binary, not a temporary shell shim.
4. **Restart Claude Desktop.** The database fills itself with synthetic data on first start. The five volunteer-desk tools then appear in the tools menu.

**Resetting between takes:** `npm run reset` wipes any logged contacts and rebuilds the original data, with dates centered on today.

## Tools

| Tool | What it does | Changes data? |
|---|---|---|
| `list_upcoming_events` | Upcoming events with each shift's filled vs. needed slots | No |
| `find_unfilled_shifts` | Shifts still short on people, optionally within the next N days | No |
| `find_volunteers_not_contacted` | Volunteers with no logged contact in N days, longest silence first | No |
| `get_volunteer_history` | One volunteer's shifts, no-shows, and every contact attempt (by id or name) | No |
| `log_contact_attempt` | Records a call, text, email, or in-person check-in, **after a preview and confirmation** | Adds one row |

## Design choices

- **Synthetic data only.** All 40 volunteers, 10 events, and their history are invented. Names are made-up combinations, phone numbers use the 555-0100–0199 range set aside for fiction, and every email is at `example.org`. There is no real personal data or voter data. The seed uses a fixed random seed, so every reset produces the same people and history; only the dates move with the calendar.
- **Confirm before write.** `log_contact_attempt` works in two steps. The first call saves nothing: it returns a preview and a short-lived, single-use confirmation token. Claude shows the preview, and only after the user approves does it call again with the same details and that token. A missing, wrong, expired, or reused token, or details that differ from the preview, is rejected with a clear message. A plain `confirm: true` flag would let the model approve its own write in one step; the token means a preview has to happen first. Read tools are annotated `readOnlyHint: true`; the write tool is annotated as non-read-only.
- **No sending.** The server has no send tool and no email, SMS, or network access. Claude drafts reminder messages in the chat, and a person decides whether to send them. For a nonprofit, a wrong or duplicated message to a volunteer costs real goodwill, so this is the step that stays with a human.

## How it's built

Layers are wired together in a single composition root (`src/app.ts`). Each layer receives its dependencies through its constructor:

- `src/domain/`: plain data types, a `Result` type, and storage interfaces.
- `src/data/`: SQLite (Node's built-in `node:sqlite`, so there's nothing to compile on install), the schema, and the deterministic seed.
- `src/services/`: all logic: filtering, date math, and the preview/token/confirm flow. The clock is injected so tests can control time.
- `src/tools/`: MCP tool definitions. Each handler maps its inputs, calls one service method, and formats the `Result`. There's no logic in handlers.

Run the tests with `npm test`. On Node 22, `node:sqlite` prints a one-line "experimental" notice; it's harmless.

## License

MIT. See [LICENSE](LICENSE).
