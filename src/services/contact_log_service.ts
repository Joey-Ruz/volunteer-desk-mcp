// The one write path. Step 1 (no token) returns a preview and a confirmation token.
// Step 2 (same details + that token) saves exactly what was previewed.

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

export interface LogContactRequest {
  volunteerId: number;
  channel: ContactChannel;
  outcome: ContactOutcome;
  note?: string;
  confirmationToken?: string;
}

export interface ContactPreview {
  status: 'preview_only_nothing_saved';
  volunteerName: string;
  willRecord: NewContactAttempt;
  confirmationToken: string;
  tokenExpiresAt: string;
  nextStep: string;
}

export interface ContactSaved {
  status: 'saved';
  volunteerName: string;
  saved: ContactAttempt;
}

export type LogContactResponse = ContactPreview | ContactSaved;

export class ContactLogService {
  constructor(
    private readonly volunteers: VolunteerRepository,
    private readonly contacts: ContactRepository,
    private readonly tokens: ConfirmationTokens<NewContactAttempt>,
    private readonly clock: Clock,
  ) {}

  logContactAttempt(request: LogContactRequest): Result<LogContactResponse> {
    const volunteer = this.volunteers.findById(request.volunteerId);
    if (!volunteer) {
      return failure(`No volunteer has id ${request.volunteerId}. Nothing was saved.`);
    }
    const volunteerName = `${volunteer.firstName} ${volunteer.lastName}`;

    if (request.confirmationToken === undefined) {
      return success(this.preview(request, volunteerName));
    }
    return this.confirm(request, request.confirmationToken, volunteerName);
  }

  private preview(request: LogContactRequest, volunteerName: string): ContactPreview {
    const now = this.clock.now();
    const willRecord: NewContactAttempt = {
      volunteerId: request.volunteerId,
      contactedAt: toLocalDateTime(now),
      channel: request.channel,
      outcome: request.outcome,
      note: normalizeNote(request.note),
    };
    const { token, expiresAt } = this.tokens.issue(willRecord, now);
    return {
      status: 'preview_only_nothing_saved',
      volunteerName,
      willRecord,
      confirmationToken: token,
      tokenExpiresAt: toLocalDateTime(expiresAt),
      nextStep:
        'Show this preview to the user. Only if they approve, call log_contact_attempt again ' +
        'with the same details and this confirmation_token.',
    };
  }

  private confirm(
    request: LogContactRequest,
    token: string,
    volunteerName: string,
  ): Result<LogContactResponse> {
    const check = this.tokens.check(token, this.clock.now());

    if (check.kind === 'unknown') {
      return failure(
        `Confirmation token "${token}" is not valid (never issued, or already used). ` +
          'Nothing was saved. Call log_contact_attempt without a token to get a fresh preview.',
      );
    }
    if (check.kind === 'expired') {
      return failure(
        `Confirmation token "${token}" expired at ${toLocalDateTime(check.expiredAt)}. ` +
          'Nothing was saved. Call log_contact_attempt without a token to get a fresh preview.',
      );
    }

    const previewed = check.payload;
    if (!matchesPreview(previewed, request)) {
      return failure(
        'These details do not match the preview this token was issued for. Nothing was saved. ' +
          'Call log_contact_attempt without a token to preview the new details.',
      );
    }

    const saved = this.contacts.insert(previewed);
    this.tokens.consume(token);
    return success({ status: 'saved', volunteerName, saved });
  }
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

function matchesPreview(previewed: NewContactAttempt, request: LogContactRequest): boolean {
  return (
    previewed.volunteerId === request.volunteerId &&
    previewed.channel === request.channel &&
    previewed.outcome === request.outcome &&
    previewed.note === normalizeNote(request.note)
  );
}
