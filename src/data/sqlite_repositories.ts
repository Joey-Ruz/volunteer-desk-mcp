// SQLite implementations of the storage contracts in domain/repositories.ts.
// Only this file knows table and column names.

import type { DatabaseSync } from 'node:sqlite';
import type {
  ContactRepository,
  EventRepository,
  VolunteerRepository,
} from '../domain/repositories.js';
import type {
  ContactAttempt,
  ContactChannel,
  ContactOutcome,
  NewContactAttempt,
  PantryEvent,
  Shift,
  ShiftSignup,
  SignupStatus,
  Volunteer,
  VolunteerWithLastContact,
} from '../domain/types.js';

interface VolunteerRow {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  preferred_channel: ContactChannel;
  joined_on: string;
}

interface ContactRow {
  id: number;
  volunteer_id: number;
  contacted_at: string;
  channel: ContactChannel;
  outcome: ContactOutcome;
  note: string | null;
}

function toVolunteer(row: VolunteerRow): Volunteer {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    email: row.email,
    preferredChannel: row.preferred_channel,
    joinedOn: row.joined_on,
  };
}

function toContactAttempt(row: ContactRow): ContactAttempt {
  return {
    id: row.id,
    volunteerId: row.volunteer_id,
    contactedAt: row.contacted_at,
    channel: row.channel,
    outcome: row.outcome,
    note: row.note,
  };
}

export class SqliteEventRepository implements EventRepository {
  constructor(private readonly db: DatabaseSync) {}

  listEventsStartingFrom(localDateTime: string): PantryEvent[] {
    const eventRows = this.db
      .prepare(
        `SELECT id, name, location, starts_at, ends_at
         FROM events
         WHERE starts_at >= ?
         ORDER BY starts_at, id`,
      )
      .all(localDateTime) as unknown as {
      id: number;
      name: string;
      location: string;
      starts_at: string;
      ends_at: string;
    }[];

    const shiftQuery = this.db.prepare(
      `SELECT s.id, s.event_id, s.role, s.starts_at, s.ends_at, s.slots_needed,
              COUNT(su.id) AS slots_filled
       FROM shifts s
       LEFT JOIN signups su ON su.shift_id = s.id
       WHERE s.event_id = ?
       GROUP BY s.id
       ORDER BY s.starts_at, s.id`,
    );

    const events: PantryEvent[] = [];
    for (const row of eventRows) {
      const shiftRows = shiftQuery.all(row.id) as unknown as {
        id: number;
        event_id: number;
        role: string;
        starts_at: string;
        ends_at: string;
        slots_needed: number;
        slots_filled: number;
      }[];

      const shifts: Shift[] = [];
      for (const shiftRow of shiftRows) {
        shifts.push({
          id: shiftRow.id,
          eventId: shiftRow.event_id,
          role: shiftRow.role,
          startsAt: shiftRow.starts_at,
          endsAt: shiftRow.ends_at,
          slotsNeeded: shiftRow.slots_needed,
          slotsFilled: shiftRow.slots_filled,
        });
      }

      events.push({
        id: row.id,
        name: row.name,
        location: row.location,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        shifts,
      });
    }
    return events;
  }
}

export class SqliteVolunteerRepository implements VolunteerRepository {
  constructor(private readonly db: DatabaseSync) {}

  findById(volunteerId: number): Volunteer | null {
    const row = this.db.prepare('SELECT * FROM volunteers WHERE id = ?').get(volunteerId) as
      | VolunteerRow
      | undefined;
    if (!row) {
      return null;
    }
    return toVolunteer(row);
  }

  findByName(nameText: string): Volunteer[] {
    const needle = nameText.trim().toLowerCase();
    const rows = this.db
      .prepare(
        `SELECT * FROM volunteers
         WHERE lower(first_name) = ?
            OR lower(last_name) = ?
            OR lower(first_name || ' ' || last_name) = ?
         ORDER BY last_name, first_name`,
      )
      .all(needle, needle, needle) as unknown as VolunteerRow[];
    return rows.map(toVolunteer);
  }

  listWithLastContact(): VolunteerWithLastContact[] {
    const volunteerRows = this.db
      .prepare('SELECT * FROM volunteers ORDER BY last_name, first_name')
      .all() as unknown as VolunteerRow[];
    const latestContact = this.db.prepare(
      `SELECT * FROM contact_attempts
       WHERE volunteer_id = ?
       ORDER BY contacted_at DESC, id DESC
       LIMIT 1`,
    );

    const results: VolunteerWithLastContact[] = [];
    for (const row of volunteerRows) {
      const contactRow = latestContact.get(row.id) as ContactRow | undefined;
      results.push({
        volunteer: toVolunteer(row),
        lastContact: contactRow ? toContactAttempt(contactRow) : null,
      });
    }
    return results;
  }

  listSignups(volunteerId: number): ShiftSignup[] {
    const rows = this.db
      .prepare(
        `SELECT e.name AS event_name, s.role, s.starts_at, su.status
         FROM signups su
         JOIN shifts s ON s.id = su.shift_id
         JOIN events e ON e.id = s.event_id
         WHERE su.volunteer_id = ?
         ORDER BY s.starts_at DESC`,
      )
      .all(volunteerId) as unknown as {
      event_name: string;
      role: string;
      starts_at: string;
      status: SignupStatus;
    }[];

    const signups: ShiftSignup[] = [];
    for (const row of rows) {
      signups.push({
        eventName: row.event_name,
        role: row.role,
        startsAt: row.starts_at,
        status: row.status,
      });
    }
    return signups;
  }
}

export class SqliteContactRepository implements ContactRepository {
  constructor(private readonly db: DatabaseSync) {}

  listForVolunteer(volunteerId: number): ContactAttempt[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM contact_attempts
         WHERE volunteer_id = ?
         ORDER BY contacted_at DESC, id DESC`,
      )
      .all(volunteerId) as unknown as ContactRow[];
    return rows.map(toContactAttempt);
  }

  insert(attempt: NewContactAttempt): ContactAttempt {
    const result = this.db
      .prepare(
        `INSERT INTO contact_attempts (volunteer_id, contacted_at, channel, outcome, note)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(attempt.volunteerId, attempt.contactedAt, attempt.channel, attempt.outcome, attempt.note);
    return { id: Number(result.lastInsertRowid), ...attempt };
  }
}
