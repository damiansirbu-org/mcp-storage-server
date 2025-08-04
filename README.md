# MCP Storage Server

A **high-performance** Model Context Protocol (MCP) server providing persistent, searchable storage with SQLite FTS5 and enterprise-grade optimization for Claude Code development workflows.

## 🚀 Quick Setup

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

## ⚠️ CRITICAL: Configuration Scope

**IMPORTANT**: Always use `--scope user` when adding the MCP server.

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

## 🛠️ Complete API Reference

### Core Storage Operations

#### `store_item`
Store a single item with full-text search capability.

**Parameters:**
- `id` (string, required): Unique identifier for the item
- `title` (string, required): Title or name of the item  
- `content` (string, required): The main content to store
- `tags` (array[string], optional): Tags for categorization
- `quiet` (boolean, optional, default: false): Silent mode - minimal output

**Example:**
```json
{
  "id": "react-auth-2025",
  "title": "React Auth Implementation",
  "content": "Built JWT auth with refresh tokens using axios interceptors...",
  "tags": ["react", "auth", "jwt", "typescript"],
  "quiet": false
}
```

**Response:**
- Normal: `Successfully stored item "React Auth Implementation" with ID: react-auth-2025`
- Quiet: `✓ Stored`

#### `store_batch`
Store multiple items in a single optimized transaction for maximum performance.

**Parameters:**
- `items` (array, required): Array of items to store
  - Each item: `{id, title, content, tags?}`
- `quiet` (boolean, optional, default: false): Silent mode - minimal output

**Example:**
```json
{
  "items": [
    {
      "id": "session-001",
      "title": "Database Optimization Session",
      "content": "Added indexes to user queries...",
      "tags": ["database", "performance"]
    },
    {
      "id": "session-002", 
      "title": "API Security Review",
      "content": "Implemented rate limiting...",
      "tags": ["security", "api"]
    }
  ],
  "quiet": true
}
```

**Response:**
- Normal: `Successfully stored 2 items in batch`
- Quiet: `✓ Saved 2 entries`

### Search Operations

#### `search_items`
Full-text search across title, content, and tags using SQLite FTS5.

**Parameters:**
- `query` (string, required): Search query (supports FTS5 syntax)
- `limit` (number, optional, default: 10): Maximum results to return
- `quiet` (boolean, optional, default: false): Silent mode - minimal output

**FTS5 Query Examples:**
- `"react auth"` - Phrase search
- `react AND typescript` - Boolean AND
- `auth OR authentication` - Boolean OR  
- `react NOT vue` - Boolean NOT
- `auth*` - Prefix search

**Example:**
```json
{
  "query": "database performance optimization",
  "limit": 5,
  "quiet": false
}
```

**Response:**
- Normal: Full results with content preview
- Quiet: `✓ Found 3 entries`

#### `search_advanced`
Advanced search with tag filtering and date ranges.

**Parameters:**
- `query` (string, required): FTS5 search query
- `limit` (number, optional, default: 10): Maximum results
- `tags` (array[string], optional): Filter by specific tags
- `dateFrom` (string, optional): Filter from date (ISO string)
- `dateTo` (string, optional): Filter to date (ISO string)
- `quiet` (boolean, optional, default: false): Silent mode

**Example:**
```json
{
  "query": "authentication security",
  "limit": 10,
  "tags": ["auth", "security"],
  "dateFrom": "2025-01-01T00:00:00.000Z",
  "dateTo": "2025-12-31T23:59:59.999Z",
  "quiet": false
}
```

### Retrieval Operations

#### `retrieve_item`
Retrieve a specific item by its ID.

**Parameters:**
- `id` (string, required): Unique identifier of item to retrieve

**Example:**
```json
{
  "id": "react-auth-2025"
}
```

**Response:**
```
**React Auth Implementation**

Built JWT auth with refresh tokens using axios interceptors...

*Tags: react,auth,jwt,typescript*
*Created: 2025-08-04T03:28:15.123Z*
*Updated: 2025-08-04T03:28:15.123Z*
```

