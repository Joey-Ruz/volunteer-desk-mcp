import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONFIRMATION_TOKEN_TTL_MINUTES } from '../src/app.js';
import { SqliteContactRepository, SqliteVolunteerRepository } from '../src/data/sqlite_repositories.js';
import type { ContactRepository } from '../src/domain/repositories.js';
import type { NewContactAttempt } from '../src/domain/types.js';
import { ConfirmationTokens } from '../src/services/confirmation_tokens.js';
import {
  ContactLogService,
  MAX_CONTACTS_PER_GROUP,
  type ContactEntry,
  type LogContactsRequest,
} from '../src/services/contact_log_service.js';
import { countContactAttempts, createTestContext, unwrap, type TestContext } from './helpers.js';

const NADIA_CALL: ContactEntry = {
  volunteerId: 14,
  channel: 'call',
  outcome: 'left_message',
  note: 'Asked about Line Server shift.',
};

const SINGLE: LogContactsRequest = { contacts: [NADIA_CALL] };

const GROUP: LogContactsRequest = {
  contacts: [
    NADIA_CALL,
    { volunteerId: 3, channel: 'text', outcome: 'reached' },
    { volunteerId: 7, channel: 'email', outcome: 'no_answer', note: 'Sent shift list.' },
  ],
};

function previewToken(context: TestContext, request: LogContactsRequest): string {
  const response = unwrap(context.services.contactLog.logContactAttempts(request));
  assert.equal(response.status, 'preview_only_nothing_saved');
  if (response.status !== 'preview_only_nothing_saved') {
    throw new Error('unreachable');
  }
  return response.confirmationToken;
}

function confirm(context: TestContext, request: LogContactsRequest, token: string) {
  return context.services.contactLog.logContactAttempts({ ...request, confirmationToken: token });
}

function entriesFor(count: number): ContactEntry[] {
  const entries: ContactEntry[] = [];
  for (let index = 0; index < count; index++) {
    entries.push({ volunteerId: (index % 40) + 1, channel: 'call', outcome: 'reached' });
  }
  return entries;
}

// ---- Single contact (a list of one) ----

test('a preview saves nothing and returns a token', () => {
  const context = createTestContext();
  const before = countContactAttempts(context.db);

  const token = previewToken(context, SINGLE);

  assert.match(token, /^confirm-[0-9a-f]{6}$/);
  assert.equal(countContactAttempts(context.db), before);
});

test('confirming with the preview token saves exactly what was previewed', () => {
  const context = createTestContext();
  const before = countContactAttempts(context.db);
  const token = previewToken(context, SINGLE);

  const response = unwrap(confirm(context, SINGLE, token));

  assert.equal(response.status, 'saved');
  assert.equal(countContactAttempts(context.db), before + 1);
  if (response.status === 'saved') {
    assert.equal(response.count, 1);
    assert.equal(response.contacts[0]?.volunteerName, 'Nadia Birchfield');
    assert.equal(response.contacts[0]?.saved.contactedAt, '2026-11-06 10:00');
    assert.equal(response.contacts[0]?.saved.note, 'Asked about Line Server shift.');
  }
});

test('a token cannot be used twice', () => {
  const context = createTestContext();
  const token = previewToken(context, SINGLE);
  confirm(context, SINGLE, token);
  const before = countContactAttempts(context.db);

  const second = confirm(context, SINGLE, token);

  assert.equal(second.kind, 'failure');
  assert.equal(countContactAttempts(context.db), before);
});

test('a made-up token is rejected with a clear message', () => {
  const context = createTestContext();
  const before = countContactAttempts(context.db);

  const result = confirm(context, SINGLE, 'confirm-000000');

  assert.equal(result.kind, 'failure');
  if (result.kind === 'failure') {
    assert.match(result.message, /not valid/);
    assert.match(result.message, /Nothing was saved/);
  }
  assert.equal(countContactAttempts(context.db), before);
});

test('an expired token is rejected', () => {
  const context = createTestContext();
  const token = previewToken(context, SINGLE);
  context.clock.advanceMinutes(CONFIRMATION_TOKEN_TTL_MINUTES + 1);
  const before = countContactAttempts(context.db);

  const result = confirm(context, SINGLE, token);

  assert.equal(result.kind, 'failure');
  if (result.kind === 'failure') {
    assert.match(result.message, /expired/);
  }
  assert.equal(countContactAttempts(context.db), before);
});

test('a token still works just inside its lifetime', () => {
  const context = createTestContext();
  const token = previewToken(context, SINGLE);
  context.clock.advanceMinutes(CONFIRMATION_TOKEN_TTL_MINUTES - 1);

  const result = confirm(context, SINGLE, token);

  assert.equal(result.kind, 'success');
});

test('changing the details after the preview is rejected', () => {
  const context = createTestContext();
  const token = previewToken(context, SINGLE);
  const before = countContactAttempts(context.db);

  const changed: LogContactsRequest = { contacts: [{ ...NADIA_CALL, outcome: 'reached' }] };
  const result = confirm(context, changed, token);

  assert.equal(result.kind, 'failure');
  assert.equal(countContactAttempts(context.db), before);
});

test('an unknown volunteer gets no preview and no token', () => {
  const context = createTestContext();
  const result = context.services.contactLog.logContactAttempts({
    contacts: [{ ...NADIA_CALL, volunteerId: 999 }],
  });
  assert.equal(result.kind, 'failure');
});

test('a saved contact removes the volunteer from the quiet list', () => {
  const context = createTestContext();
  const token = previewToken(context, SINGLE);
  confirm(context, SINGLE, token);

  const report = unwrap(context.services.volunteers.findNotContactedInDays(21));

  assert.equal(report.count, 14);
  const names = report.volunteers.map((volunteer) => volunteer.name);
  assert.ok(!names.includes('Nadia Birchfield'));
});

