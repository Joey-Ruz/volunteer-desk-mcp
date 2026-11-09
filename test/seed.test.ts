import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openDatabase } from '../src/data/database.js';
import { seedDatabase } from '../src/data/seed.js';
import { SEED_DAY } from './helpers.js';

const TABLES = ['volunteers', 'events', 'shifts', 'signups', 'contact_attempts'];

function dumpAll(seedDay: Date): string {
  const db = openDatabase(':memory:');
  seedDatabase(db, seedDay);
  const dump: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    dump[table] = db.prepare(`SELECT * FROM ${table} ORDER BY id`).all();
  }
  db.close();
  return JSON.stringify(dump);
}

test('seeding twice produces identical data', () => {
  assert.equal(dumpAll(SEED_DAY), dumpAll(SEED_DAY));
});

test('seed creates 40 volunteers with clearly fictional contact details', () => {
  const db = openDatabase(':memory:');
  seedDatabase(db, SEED_DAY);
  const volunteers = db.prepare('SELECT phone, email FROM volunteers').all() as {
    phone: string;
    email: string;
  }[];

  assert.equal(volunteers.length, 40);
  for (const volunteer of volunteers) {
    assert.match(volunteer.phone, /^\(555\) 555-01\d\d$/);
    assert.match(volunteer.email, /@example\.org$/);
  }
});

test('a different seed day moves the dates but keeps the same people', () => {
  const laterDay = new Date(2027, 2, 1, 10, 0);
  const first = openDatabase(':memory:');
  const second = openDatabase(':memory:');
  seedDatabase(first, SEED_DAY);
  seedDatabase(second, laterDay);

  const namesQuery = 'SELECT first_name, last_name FROM volunteers ORDER BY id';
  assert.deepEqual(first.prepare(namesQuery).all(), second.prepare(namesQuery).all());

  const firstEventQuery = 'SELECT starts_at FROM events ORDER BY id LIMIT 1';
  assert.notDeepEqual(first.prepare(firstEventQuery).get(), second.prepare(firstEventQuery).get());
});
