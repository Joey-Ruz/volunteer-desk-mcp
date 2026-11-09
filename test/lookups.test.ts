import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTestContext, unwrap } from './helpers.js';

test('list_upcoming_events returns the six upcoming events, soonest first', () => {
  const { services } = createTestContext();
  const events = unwrap(services.events.listUpcomingEvents());

  assert.equal(events.length, 6);
  assert.equal(events[0]?.name, 'Food Distribution');
  assert.equal(events[0]?.startsAt, '2026-11-08 08:00');
  assert.equal(events[0]?.totalOpenSlots, 4);
  assert.equal(events[5]?.name, 'Food Drive Kickoff');
});

test('find_unfilled_shifts within 7 days returns only short-staffed shifts in that window', () => {
  const { services } = createTestContext();
  const report = unwrap(services.events.findUnfilledShifts(7));

  assert.equal(report.totalOpenSlots, 7);
  const labels = report.shifts.map((shift) => `${shift.eventName} / ${shift.role} / ${shift.openSlots}`);
  assert.deepEqual(labels, [
    'Food Distribution / Greeter / 1',
    'Food Distribution / Line Server / 3',
    'Warehouse Sort / Sorter / 3',
  ]);
});

test('find_unfilled_shifts with no window covers every upcoming event', () => {
  const { services } = createTestContext();
  const report = unwrap(services.events.findUnfilledShifts());
  assert.equal(report.totalOpenSlots, 23);
});

test('find_unfilled_shifts rejects a window below one day', () => {
  const { services } = createTestContext();
  assert.equal(services.events.findUnfilledShifts(0).kind, 'failure');
});

test('find_volunteers_not_contacted lists never-contacted volunteers first, then longest silence', () => {
  const { services } = createTestContext();
  const report = unwrap(services.volunteers.findNotContactedInDays(21));

  assert.equal(report.count, 15);
  const neverContacted = report.volunteers.slice(0, 5);
  for (const volunteer of neverContacted) {
    assert.equal(volunteer.lastContactedAt, null);
  }
  assert.equal(report.volunteers[5]?.name, 'Nadia Birchfield');
  assert.equal(report.volunteers[5]?.daysSinceLastContact, 70);
});

test('find_volunteers_not_contacted rejects zero days', () => {
  const { services } = createTestContext();
  assert.equal(services.volunteers.findNotContactedInDays(0).kind, 'failure');
});

test('get_volunteer_history finds a volunteer by name and splits upcoming from past shifts', () => {
  const { services } = createTestContext();
  const history = unwrap(services.volunteers.getVolunteerHistory({ name: 'nadia birchfield' }));

  assert.equal(history.volunteerId, 14);
  assert.equal(history.preferredChannel, 'email');
  assert.equal(history.shiftsAttended, 1);
  assert.equal(history.upcomingShifts.length, 2);
  assert.equal(history.upcomingShifts[0]?.role, 'Sorter');
  assert.equal(history.contactAttempts.length, 2);
});

test('get_volunteer_history by id matches the lookup by name', () => {
  const { services } = createTestContext();
  const byId = unwrap(services.volunteers.getVolunteerHistory({ volunteerId: 14 }));
  const byName = unwrap(services.volunteers.getVolunteerHistory({ name: 'Nadia' }));
  assert.deepEqual(byId, byName);
});

test('get_volunteer_history explains unknown volunteers and missing lookups', () => {
  const { services } = createTestContext();
  assert.equal(services.volunteers.getVolunteerHistory({ volunteerId: 999 }).kind, 'failure');
  assert.equal(services.volunteers.getVolunteerHistory({ name: 'Nobody' }).kind, 'failure');
  assert.equal(services.volunteers.getVolunteerHistory({}).kind, 'failure');
});
