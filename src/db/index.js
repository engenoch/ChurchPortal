import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * A single synchronous SQLite connection.
 *
 * Why synchronous? node:sqlite is synchronous, which for an API of this size
 * removes an entire class of bugs (connection pool exhaustion, queued queries)
 * while still handling far more than 1000 requests/day. All queries go through
 * prepared statements, so the SQL is compiled once and reused.
 */
function open() {
  const isMemory = config.databasePath === ':memory:';
  if (!isMemory) {
    const dir = path.dirname(path.resolve(config.databasePath));
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  const db = new DatabaseSync(config.databasePath);

  // WAL lets readers keep working while a write is in progress — the setting
  // that matters most once real traffic arrives.
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    PRAGMA temp_store = MEMORY;
    PRAGMA cache_size = -16000;   -- 16 MB page cache
    PRAGMA mmap_size = 268435456; -- 256 MB memory-mapped I/O
  `);

  db.exec(readFileSync(path.join(here, 'schema.sql'), 'utf8'));
  return db;
}

export const db = open();

/** Runs a single migration/statements file (used by seeds and tests). */
export function execFile(fileName, sql = null) {
  const contents = sql ?? readFileSync(path.join(here, fileName), 'utf8');
  db.exec(contents);
}

export function tableCount(table) {
  return db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
}

export function closeDb() {
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    db.close();
  } catch {
    /* already closed */
  }
}
