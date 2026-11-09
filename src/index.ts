#!/usr/bin/env node
// Entry point: open the database (seeding it on first run) and serve tools over stdio.
// stdout carries the MCP protocol, so anything human-readable goes to stderr.

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer, createServices } from './app.js';
import { defaultDatabasePath, openDatabase, seedIfEmpty } from './data/database.js';
import { systemClock } from './services/clock.js';

async function main(): Promise<void> {
  const databasePath = defaultDatabasePath();
  const db = openDatabase(databasePath);
  if (seedIfEmpty(db, systemClock.now())) {
    console.error(`volunteer-desk: seeded synthetic data into ${databasePath}`);
  }

  const server = createServer(createServices(db, systemClock));
  await server.connect(new StdioServerTransport());
  console.error('volunteer-desk: ready on stdio');
}

main().catch((error: unknown) => {
  console.error('volunteer-desk: failed to start', error);
  process.exit(1);
});