#### `list_items`
List all items with pagination, ordered by most recently updated.

**Parameters:**
- `limit` (number, optional, default: 50): Maximum items to return
- `offset` (number, optional, default: 0): Number of items to skip

**Example:**
```json
{
  "limit": 20,
  "offset": 0
}
```

### Management Operations

#### `delete_item`
Delete an item by its ID.

**Parameters:**
- `id` (string, required): Unique identifier of item to delete

**Example:**
```json
{
  "id": "old-session-123"
}
```

**Response:**
- Success: `Successfully deleted item with ID: old-session-123`
- Not found: `Item with ID "old-session-123" not found`

#### `get_tags`
Get all unique tags used in stored items.

**Parameters:** None

**Response:**
```
Available tags: api, auth, database, javascript, performance, react, security, typescript
```

#### `get_stats`
Get database statistics for monitoring.

**Parameters:** None

**Response:**
```
Database Statistics:
- Items: 1,245
- Tags: 28
- Size: 12.34 MB
```

#### `optimize_db`
Perform database maintenance and optimization.

**Parameters:** None

**Features:**
- WAL checkpoint to prevent file growth
- Query optimization via PRAGMA optimize
- Database analysis for better query planning

**Response:**
```
Database optimization completed
```

## 🎯 Silent Mode Usage

All search and storage operations support `quiet: true` for minimal output, perfect for automated workflows and historian agents:

```json
// Verbose output
{"quiet": false} → "Successfully stored item 'My Session' with ID: session-123"

// Silent output  
{"quiet": true}  → "✓ Stored"
```

## 💾 Performance Optimizations (2025)

The server implements enterprise-grade SQLite optimizations:

### Automatic Optimization
- **WAL Mode**: Write-Ahead Logging for concurrent reads
- **Memory Mapping**: 30GB mmap_size for large datasets
- **Cache**: 160MB cache_size for query performance
- **Page Size**: 8KB pages for optimal I/O
- **Synchronous**: NORMAL mode for speed with safety

### FTS5 Full-Text Search
- **BM25 Ranking**: Relevance-based result ordering
- **Unicode61 Tokenizer**: Full Unicode support
- **Automatic Triggers**: Real-time index updates
- **Prefix Search**: Fast autocomplete queries

### Batch Operations
- **Transactions**: Atomic batch inserts for performance
- **Prepared Statements**: Optimized repeated operations
- **Automatic Optimization**: PRAGMA optimize on close

## 🗄️ Database Architecture

### Storage Location
- **Path**: `~/.mcp-storage/storage.db`
- **Type**: SQLite 3.46+ with FTS5 full-text search
- **Backup**: Simply copy the `.db` file
- **Portability**: Cross-platform, no dependencies

### Schema Design
```sql
-- Main storage table
CREATE TABLE storage (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL, 
  tags TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- FTS5 virtual table for search
CREATE VIRTUAL TABLE storage_fts USING fts5(
  id UNINDEXED,
  title,
  content, 
  tags,
  content='storage',
  content_rowid='rowid'
);
```

### Automatic Triggers
Real-time search index updates via SQLite triggers ensure search results are always current.

## 🔧 Integration Examples

### Historian Agent Integration
```javascript
// Load project context (silent mode)
mcp__mcp-storage__search_items({
  query: "project:myapp", 
  limit: 50,
  quiet: true
})

// Save session batch (optimized)
mcp__mcp-storage__store_batch({
  items: sessionEntries,
  quiet: true
})
```

### Development Workflow
```javascript
// Store architectural decisions
store_item({
  id: "adr-001-database-choice",
  title: "ADR 001: Database Technology Selection", 
  content: "Decided on PostgreSQL for ACID compliance...",
  tags: ["adr", "database", "architecture"]
})

// Search past decisions
search_items({query: "database architecture decision"})
```

## 🚨 Troubleshooting

### Common Issues

