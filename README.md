# Calendar Sync

Calendar Sync is a Claude plugin. Once it's set up, Claude sends that day's meetings from your work calendar to the team's time-tracking system every weekday, so you don't have to log them by hand. It sends each event's title, start and end times, attendee count, whether it's all-day, whether it was cancelled, and when it was last changed. It doesn't send descriptions, attendee names or locations, and it skips meetings you declined.

## For colleagues

You need a paid Claude plan and the Claude desktop app.

1. **Add the marketplace.** In Claude, click **Customize** in the left sidebar, open **Plugins**, click **Add**, choose **Add marketplace**, then **Add from a repository**, and paste `REPLACE-ME-OWNER/REPLACE-ME-REPO`.
2. **Install the plugin.** On the same **Plugins** page, open **Discover**, select **Calendar Sync**, and click **Add**.
3. **Connect your calendar.** Click **Customize**, open **Connectors**, find **Google Calendar** (or **Outlook** if your work calendar is in Microsoft), click **Connect**, and sign in.
4. **Sign in to Calendar Sync.** Click **Customize**, open **Plugins**, select **Calendar Sync**, and open its **Connectors** tab. Next to **calendar-sync-api**, click **Add** if you see it, then **Connect**, and sign in if asked. If you can't add it, ask your workspace admin.
5. **Start setup.** Start a new chat, type `/setup-calendar-sync` (or just say "set up calendar sync"), and answer Claude's questions.

To change the time later, type `/setup-calendar-sync` again. To stop syncing, click **Scheduled** in the left sidebar, open **Daily calendar sync**, and pause or delete it.

## For maintainers

### Repository layout

```text
.
├── .claude-plugin/marketplace.json          # the marketplace (repo root = marketplace root)
├── plugins/calendar-sync/
│   ├── .claude-plugin/plugin.json           # plugin manifest (version lives here)
│   ├── .mcp.json                            # remote connector: calendar-sync-api
│   └── skills/setup-calendar-sync/SKILL.md  # setup flow + fixed scheduled-task prompt
├── mcp-server/                              # stub remote MCP server (Node + TypeScript)
└── README.md
```

Only `plugins/calendar-sync/` is installed for users. `mcp-server/` is in the same repository for convenience and never reaches their machines.

### Run the stub server locally

Requires Node 20 or later.

```bash
cd mcp-server
npm install
npm run dev            # watch mode on http://localhost:3000/mcp
# or
npm run build && npm start
```

Smoke test:

```bash
curl -s localhost:3000/healthz
curl -s localhost:3000/mcp \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"submit_events","arguments":{"events":[]}}}'
```

Docker:

```bash
cd mcp-server
docker build -t calendar-sync-mcp .
docker run --rm -p 3000:3000 calendar-sync-mcp
```

The server is stateless Streamable HTTP (`POST /mcp`). Each call to `submit_events` is logged as one JSON line. Deduplication is in memory, keyed on user + `event_id` + `updated_at`, so it resets on restart. See the `TODO(postgres)` comment in `src/store.ts`.

**Auth is not implemented.** Every request is treated as the same anonymous user. Don't point real colleagues at this server until per-user OAuth is in place; see the `TODO(auth)` comment in `src/index.ts`. Don't add a shared API key to `.mcp.json`: every person who installs the plugin receives that file.

### Expose it publicly for testing

Claude connects to connectors from Anthropic's cloud, not from your computer, so `localhost` won't work. You need a public HTTPS URL. For a quick test, use a tunnel:

```bash
# Cloudflare quick tunnel (no account needed)
cloudflared tunnel --url http://localhost:3000
# or ngrok
ngrok http 3000
```

Copy the `https://…` address the tunnel prints. Quick-tunnel addresses change every time you restart the tunnel, so for anything longer than a test, deploy the Docker image to a host with a stable domain (Fly.io, Render, Cloud Run, etc.).

### Update the URL in `.mcp.json`

Edit `plugins/calendar-sync/.mcp.json` and replace the placeholder, keeping the `/mcp` path:

```json
{
  "mcpServers": {
    "calendar-sync-api": {
      "type": "http",
      "url": "https://your-host.example.com/mcp"
    }
  }
}
```

Keep the server name `calendar-sync-api`, because the skill refers to it. Then bump the version (next section) and push.

### Validate, bump versions, and push updates

Run this before every push (it needs Claude Code installed):

```bash
claude plugin validate .                         # marketplace + every plugin in it
claude plugin validate ./plugins/calendar-sync   # just the plugin
```

The version is set in `plugins/calendar-sync/.claude-plugin/plugin.json` and pins what users get. **Users don't receive changes until you raise it.** For every change to the plugin:

1. Raise `version` in `plugin.json` (for example `0.1.0` → `0.1.1` for fixes, `0.2.0` for new behavior). Don't also set `version` in `marketplace.json`, because `plugin.json` wins and the validator warns about the mismatch.
2. Commit and push to the default branch.
3. Users get the update on their account automatically once it syncs. To get it right away, they can click **Check for updates** on the marketplace under **Customize > Plugins**.

Changing the task prompt template at the bottom of `SKILL.md` doesn't change tasks people have already created. Ask them to run `/setup-calendar-sync` again, and the skill will update their existing task.

### Test locally in Claude Code before pushing

```bash
claude plugin marketplace add .
claude plugin install calendar-sync@calendar-sync-marketplace
claude plugin details calendar-sync
```

Use `claude plugin marketplace remove calendar-sync-marketplace` to clean up afterwards.
