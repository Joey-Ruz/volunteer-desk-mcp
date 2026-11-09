import type { DatabaseSync } from 'node:sqlite';
import { createServices, type Services } from '../src/app.js';
import { openDatabase } from '../src/data/database.js';
import { seedDatabase } from '../src/data/seed.js';
import type { Clock } from '../src/services/clock.js';

/** 10:00 on 11/06/2026, local time. Every test seeds and runs relative to this moment. */
export const SEED_DAY = new Date(2026, 10, 6, 10, 0);

export class FakeClock implements Clock {
  private current: Date;

  constructor(start: Date) {
    this.current = new Date(start.getTime());
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  advanceMinutes(minutes: number): void {
    this.current = new Date(this.current.getTime() + minutes * 60 * 1000);
  }
}

export interface TestContext {
  db: DatabaseSync;
  clock: FakeClock;
  services: Services;
}

export function createTestContext(): TestContext {
  const db = openDatabase(':memory:');
  seedDatabase(db, SEED_DAY);
  const clock = new FakeClock(SEED_DAY);
  return { db, clock, services: createServices(db, clock) };
}

export function countContactAttempts(db: DatabaseSync): number {
  const row = db.prepare('SELECT COUNT(*) AS total FROM contact_attempts').get() as { total: number };
  return row.total;
}

export function unwrap<Value>(
  result: { kind: 'success'; value: Value } | { kind: 'failure'; message: string },
): Value {
  if (result.kind === 'failure') {
    throw new Error(`Expected success, got failure: ${result.message}`);
  }
  return result.value;
}
