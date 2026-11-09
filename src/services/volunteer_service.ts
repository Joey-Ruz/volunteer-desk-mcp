import type { ContactRepository, VolunteerRepository } from '../domain/repositories.js';
import { failure, success, type Result } from '../domain/result.js';
import type {
  ContactAttempt,
  ContactChannel,
  ContactOutcome,
  ShiftSignup,
  Volunteer,
} from '../domain/types.js';
import { calendarDaysSince, toLocalDateTime } from '../util/local_time.js';
import type { Clock } from './clock.js';

export interface QuietVolunteer {
  volunteerId: number;
  name: string;
  phone: string;
  email: string;
  preferredChannel: ContactChannel;
  lastContactedAt: string | null;
  daysSinceLastContact: number | null;
  lastOutcome: ContactOutcome | null;
}

export interface QuietVolunteersReport {
  notContactedInDays: number;
  count: number;
  volunteers: QuietVolunteer[];
}

export interface VolunteerHistory {
  volunteerId: number;
  name: string;
  phone: string;
  email: string;
  preferredChannel: ContactChannel;
  joinedOn: string;
  shiftsAttended: number;
  noShows: number;
  upcomingShifts: ShiftSignup[];
  pastShifts: ShiftSignup[];
  contactAttempts: ContactAttempt[];
}

export interface VolunteerLookup {
  volunteerId?: number;
  name?: string;
}

function fullName(volunteer: Volunteer): string {
  return `${volunteer.firstName} ${volunteer.lastName}`;
}

export class VolunteerService {
  constructor(
    private readonly volunteers: VolunteerRepository,
    private readonly contacts: ContactRepository,
    private readonly clock: Clock,
  ) {}

  /** Volunteers with no logged contact attempt in the last `days` days (never-contacted first). */
  findNotContactedInDays(days: number): Result<QuietVolunteersReport> {
    if (!Number.isInteger(days) || days < 1) {
      return failure('days must be a whole number of 1 or more.');
    }

    const now = this.clock.now();
    const quiet: QuietVolunteer[] = [];
    for (const { volunteer, lastContact } of this.volunteers.listWithLastContact()) {
      let daysSince: number | null = null;
      if (lastContact) {
        daysSince = calendarDaysSince(lastContact.contactedAt, now);
        if (daysSince < days) {
          continue;
        }
      }
      quiet.push({
        volunteerId: volunteer.id,
        name: fullName(volunteer),
        phone: volunteer.phone,
        email: volunteer.email,
        preferredChannel: volunteer.preferredChannel,
        lastContactedAt: lastContact ? lastContact.contactedAt : null,
        daysSinceLastContact: daysSince,
        lastOutcome: lastContact ? lastContact.outcome : null,
      });
    }

    quiet.sort(byLongestSilenceFirst);
    return success({ notContactedInDays: days, count: quiet.length, volunteers: quiet });
  }

  getVolunteerHistory(lookup: VolunteerLookup): Result<VolunteerHistory> {
    const found = this.resolveVolunteer(lookup);
    if (found.kind === 'failure') {
      return found;
    }
    const volunteer = found.value;

    const nowText = toLocalDateTime(this.clock.now());
    const upcomingShifts: ShiftSignup[] = [];
    const pastShifts: ShiftSignup[] = [];
    let shiftsAttended = 0;
    let noShows = 0;

    for (const signup of this.volunteers.listSignups(volunteer.id)) {
      if (signup.startsAt >= nowText) {
        upcomingShifts.push(signup);
        continue;
      }
      pastShifts.push(signup);
      if (signup.status === 'attended') {
        shiftsAttended++;
      }
      if (signup.status === 'no_show') {
        noShows++;
      }
    }
    // Repository returns newest first; upcoming reads better soonest first.
    upcomingShifts.reverse();

    return success({
      volunteerId: volunteer.id,
      name: fullName(volunteer),
      phone: volunteer.phone,
      email: volunteer.email,
      preferredChannel: volunteer.preferredChannel,
      joinedOn: volunteer.joinedOn,
      shiftsAttended,
      noShows,
      upcomingShifts,
      pastShifts,
      contactAttempts: this.contacts.listForVolunteer(volunteer.id),
    });
  }

  private resolveVolunteer(lookup: VolunteerLookup): Result<Volunteer> {
    if (lookup.volunteerId !== undefined) {
      const volunteer = this.volunteers.findById(lookup.volunteerId);
      if (!volunteer) {
        return failure(`No volunteer has id ${lookup.volunteerId}.`);
      }
      return success(volunteer);
    }

    if (lookup.name === undefined || lookup.name.trim() === '') {
      return failure('Provide either volunteer_id or name.');
    }

    const matches = this.volunteers.findByName(lookup.name);
    if (matches.length === 0) {
      return failure(`No volunteer matches the name "${lookup.name}".`);
    }
    if (matches.length > 1) {
      const options = matches.map((volunteer) => `${fullName(volunteer)} (id ${volunteer.id})`);
      return failure(`"${lookup.name}" matches more than one volunteer: ${options.join(', ')}. Use volunteer_id.`);
    }
    return success(matches[0] as Volunteer);
  }
}

function byLongestSilenceFirst(a: QuietVolunteer, b: QuietVolunteer): number {
  // Never contacted (null) sorts ahead of everyone else.
  const aDays = a.daysSinceLastContact ?? Number.MAX_SAFE_INTEGER;
  const bDays = b.daysSinceLastContact ?? Number.MAX_SAFE_INTEGER;
  if (aDays !== bDays) {
    return bDays - aDays;
  }
  return a.name.localeCompare(b.name);
}
