// Builds the synthetic dataset. Deterministic: the same seed day always yields the same rows.

import type { DatabaseSync } from 'node:sqlite';
import {
  CONTACT_CHANNELS,
  type ContactChannel,
  type ContactOutcome,
  type SignupStatus,
} from '../domain/types.js';
import { atTimeOnDayPlus, toLocalDate, toLocalDateTime } from '../util/local_time.js';
import { SeededRandom } from '../util/seeded_random.js';
import { CREATE_SCHEMA, DROP_SCHEMA } from './schema.js';
import {
  CONTACT_NOTES,
  FIRST_NAMES,
  LAST_NAMES,
  PAST_EVENTS,
  RANDOM_SEED,
  UPCOMING_EVENTS,
  type EventPlan,
} from './seed_plan.js';

const VOLUNTEER_COUNT = 40;

/** Drops every table and rebuilds the synthetic dataset around `seedDay`. */
export function seedDatabase(db: DatabaseSync, seedDay: Date): void {
  const random = new SeededRandom(RANDOM_SEED);

  db.exec('BEGIN');
  try {
    db.exec(DROP_SCHEMA);
    db.exec(CREATE_SCHEMA);
    const volunteerIds = insertVolunteers(db, random, seedDay);
    for (const plan of PAST_EVENTS) {
      insertEvent(db, random, seedDay, plan, volunteerIds, true);
    }
    for (const plan of UPCOMING_EVENTS) {
      insertEvent(db, random, seedDay, plan, volunteerIds, false);
    }
    insertContactHistory(db, random, seedDay, volunteerIds);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function insertVolunteers(db: DatabaseSync, random: SeededRandom, seedDay: Date): number[] {
  const insert = db.prepare(
    `INSERT INTO volunteers (first_name, last_name, phone, email, preferred_channel, joined_on)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const shuffledLastNames = random.shuffle(LAST_NAMES);
  const ids: number[] = [];

  for (let index = 0; index < VOLUNTEER_COUNT; index++) {
    const firstName = FIRST_NAMES[index] as string;
    const lastName = shuffledLastNames[index] as string;
    // 555-0100 through 555-0199 is reserved for fictional use, so these can never ring a real phone.
    const phone = `(555) 555-01${String(index).padStart(2, '0')}`;
    const email = `${firstName}.${lastName}@example.org`.toLowerCase();
    const preferredChannel = random.pick(CONTACT_CHANNELS);
    const joinedOn = toLocalDate(atTimeOnDayPlus(seedDay, -random.intBetween(30, 400), 0, 0));

    const result = insert.run(firstName, lastName, phone, email, preferredChannel, joinedOn);
    ids.push(Number(result.lastInsertRowid));
  }
  return ids;
}

function insertEvent(
  db: DatabaseSync,
  random: SeededRandom,
  seedDay: Date,
  plan: EventPlan,
  volunteerIds: number[],
  isPast: boolean,
): void {
  const insertEventRow = db.prepare(
    'INSERT INTO events (name, location, starts_at, ends_at) VALUES (?, ?, ?, ?)',
  );
  const insertShift = db.prepare(
    `INSERT INTO shifts (event_id, role, starts_at, ends_at, slots_needed)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const insertSignup = db.prepare(
    'INSERT INTO signups (shift_id, volunteer_id, status) VALUES (?, ?, ?)',
  );

  const eventResult = insertEventRow.run(
    plan.name,
    plan.location,
    toLocalDateTime(atTimeOnDayPlus(seedDay, plan.dayOffset, plan.startHour, 0)),
    toLocalDateTime(atTimeOnDayPlus(seedDay, plan.dayOffset, plan.endHour, 0)),
  );
  const eventId = Number(eventResult.lastInsertRowid);

  // A volunteer works at most one shift per event, so draw from one shuffled pool per event.
  const pool = random.shuffle(volunteerIds);
  let poolIndex = 0;

  for (const shift of plan.shifts) {
    const shiftResult = insertShift.run(
      eventId,
      shift.role,
      toLocalDateTime(atTimeOnDayPlus(seedDay, plan.dayOffset, shift.startHour, 0)),
      toLocalDateTime(atTimeOnDayPlus(seedDay, plan.dayOffset, shift.endHour, 0)),
      shift.slotsNeeded,
    );
    const shiftId = Number(shiftResult.lastInsertRowid);

    for (let filled = 0; filled < shift.slotsFilled; filled++) {
      const volunteerId = pool[poolIndex] as number;
      poolIndex++;
      const status = pickSignupStatus(random, isPast);
      insertSignup.run(shiftId, volunteerId, status);
    }
  }
}

function pickSignupStatus(random: SeededRandom, isPast: boolean): SignupStatus {
  if (!isPast) {
    return 'signed_up';
  }
  if (random.next() < 0.9) {
    return 'attended';
  }
  return 'no_show';
}

function insertContactHistory(
  db: DatabaseSync,
  random: SeededRandom,
  seedDay: Date,
  volunteerIds: number[],
): void {
  const preferredChannelOf = db.prepare('SELECT preferred_channel FROM volunteers WHERE id = ?');
  const insert = db.prepare(
    `INSERT INTO contact_attempts (volunteer_id, contacted_at, channel, outcome, note)
     VALUES (?, ?, ?, ?, ?)`,
  );

  for (const volunteerId of volunteerIds) {
    const row = preferredChannelOf.get(volunteerId) as { preferred_channel: ContactChannel };
    const mostRecentDaysAgo = pickMostRecentContactDaysAgo(random);
    if (mostRecentDaysAgo === null) {
      continue;
    }

    // One to three attempts, the newest `mostRecentDaysAgo` days back, older ones spaced out.
    const attemptCount = random.intBetween(1, 3);
    let daysAgo = mostRecentDaysAgo;
    for (let attempt = 0; attempt < attemptCount; attempt++) {
      const contactedAt = atTimeOnDayPlus(seedDay, -daysAgo, random.intBetween(9, 19), 0);
      const channel = random.next() < 0.7 ? row.preferred_channel : random.pick(CONTACT_CHANNELS);
      const outcome = pickOutcome(random);
      const note = random.next() < 0.4 ? random.pick(CONTACT_NOTES) : null;
      insert.run(volunteerId, toLocalDateTime(contactedAt), channel, outcome, note);
      daysAgo += random.intBetween(7, 30);
    }
  }
}

/** Roughly a third of volunteers have gone quiet (25+ days); a few were never contacted. */
function pickMostRecentContactDaysAgo(random: SeededRandom): number | null {
  const roll = random.next();
  if (roll < 0.06) {
    return null;
  }
  if (roll < 0.35) {
    return random.intBetween(25, 70);
  }
  return random.intBetween(1, 20);
}

function pickOutcome(random: SeededRandom): ContactOutcome {
  const roll = random.next();
  if (roll < 0.5) {
    return 'reached';
  }
  if (roll < 0.75) {
    return 'left_message';
  }
  if (roll < 0.95) {
    return 'no_answer';
  }
  return 'declined';
}