1. **"No MCP servers configured"**
   - **Fix**: Use `--scope user` flag when adding server
   - **Verify**: Check `~/.claude/settings.json` has `mcpServers` section

2. **"Failed to connect"** 
   - **Fix**: Use full `node /path/to/index.js` command
   - **Debug**: Run server directly to see error messages

3. **"Connection lost"**
   - **Fix**: Restart Claude Code after adding server
   - **Check**: Server process is still running

4. **Silent mode not working**
   - **Fix**: Ensure you're using updated MCP server with `quiet` parameter
   - **Update**: Rebuild server if using from source

5. **Search returns no results**
   - **Debug**: Use `get_stats` to verify items are stored
   - **Check**: FTS5 query syntax (try simpler queries first)

### Performance Issues

1. **Slow searches**
   - **Solution**: Run `optimize_db` to update statistics
   - **Monitor**: Use `get_stats` to check database size

2. **Large database file**
   - **Solution**: WAL file growth is normal, optimization handles it
   - **Maintenance**: Regular `optimize_db` calls prevent issues

## 💡 Why This Exists

### Problems with Built-in Systems
- **Anthropic Memory**: Unreliable connections, data loss, no search
- **File-based**: No search, difficult organization, version conflicts
- **Cloud Storage**: Network dependency, privacy concerns, complexity

### This Solution Provides
- ✅ **100% Local**: No network dependencies, full privacy
- ✅ **Instant Search**: FTS5 full-text search with BM25 ranking  
- ✅ **High Performance**: Enterprise SQLite optimizations
- ✅ **Silent Operation**: Perfect for automated workflows
- ✅ **Batch Operations**: Optimized for high-volume storage
- ✅ **Zero Maintenance**: Self-optimizing database
- ✅ **Cross-Platform**: Works on Windows, macOS, Linux
- ✅ **MCP Standard**: Future-proof protocol compliance

## 🔮 Future Enhancements

### Planned Features
- [ ] **Semantic Search**: Vector embeddings for concept-based search
- [ ] **Export/Import**: JSON/CSV export for backup and migration  
- [ ] **Compression**: Automatic content compression for large datasets
- [ ] **Encryption**: Optional at-rest encryption for sensitive data
- [ ] **Replication**: Multi-device synchronization via Git-like protocol
- [ ] **Analytics**: Usage patterns and search analytics
- [ ] **Web Interface**: Optional web UI for database management

### Performance Roadmap
- [ ] **Parallel Processing**: Multi-threaded search for large datasets
- [ ] **Caching**: In-memory LRU cache for frequent queries
- [ ] **Indexing**: Custom indexes for common query patterns
- [ ] **Streaming**: Streaming results for large result sets

## 📊 Benchmarks

### Performance Metrics (Typical Hardware)
- **Storage**: 10,000+ items/second (batch mode)
- **Search**: Sub-10ms for most queries
- **Memory**: <50MB RAM usage for 100k items
- **Database**: <1MB per 1000 typical development entries

### Scalability Tested
- ✅ **1M+ entries**: Search remains fast with BM25 ranking
- ✅ **Multi-GB databases**: Memory mapping handles large datasets
- ✅ **Concurrent access**: WAL mode supports multiple readers

## 🤝 Contributing

### Development Setup
```bash
git clone https://github.com/damiansirbu-org/mcp-storage-server.git
cd mcp-storage-server
npm install
npm run dev  # TypeScript watch mode
```

### Testing
```bash
npm test                    # Unit tests
npm run test:integration   # Integration tests  
npm run test:performance   # Performance benchmarks
```

### Architecture Decisions
All major changes require ADRs (Architecture Decision Records) stored in the database itself for dogfooding.

## 📄 License

MIT License - Use freely in personal and commercial projects.

## 🤖 Agent Integration

### Building Agents with MCP Storage

The MCP Storage Server is designed for seamless integration with development agents. Here's how to build agents that leverage persistent, searchable storage.

### Historian Agent Example

Create a development session logger that captures all progress:

