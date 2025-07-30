# MCP Storage Server

A Model Context Protocol (MCP) server that provides **persistent, searchable storage** with SQLite and full-text search for Claude Code.

## Quick Setup

### Method 1: NPM (Recommended)

```bash
# Install
npm install -g mcp-storage-server

# Add to Claude Code (CRITICAL: use --scope user)
claude mcp add --scope user mcp-storage node $(npm root -g)/mcp-storage-server/dist/index.js

# Verify
claude mcp list
# Should show: mcp-storage: ... - ✓ Connected
```

### Method 2: From Source

```bash
# Clone and build
git clone https://github.com/damiansirbu-org/mcp-storage-server.git
cd mcp-storage-server
npm install && npm run build

# Add to Claude Code (CRITICAL: use --scope user)
claude mcp add --scope user mcp-storage node "$(pwd)/dist/index.js"

# Verify
claude mcp list
```

## CRITICAL: Configuration Scope

**⚠️ IMPORTANT**: Always use `--scope user` when adding the MCP server.

The manage.sh `integrate` command is **broken** - it adds the server to the wrong location in the config file. Claude Code looks for MCP servers in the user-scoped `mcpServers` section, not the global `mcp.servers` section.

**Wrong** (manage.sh does this):
```json
{
  "mcp": {
    "servers": {
      "mcp-storage": { ... }  // Claude Code ignores this
    }
  }
}
```

**Correct** (claude mcp add --scope user does this):
```json
{
  "mcpServers": {
    "mcp-storage": { ... }  // Claude Code finds this
  }
}
```

## Tools Available

- `store_item` - Save content with tags
- `search_items` - Full-text search  
- `retrieve_item` - Get by ID
- `list_items` - Browse all items
- `delete_item` - Remove items
- `get_tags` - View all tags

## Usage

```javascript
// Store knowledge
store_item({
  id: "react-auth-2025",
  title: "React Auth Implementation", 
  content: "Built JWT auth with refresh tokens...",
  tags: ["react", "auth", "jwt"]
})

// Search later
search_items({query: "react auth jwt"})
```

## Database

- **Location**: `~/.mcp-storage/storage.db`
- **Type**: SQLite with FTS5 full-text search
- **Backup**: Just copy the .db file

## Troubleshooting

1. **"No MCP servers configured"** → Use `--scope user` flag
2. **"Failed to connect"** → Use full `node /path/to/index.js` command
3. **Connection lost** → Restart Claude Code after adding server

## Why This Exists

Anthropic's built-in memory system is unreliable:
- Frequent connection failures  
- No persistence between sessions
- No search capability
- Data loss issues

This MCP server provides reliable local storage with instant search.

## License

MIT - Use freely.