import type { EventRepository } from '../domain/repositories.js';
import { failure, success, type Result } from '../domain/result.js';
import type { PantryEvent, Shift } from '../domain/types.js';
import { atTimeOnDayPlus, toLocalDateTime } from '../util/local_time.js';
import type { Clock } from './clock.js';

export interface ShiftSummary {
  shiftId: number;
  role: string;
  startsAt: string;
  endsAt: string;
  slotsNeeded: number;
  slotsFilled: number;
  openSlots: number;
}

export interface UpcomingEventSummary {
  eventId: number;
  name: string;
  location: string;
  startsAt: string;
  endsAt: string;
  totalOpenSlots: number;
  shifts: ShiftSummary[];
}

export interface UnfilledShift extends ShiftSummary {
  eventId: number;
  eventName: string;
  location: string;
}

export interface UnfilledShiftsReport {
  withinDays: number | null;
  totalOpenSlots: number;
  shifts: UnfilledShift[];
}

function summarizeShift(shift: Shift): ShiftSummary {
  return {
    shiftId: shift.id,
    role: shift.role,
    startsAt: shift.startsAt,
    endsAt: shift.endsAt,
    slotsNeeded: shift.slotsNeeded,
    slotsFilled: shift.slotsFilled,
    openSlots: Math.max(shift.slotsNeeded - shift.slotsFilled, 0),
  };
}

export class EventService {
  constructor(
    private readonly events: EventRepository,
    private readonly clock: Clock,
  ) {}

  listUpcomingEvents(): Result<UpcomingEventSummary[]> {
    const summaries: UpcomingEventSummary[] = [];
    for (const event of this.upcomingEvents()) {
      const shifts = event.shifts.map(summarizeShift);
      let totalOpenSlots = 0;
      for (const shift of shifts) {
        totalOpenSlots += shift.openSlots;
      }
      summaries.push({
        eventId: event.id,
        name: event.name,
        location: event.location,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        totalOpenSlots,
        shifts,
      });
    }
    return success(summaries);
  }

  /** Shifts that still need people, soonest first. `withinDays` limits how far ahead to look. */
  findUnfilledShifts(withinDays?: number): Result<UnfilledShiftsReport> {
    if (withinDays !== undefined && (!Number.isInteger(withinDays) || withinDays < 1)) {
      return failure('within_days must be a whole number of 1 or more.');
    }

    let cutoff: string | null = null;
    if (withinDays !== undefined) {
      cutoff = toLocalDateTime(atTimeOnDayPlus(this.clock.now(), withinDays, 23, 59));
    }

    const unfilled: UnfilledShift[] = [];
    let totalOpenSlots = 0;
    for (const event of this.upcomingEvents()) {
      if (cutoff !== null && event.startsAt > cutoff) {
        continue;
      }
      for (const shift of event.shifts) {
        const summary = summarizeShift(shift);
        if (summary.openSlots === 0) {
          continue;
        }
        totalOpenSlots += summary.openSlots;
        unfilled.push({
          ...summary,
          eventId: event.id,
          eventName: event.name,
          location: event.location,
        });
      }
    }

    return success({ withinDays: withinDays ?? null, totalOpenSlots, shifts: unfilled });
  }

  private upcomingEvents(): PantryEvent[] {
    return this.events.listEventsStartingFrom(toLocalDateTime(this.clock.now()));
  }
}