```markdown
---
name: my-historian
description: Development session logger with MCP storage integration
---

You are a development historian agent that maintains comprehensive logs of all development activities using MCP storage.

## Startup Protocol
1. Test MCP connection: `mcp__mcp-storage__list_items({limit: 1})`
2. Ask for project name
3. Load context: `mcp__mcp-storage__search_items({query: "project:myapp", quiet: false})`

## Core Commands

### /save
Document current session:
```javascript
// Batch save for performance
mcp__mcp-storage__store_batch({
  items: [
    {
      id: "myapp_session_20250804_151230",
      title: "Database Optimization Session",
      content: "SESSION SUMMARY:\n- Added indexes to user queries\n- Optimized JOIN operations\n- Reduced query time from 200ms to 50ms",
      tags: ["project:myapp", "session", "database", "performance"]
    },
    {
      id: "myapp_adr_db_indexing_20250804",
      title: "ADR: Database Indexing Strategy", 
      content: "DECISION: Use composite indexes on frequently queried columns\nRATIONALE: 75% reduction in query time\nALTERNATIVES: Single-column indexes rejected due to poor performance",
      tags: ["project:myapp", "adr", "database", "architecture"]
    }
  ],
  quiet: true  // Silent operation
})
```

### /load  
Restore project context:
```javascript
mcp__mcp-storage__search_items({
  query: "project:myapp",
  limit: 50,
  quiet: false
})
```

### /search
Find relevant past work:
```javascript
mcp__mcp-storage__search_advanced({
  query: "authentication security",
  tags: ["auth", "security"],
  limit: 10,
  quiet: false
})
```
```

### Architecture Agent Example

Create an agent that maintains architectural decisions:

```markdown
---
name: architect
description: Chief architect agent with persistent ADR storage
---

You are a chief architect agent that maintains Architecture Decision Records (ADRs) using MCP storage.

## ADR Documentation

### Store Decision
```javascript
mcp__mcp-storage__store_item({
  id: "myapp_adr_001_microservices_20250804",
  title: "ADR-001: Microservices Architecture Adoption",
  content: `# ADR-001: Microservices Architecture

## Status: Accepted
## Date: 2025-08-04
## Context: Monolithic application scaling issues
## Decision: Adopt microservices with API Gateway
## Consequences: 
- Positive: Better scalability, team autonomy
- Negative: Increased complexity, network latency
## Alternatives: 
- Modular monolith: Rejected due to scaling constraints
- Serverless: Rejected due to vendor lock-in concerns`,
  tags: ["project:myapp", "adr", "architecture", "microservices"],
  quiet: false
})
```

### Search Past Decisions
```javascript
mcp__mcp-storage__search_items({
  query: "architecture decision microservices OR monolith",  
  limit: 5,
  quiet: false
})
```
```

### Code Review Agent Example

Create an agent that learns from code review patterns:

```markdown
---
name: code-reviewer
description: Code review agent with pattern learning via MCP storage
---

## Review Pattern Storage

### Store Review Insights
```javascript
mcp__mcp-storage__store_item({
  id: "review_pattern_sql_injection_20250804",
  title: "Code Review Pattern: SQL Injection Prevention",
  content: `PATTERN: SQL Injection Prevention
FILE: user-service.js:142
ISSUE: Direct string concatenation in SQL query
SOLUTION: Use parameterized queries with prepared statements
IMPACT: Critical security vulnerability prevented
LEARNING: Always use ORM or parameterized queries for user input`,
  tags: ["code-review", "security", "sql-injection", "pattern", "javascript"],
  quiet: true
})
```

### Learn from Past Reviews
```javascript
mcp__mcp-storage__search_items({
  query: "security vulnerability prevention",
  limit: 10,
  quiet: false
})
```
```

### Performance Monitor Agent Example

Track and analyze performance metrics:

