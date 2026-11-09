// Storage contracts. Services depend on these interfaces, never on SQLite directly,
// so a test (or a different database) can stand in without touching service code.

import type {
  ContactAttempt,
  NewContactAttempt,
  PantryEvent,
  ShiftSignup,
  Volunteer,
  VolunteerWithLastContact,
} from './types.js';

export interface EventRepository {
  /** Events starting at or after the given local time, soonest first, with their shifts. */
  listEventsStartingFrom(localDateTime: string): PantryEvent[];
}

export interface VolunteerRepository {
  findById(volunteerId: number): Volunteer | null;
  /** Case-insensitive match against first name, last name, or full name. */
  findByName(nameText: string): Volunteer[];
  listWithLastContact(): VolunteerWithLastContact[];
  listSignups(volunteerId: number): ShiftSignup[];
}

export interface ContactRepository {
  listForVolunteer(volunteerId: number): ContactAttempt[];
  insert(attempt: NewContactAttempt): ContactAttempt;
}