// ---- Groups ----

test('a group preview lists every contact, saves nothing, and issues one token', () => {
  const context = createTestContext();
  const before = countContactAttempts(context.db);

  const response = unwrap(context.services.contactLog.logContactAttempts(GROUP));

  assert.equal(response.status, 'preview_only_nothing_saved');
  if (response.status === 'preview_only_nothing_saved') {
    assert.equal(response.count, 3);
    assert.equal(response.contacts.length, 3);
    assert.equal(response.contacts[0]?.volunteerName, 'Nadia Birchfield');
    assert.match(response.confirmationToken, /^confirm-[0-9a-f]{6}$/);
  }
  assert.equal(countContactAttempts(context.db), before);
});

test('one confirmation saves the whole group', () => {
  const context = createTestContext();
  const before = countContactAttempts(context.db);
  const token = previewToken(context, GROUP);

  const response = unwrap(confirm(context, GROUP, token));

  assert.equal(response.status, 'saved');
  if (response.status === 'saved') {
    assert.equal(response.count, 3);
    const savedIds = response.contacts.map((contact) => contact.saved.volunteerId);
    assert.deepEqual(savedIds, [14, 3, 7]);
  }
  assert.equal(countContactAttempts(context.db), before + 3);
});

test('one bad entry rejects the whole group and names the entry', () => {
  const context = createTestContext();
  const before = countContactAttempts(context.db);
  const withBadEntry: LogContactsRequest = {
    contacts: [NADIA_CALL, { volunteerId: 999, channel: 'text', outcome: 'reached' }],
  };

  const result = context.services.contactLog.logContactAttempts(withBadEntry);

  assert.equal(result.kind, 'failure');
  if (result.kind === 'failure') {
    assert.match(result.message, /entry 2: no volunteer has id 999/);
    assert.match(result.message, /no token was issued/);
  }
  assert.equal(countContactAttempts(context.db), before);
});

test('reordering or dropping entries after the preview is rejected', () => {
  const context = createTestContext();
  const token = previewToken(context, GROUP);
  const before = countContactAttempts(context.db);

  const reordered: LogContactsRequest = { contacts: [...GROUP.contacts].reverse() };
  const dropped: LogContactsRequest = { contacts: GROUP.contacts.slice(0, 2) };

  assert.equal(confirm(context, reordered, token).kind, 'failure');
  assert.equal(confirm(context, dropped, token).kind, 'failure');
  assert.equal(countContactAttempts(context.db), before);
});

test('the same volunteer can appear twice, and both attempts are saved', () => {
  const context = createTestContext();
  const before = countContactAttempts(context.db);
  const callThenText: LogContactsRequest = {
    contacts: [NADIA_CALL, { volunteerId: 14, channel: 'text', outcome: 'reached' }],
  };
  const token = previewToken(context, callThenText);

  const response = unwrap(confirm(context, callThenText, token));

  assert.equal(response.status, 'saved');
  assert.equal(countContactAttempts(context.db), before + 2);
});

test(`a group of ${MAX_CONTACTS_PER_GROUP} previews, and one more is rejected`, () => {
  const context = createTestContext();

  const atCap = context.services.contactLog.logContactAttempts({
    contacts: entriesFor(MAX_CONTACTS_PER_GROUP),
  });
  const overCap = context.services.contactLog.logContactAttempts({
    contacts: entriesFor(MAX_CONTACTS_PER_GROUP + 1),
  });

  assert.equal(atCap.kind, 'success');
  assert.equal(overCap.kind, 'failure');
  if (overCap.kind === 'failure') {
    assert.match(overCap.message, /at most 25/);
  }
});

test('an empty group is rejected', () => {
  const context = createTestContext();
  const result = context.services.contactLog.logContactAttempts({ contacts: [] });
  assert.equal(result.kind, 'failure');
});

// ---- All or nothing ----

test('the database undoes earlier rows when a later row in the group fails', () => {
  const context = createTestContext();
  const repository = new SqliteContactRepository(context.db);
  const before = countContactAttempts(context.db);
  const attempts: NewContactAttempt[] = [
    { volunteerId: 14, contactedAt: '2026-11-06 10:00', channel: 'call', outcome: 'reached', note: null },
    // Volunteer 999 doesn't exist, so the database refuses this row.
    { volunteerId: 999, contactedAt: '2026-11-06 10:00', channel: 'call', outcome: 'reached', note: null },
  ];

  assert.throws(() => repository.insertAll(attempts));
  assert.equal(countContactAttempts(context.db), before);
});

test('a failed save reports that nothing was saved', () => {
  const context = createTestContext();
  const failingContacts: ContactRepository = {
    listForVolunteer: () => [],
    insertAll: () => {
      throw new Error('disk full');
    },
  };
  const service = new ContactLogService(
    new SqliteVolunteerRepository(context.db),
    failingContacts,
    new ConfirmationTokens<NewContactAttempt[]>(CONFIRMATION_TOKEN_TTL_MINUTES),
    context.clock,
  );
  const preview = unwrap(service.logContactAttempts(GROUP));
  assert.equal(preview.status, 'preview_only_nothing_saved');
  if (preview.status !== 'preview_only_nothing_saved') {
    throw new Error('unreachable');
  }

  const result = service.logContactAttempts({ ...GROUP, confirmationToken: preview.confirmationToken });

  assert.equal(result.kind, 'failure');
  if (result.kind === 'failure') {
    assert.match(result.message, /disk full/);
    assert.match(result.message, /Nothing was saved/);
  }
});
