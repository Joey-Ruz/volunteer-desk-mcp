// Holds previews awaiting confirmation. A token is single-use and expires after `ttlMinutes`.

import { randomBytes } from 'node:crypto';

export type TokenGenerator = () => string;

export const randomTokenGenerator: TokenGenerator = () => {
  return `confirm-${randomBytes(3).toString('hex')}`;
};

interface PendingEntry<Payload> {
  payload: Payload;
  expiresAt: Date;
}

export type RedeemOutcome<Payload> =
  | { kind: 'unknown' }
  | { kind: 'expired'; expiredAt: Date }
  | { kind: 'valid'; payload: Payload };

export class ConfirmationTokens<Payload> {
  private readonly pending = new Map<string, PendingEntry<Payload>>();

  constructor(
    private readonly ttlMinutes: number,
    private readonly generateToken: TokenGenerator = randomTokenGenerator,
  ) {}

  issue(payload: Payload, now: Date): { token: string; expiresAt: Date } {
    const token = this.generateToken();
    const expiresAt = new Date(now.getTime() + this.ttlMinutes * 60 * 1000);
    this.pending.set(token, { payload, expiresAt });
    return { token, expiresAt };
  }

  /** Looks a token up without using it. Expired tokens are discarded on sight. */
  check(token: string, now: Date): RedeemOutcome<Payload> {
    const entry = this.pending.get(token);
    if (!entry) {
      return { kind: 'unknown' };
    }
    if (now.getTime() > entry.expiresAt.getTime()) {
      this.pending.delete(token);
      return { kind: 'expired', expiredAt: entry.expiresAt };
    }
    return { kind: 'valid', payload: entry.payload };
  }

  /** Marks a token as used so it can never write twice. */
  consume(token: string): void {
    this.pending.delete(token);
  }
}
