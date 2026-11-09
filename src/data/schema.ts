export const DROP_SCHEMA = `
  DROP TABLE IF EXISTS contact_attempts;
  DROP TABLE IF EXISTS signups;
  DROP TABLE IF EXISTS shifts;
  DROP TABLE IF EXISTS events;
  DROP TABLE IF EXISTS volunteers;
`;

export const CREATE_SCHEMA = `
  CREATE TABLE volunteers (
    id                INTEGER PRIMARY KEY,
    first_name        TEXT NOT NULL,
    last_name         TEXT NOT NULL,
    phone             TEXT NOT NULL,
    email             TEXT NOT NULL,
    preferred_channel TEXT NOT NULL CHECK (preferred_channel IN ('call', 'text', 'email', 'in_person')),
    joined_on         TEXT NOT NULL
  );

  CREATE TABLE events (
    id        INTEGER PRIMARY KEY,
    name      TEXT NOT NULL,
    location  TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    ends_at   TEXT NOT NULL
  );

  CREATE TABLE shifts (
    id           INTEGER PRIMARY KEY,
    event_id     INTEGER NOT NULL REFERENCES events(id),
    role         TEXT NOT NULL,
    starts_at    TEXT NOT NULL,
    ends_at      TEXT NOT NULL,
    slots_needed INTEGER NOT NULL
  );

  CREATE TABLE signups (
    id           INTEGER PRIMARY KEY,
    shift_id     INTEGER NOT NULL REFERENCES shifts(id),
    volunteer_id INTEGER NOT NULL REFERENCES volunteers(id),
    status       TEXT NOT NULL CHECK (status IN ('signed_up', 'attended', 'no_show')),
    UNIQUE (shift_id, volunteer_id)
  );

  CREATE TABLE contact_attempts (
    id           INTEGER PRIMARY KEY,
    volunteer_id INTEGER NOT NULL REFERENCES volunteers(id),
    contacted_at TEXT NOT NULL,
    channel      TEXT NOT NULL CHECK (channel IN ('call', 'text', 'email', 'in_person')),
    outcome      TEXT NOT NULL CHECK (outcome IN ('reached', 'left_message', 'no_answer', 'declined')),
    note         TEXT
  );
`;
