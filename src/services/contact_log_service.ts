// The one write path. It logs a group of one or more contact attempts in two steps.
// Step 1 (no token) checks every entry and returns one preview and one confirmation token.
// Step 2 (same entries + that token) saves exactly what was previewed, all or nothing.

import type { ContactRepository, VolunteerRepository } from '../domain/repositories.js';
import { failure, success, type Result } from '../domain/result.js';
import type {
  ContactAttempt,
  ContactChannel,
  ContactOutcome,
  NewContactAttempt,
} from '../domain/types.js';
import { toLocalDateTime } from '../util/local_time.js';
import type { Clock } from './clock.js';
import type { ConfirmationTokens } from './confirmation_tokens.js';

export const MAX_CONTACTS_PER_GROUP = 25;

export interface ContactEntry {
  volunteerId: number;
  channel: ContactChannel;
  outcome: ContactOutcome;
  note?: string;
}

export interface LogContactsRequest {
  contacts: ContactEntry[];
  confirmationToken?: string;
}

export interface PreviewedContact {
  volunteerName: string;
  willRecord: NewContactAttempt;
}

export interface ContactsPreview {
  status: 'preview_only_nothing_saved';
  count: number;
  contacts: PreviewedContact[];
  confirmationToken: string;
  tokenExpiresAt: string;
  nextStep: string;
}

export interface SavedContact {
  volunteerName: string;
  saved: ContactAttempt;
}

export interface ContactsSaved {
  status: 'saved';
  count: number;
  contacts: SavedContact[];
}

export type LogContactsResponse = ContactsPreview | ContactsSaved;

const FRESH_PREVIEW_HINT = 'Call log_contact_attempt without a token to get a fresh preview.';

export class ContactLogService {
  constructor(
    private readonly volunteers: VolunteerRepository,
    private readonly contacts: ContactRepository,
    private readonly tokens: ConfirmationTokens<NewContactAttempt[]>,
    private readonly clock: Clock,
  ) {}

  logContactAttempts(request: LogContactsRequest): Result<LogContactsResponse> {
    const sizeProblem = checkGroupSize(request.contacts.length);
    if (sizeProblem !== null) {
      return failure(sizeProblem);
    }

    const names = this.lookUpVolunteerNames(request.contacts);
    if (names.kind === 'failure') {
      return names;
    }

    if (request.confirmationToken === undefined) {
      return success(this.preview(request.contacts, names.value));
    }
    return this.confirm(request.contacts, request.confirmationToken, names.value);
  }

  /** One name per entry, in order. Fails if any entry names a volunteer who doesn't exist. */
  private lookUpVolunteerNames(entries: ContactEntry[]): Result<string[]> {
    const names: string[] = [];
    const problems: string[] = [];

    for (let index = 0; index < entries.length; index++) {
      const volunteerId = entries[index]!.volunteerId;
      const volunteer = this.volunteers.findById(volunteerId);
      if (volunteer) {
        names.push(`${volunteer.firstName} ${volunteer.lastName}`);
      } else {
        problems.push(`entry ${index + 1}: no volunteer has id ${volunteerId}`);
      }
    }

    if (problems.length > 0) {
      return failure(
        `Some entries are not valid (${problems.join('; ')}). ` +
          'Nothing was saved and no token was issued. Fix those entries and preview the group again.',
      );
    }
    return success(names);
  }

  private preview(entries: ContactEntry[], names: string[]): ContactsPreview {
    const now = this.clock.now();
    const contactedAt = toLocalDateTime(now);

    const willRecord: NewContactAttempt[] = [];
    const previewed: PreviewedContact[] = [];
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index]!;
      const attempt: NewContactAttempt = {
        volunteerId: entry.volunteerId,
        contactedAt,
        channel: entry.channel,
        outcome: entry.outcome,
        note: normalizeNote(entry.note),
      };
      willRecord.push(attempt);
      previewed.push({ volunteerName: names[index]!, willRecord: attempt });
    }

    const { token, expiresAt } = this.tokens.issue(willRecord, now);
    return {
      status: 'preview_only_nothing_saved',
      count: previewed.length,
      contacts: previewed,
      confirmationToken: token,
      tokenExpiresAt: toLocalDateTime(expiresAt),
      nextStep:
        'Show this whole preview to the user. Only if they approve, call log_contact_attempt ' +
        'again with the same contacts in the same order and this confirmation_token.',
    };
  }

  private confirm(
    entries: ContactEntry[],
    token: string,
    names: string[],
  ): Result<LogContactsResponse> {
    const check = this.tokens.check(token, this.clock.now());

    if (check.kind === 'unknown') {
      return failure(
        `Confirmation token "${token}" is not valid (never issued, or already used). ` +
          `Nothing was saved. ${FRESH_PREVIEW_HINT}`,
      );
    }
    if (check.kind === 'expired') {
      return failure(
        `Confirmation token "${token}" expired at ${toLocalDateTime(check.expiredAt)}. ` +
          `Nothing was saved. ${FRESH_PREVIEW_HINT}`,
      );
    }

    const previewed = check.payload;
    if (!matchesPreview(previewed, entries)) {
      return failure(
        'These contacts do not match the preview this token was issued for. Nothing was saved. ' +
          'Call log_contact_attempt without a token to preview the new details.',
      );
    }

    let saved: ContactAttempt[];
    try {
      saved = this.contacts.insertAll(previewed);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return failure(`Saving failed (${reason}). Nothing was saved. ${FRESH_PREVIEW_HINT}`);
    }
    this.tokens.consume(token);

    const savedContacts: SavedContact[] = [];
    for (let index = 0; index < saved.length; index++) {
      savedContacts.push({ volunteerName: names[index]!, saved: saved[index]! });
    }
    return success({ status: 'saved', count: savedContacts.length, contacts: savedContacts });
  }
}

function checkGroupSize(size: number): string | null {
  if (size === 0) {
    return 'The contacts list is empty. Nothing was saved.';
  }
  if (size > MAX_CONTACTS_PER_GROUP) {
    return (
      `A group can hold at most ${MAX_CONTACTS_PER_GROUP} contacts; this one has ${size}. ` +
      'Nothing was saved. Split it into smaller groups.'
    );
  }
  return null;
}

function normalizeNote(note: string | undefined): string | null {
  if (note === undefined) {
    return null;
  }
  const trimmed = note.trim();
  if (trimmed === '') {
    return null;
  }
  return trimmed;
}

/** The same entries, in the same order, with the same details. */
function matchesPreview(previewed: NewContactAttempt[], entries: ContactEntry[]): boolean {
  if (previewed.length !== entries.length) {
    return false;
  }
  for (let index = 0; index < entries.length; index++) {
    const before = previewed[index]!;
    const now = entries[index]!;
    const same =
      before.volunteerId === now.volunteerId &&
      before.channel === now.channel &&
      before.outcome === now.outcome &&
      before.note === normalizeNote(now.note);
    if (!same) {
      return false;
    }
  }
  return true;
}
