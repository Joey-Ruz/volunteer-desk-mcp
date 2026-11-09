// Opens the SQLite file and fills it with synthetic data the first time.

import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { seedDatabase } from './seed.js';

const IN_MEMORY = ':memory:';

/** `<repo>/data/volunteer-desk.db`, unless VOLUNTEER_DESK_DB points somewhere else. */
export function defaultDatabasePath(): string {
  const override = process.env.VOLUNTEER_DESK_DB;
  if (override) {
    return override;
  }
  // Compiled file lives at dist/src/data/database.js, so the repo root is three levels up.
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  return resolve(repoRoot, 'data', 'volunteer-desk.db');
}

export function openDatabase(path: string): DatabaseSync {
  if (path !== IN_MEMORY) {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

/** Seeds only when the volunteers table is missing, so logged contacts survive restarts. */
export function seedIfEmpty(db: DatabaseSync, seedDay: Date): boolean {
  const table = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'volunteers'")
    .get();
  if (table) {
    return false;
  }
  seedDatabase(db, seedDay);
  return true;
}
