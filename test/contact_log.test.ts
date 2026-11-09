import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONFIRMATION_TOKEN_TTL_MINUTES } from '../src/app.js';
import type { LogContactRequest } from '../src/services/contact_log_service.js';
import { countContactAttempts, createTestContext, unwrap } from './helpers.js';

const REQUEST: LogContactRequest = {
  volunteerId: 14,
  channel: 'call',
  outcome: 'left_message',
  note: 'Asked about Line Server shift.',
};

function previewToken(context: ReturnType<typeof createTestContext>): string {
  const response = unwrap(context.services.contactLog.logContactAttempt(REQUEST));
  assert.equal(response.status, 'preview_only_nothing_saved');
  if (response.status !== 'preview_only_nothing_saved') {
    throw new Error('unreachable');
  }
  return response.confirmationToken;
}

test('a preview saves nothing and returns a token', () => {
  const context = createTestContext();
  const before = countContactAttempts(context.db);

  const token = previewToken(context);

  assert.match(token, /^confirm-[0-9a-f]{6}$/);
  assert.equal(countContactAttempts(context.db), before);
});

test('confirming with the preview token saves exactly what was previewed', () => {
  const context = createTestContext();
  const before = countContactAttempts(context.db);
  const token = previewToken(context);

  const response = unwrap(
    context.services.contactLog.logContactAttempt({ ...REQUEST, confirmationToken: token }),
  );

  assert.equal(response.status, 'saved');
  assert.equal(countContactAttempts(context.db), before + 1);
  if (response.status === 'saved') {
    assert.equal(response.saved.contactedAt, '2026-11-06 10:00');
    assert.equal(response.saved.note, 'Asked about Line Server shift.');
  }
});

test('a token cannot be used twice', () => {
  const context = createTestContext();
  const token = previewToken(context);
  context.services.contactLog.logContactAttempt({ ...REQUEST, confirmationToken: token });
  const before = countContactAttempts(context.db);

  const second = context.services.contactLog.logContactAttempt({ ...REQUEST, confirmationToken: token });

  assert.equal(second.kind, 'failure');
  assert.equal(countContactAttempts(context.db), before);
});

test('a made-up token is rejected with a clear message', () => {
  const context = createTestContext();
  const before = countContactAttempts(context.db);

  const result = context.services.contactLog.logContactAttempt({
    ...REQUEST,
    confirmationToken: 'confirm-000000',
  });

  assert.equal(result.kind, 'failure');
  if (result.kind === 'failure') {
    assert.match(result.message, /not valid/);
    assert.match(result.message, /Nothing was saved/);
  }
  assert.equal(countContactAttempts(context.db), before);
});

test('an expired token is rejected', () => {
  const context = createTestContext();
  const token = previewToken(context);
  context.clock.advanceMinutes(CONFIRMATION_TOKEN_TTL_MINUTES + 1);
  const before = countContactAttempts(context.db);

  const result = context.services.contactLog.logContactAttempt({ ...REQUEST, confirmationToken: token });

  assert.equal(result.kind, 'failure');
  if (result.kind === 'failure') {
    assert.match(result.message, /expired/);
  }
  assert.equal(countContactAttempts(context.db), before);
});

test('a token still works just inside its lifetime', () => {
  const context = createTestContext();
  const token = previewToken(context);
  context.clock.advanceMinutes(CONFIRMATION_TOKEN_TTL_MINUTES - 1);

  const result = context.services.contactLog.logContactAttempt({ ...REQUEST, confirmationToken: token });

  assert.equal(result.kind, 'success');
});

test('changing the details after the preview is rejected', () => {
  const context = createTestContext();
  const token = previewToken(context);
  const before = countContactAttempts(context.db);

  const result = context.services.contactLog.logContactAttempt({
    ...REQUEST,
    outcome: 'reached',
    confirmationToken: token,
  });

  assert.equal(result.kind, 'failure');
  assert.equal(countContactAttempts(context.db), before);
});

test('an unknown volunteer gets no preview and no token', () => {
  const context = createTestContext();
  const result = context.services.contactLog.logContactAttempt({ ...REQUEST, volunteerId: 999 });
  assert.equal(result.kind, 'failure');
});

test('a saved contact removes the volunteer from the quiet list', () => {
  const context = createTestContext();
  const token = previewToken(context);
  context.services.contactLog.logContactAttempt({ ...REQUEST, confirmationToken: token });

  const report = unwrap(context.services.volunteers.findNotContactedInDays(21));

  assert.equal(report.count, 14);
  const names = report.volunteers.map((volunteer) => volunteer.name);
  assert.ok(!names.includes('Nadia Birchfield'));
});
