import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface StoredItem {
  id: string;
  title: string;
  content: string;
  tags: string;
  created_at: string;
  updated_at: string;
}

export class StorageDatabase {
  private db: Database.Database;

  constructor(dbPath?: string) {
    // Use user's home directory for database storage (~/.mcp-storage/)
    // This ensures data persists across npm updates and works for all users
    const defaultPath = join(homedir(), '.mcp-storage');
    if (!existsSync(defaultPath)) {
      mkdirSync(defaultPath, { recursive: true });
    }
    
    const finalDbPath = dbPath || join(defaultPath, 'storage.db');
    this.db = new Database(finalDbPath);
    this.initializeTables();
    this.optimizeDatabase();
  }

  private optimizeDatabase(): void {
    // Apply 2025 SQLite performance optimizations
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('mmap_size = 30000000000'); // 30GB memory mapping
    this.db.pragma('cache_size = -20000'); // 160MB cache
    this.db.pragma('page_size = 8192');
    
    // Enable automatic query optimization
    this.db.exec('PRAGMA optimize');
  }

  private initializeTables(): void {
    // Create main storage table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS storage (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Create FTS5 virtual table for full-text search
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS storage_fts USING fts5(
        id UNINDEXED,
        title,
        content,
        tags,
        content='storage',
        content_rowid='rowid'
      )
    `);

    // Create triggers to keep FTS table in sync
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS storage_ai AFTER INSERT ON storage BEGIN
        INSERT INTO storage_fts(id, title, content, tags) 
        VALUES (new.id, new.title, new.content, new.tags);
      END
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS storage_ad AFTER DELETE ON storage BEGIN
        DELETE FROM storage_fts WHERE id = old.id;
      END
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS storage_au AFTER UPDATE ON storage BEGIN
        UPDATE storage_fts SET title = new.title, content = new.content, tags = new.tags
        WHERE id = new.id;
      END
    `);
  }

  store(id: string, title: string, content: string, tags: string[] = []): StoredItem {
    const now = new Date().toISOString();
    const tagsStr = tags.join(',');
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO storage (id, title, content, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, 
        COALESCE((SELECT created_at FROM storage WHERE id = ?), ?), 
        ?)
    `);
    
    stmt.run(id, title, content, tagsStr, id, now, now);
    
    return {
      id,
      title,
      content,
      tags: tagsStr,
      created_at: now,
      updated_at: now
    };
  }

  storeBatch(items: Array<{id: string, title: string, content: string, tags?: string[]}>): StoredItem[] {
    const now = new Date().toISOString();
    
    // Use transaction for optimal batch performance
    const transaction = this.db.transaction(() => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO storage (id, title, content, tags, created_at, updated_at)
        VALUES (?, ?, ?, ?, 
          COALESCE((SELECT created_at FROM storage WHERE id = ?), ?), 
          ?)
      `);
      
      return items.map(item => {
        const tagsStr = (item.tags || []).join(',');
        stmt.run(item.id, item.title, item.content, tagsStr, item.id, now, now);
        
        return {
          id: item.id,
          title: item.title,
          content: item.content,
          tags: tagsStr,
          created_at: now,
          updated_at: now
        };
      });
    });
    
    return transaction();
  }

  retrieve(id: string): StoredItem | null {
    const stmt = this.db.prepare('SELECT * FROM storage WHERE id = ?');
    const result = stmt.get(id) as StoredItem | undefined;
    return result || null;
  }

  search(query: string, limit: number = 10): StoredItem[] {
    // Use FTS5 for full-text search
    const stmt = this.db.prepare(`
      SELECT storage.* FROM storage
      JOIN storage_fts ON storage.id = storage_fts.id
      WHERE storage_fts MATCH ?
      ORDER BY bm25(storage_fts)
      LIMIT ?
    `);
    
    return stmt.all(query, limit) as StoredItem[];
  }

  searchAdvanced(
    query: string, 
    limit: number = 10, 
    tags?: string[], 
    dateFrom?: string, 
    dateTo?: string
  ): StoredItem[] {
    let sql = `
      SELECT storage.* FROM storage
      JOIN storage_fts ON storage.id = storage_fts.id
      WHERE storage_fts MATCH ?
    `;
    
    const params: any[] = [query];
    
    // Add tag filtering
    if (tags && tags.length > 0) {
      const tagConditions = tags.map(() => 'tags LIKE ?').join(' OR ');
      sql += ` AND (${tagConditions})`;
      tags.forEach(tag => params.push(`%${tag}%`));
    }
    
    // Add date filtering
    if (dateFrom) {
      sql += ` AND updated_at >= ?`;
      params.push(dateFrom);
    }
    
    if (dateTo) {
      sql += ` AND updated_at <= ?`;
      params.push(dateTo);
    }
    
    sql += ` ORDER BY bm25(storage_fts) LIMIT ?`;
    params.push(limit);
    
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as StoredItem[];
  }

  list(limit: number = 50, offset: number = 0): StoredItem[] {
    const stmt = this.db.prepare(`
      SELECT * FROM storage 
      ORDER BY updated_at DESC 
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset) as StoredItem[];
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM storage WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }



  close(): void {
    // Run optimization before closing (2025 best practice)
    this.db.exec('PRAGMA optimize');
    this.db.close();
  }

  // Maintenance method for periodic optimization
  optimize(): void {
    // Checkpoint WAL file to prevent unlimited growth
    this.db.exec('PRAGMA wal_checkpoint(FULL)');
    
    // Run query optimization
    this.db.exec('PRAGMA optimize');
    
    // Analyze database for better query planning
    this.db.exec('ANALYZE');
  }

}