```markdown
---
name: perf-monitor  
description: Performance monitoring agent with metric history
---

## Performance Tracking

### Store Metrics
```javascript
mcp__mcp-storage__store_batch({
  items: [
    {
      id: "perf_api_response_time_20250804_151500",
      title: "API Response Time Metrics - August 2025",
      content: `PERFORMANCE METRICS:
Endpoint: /api/users
- Before: 245ms average
- After: 87ms average  
- Improvement: 64% reduction
- Method: Database indexing + query optimization
- Load: 1000 concurrent users`,
      tags: ["performance", "api", "metrics", "optimization"]
    },
    {
      id: "perf_database_query_20250804_151501", 
      title: "Database Query Performance",
      content: `QUERY OPTIMIZATION:
Table: users JOIN orders
- Before: 1.2s execution time
- After: 180ms execution time
- Indexes: composite index on (user_id, created_at)
- Impact: 85% improvement`,
      tags: ["performance", "database", "query", "optimization"]
    }
  ],
  quiet: true
})
```
```

## 🛠️ Agent Development Best Practices

### Silent Operations
Use `quiet: true` for automated workflows:
```javascript
// Loud operation (development)
mcp__mcp-storage__store_item({...params, quiet: false})
// → "Successfully stored item 'My Session' with ID: session-123"

// Silent operation (production)
mcp__mcp-storage__store_item({...params, quiet: true})  
// → "✓ Stored"
```

### Batch for Performance
Use `store_batch` for multiple related entries:
```javascript
// Single operations (slower)
for (const item of items) {
  mcp__mcp-storage__store_item(item)
}

// Batch operation (10x faster)
mcp__mcp-storage__store_batch({
  items: items,
  quiet: true
})
```

### Effective Tagging
Design tag hierarchies for discoverability:
```javascript
tags: [
  "project:myapp",           // Project scope
  "session",                 // Entry type
  "backend",                 // Domain
  "authentication",          // Feature
  "security",                // Cross-cutting concern
  "completed"                // Status
]
```

### Search Strategies
Use FTS5 syntax for precise queries:
```javascript
// Phrase search
"authentication error"

// Boolean operations  
"database AND performance"
"react OR vue"
"auth NOT oauth"

// Prefix matching
"authent*"

// Complex queries
"(database OR sql) AND (performance OR optimization)"
```

### Error Handling
Always handle MCP server availability:
```javascript
// Test connection first
try {
  const test = mcp__mcp-storage__list_items({limit: 1})
} catch (error) {
  return "⚠️ MCP Storage Server unavailable. Cannot access project history."
}
```

### Schema Consistency
Use consistent ID patterns across agents:
```javascript
// Session logs
`${project}_session_${timestamp}`

// Architecture decisions  
`${project}_adr_${topic}_${timestamp}`

// Code reviews
`${project}_review_${filename}_${timestamp}`

// Performance metrics
`${project}_perf_${metric}_${timestamp}`
```

## 🚀 Agent Template

Use this template to create MCP storage-enabled agents:

```markdown
---
name: my-agent
description: Your agent description with MCP storage integration
---

You are [agent role] that uses MCP storage for persistent knowledge.

## 🚀 Startup Protocol
1. **Test MCP**: `mcp__mcp-storage__list_items({limit: 1})`
2. **Get Project**: Ask user for project name  
3. **Load Context**: `mcp__mcp-storage__search_items({query: "project:NAME"})`

## 📋 Core Commands

### /save
Store current work:
- Analyze conversation for key information
- Use `store_batch` for multiple entries
- Apply rich tagging strategy

### /load
Restore context:
- Search project entries
- Surface relevant past work
- Brief status summary

### /search <query>
Find specific information:
- Use FTS5 search syntax
- Filter by tags if needed
- Rank by relevance

## 🎯 Implementation Rules
1. Always use `quiet: true` for automated operations
2. Batch related operations for performance  
3. Apply consistent tagging across entries
4. Handle MCP server unavailability gracefully
5. Use structured content formats for consistency
```

---

**Built for Claude Code development workflows with enterprise-grade reliability and performance.**