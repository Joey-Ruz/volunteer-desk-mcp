// Plain data shapes shared by every layer. No behavior lives here.

export const CONTACT_CHANNELS = ['call', 'text', 'email', 'in_person'] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export const CONTACT_OUTCOMES = ['reached', 'left_message', 'no_answer', 'declined'] as const;
export type ContactOutcome = (typeof CONTACT_OUTCOMES)[number];

export const SIGNUP_STATUSES = ['signed_up', 'attended', 'no_show'] as const;
export type SignupStatus = (typeof SIGNUP_STATUSES)[number];

export interface Volunteer {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  preferredChannel: ContactChannel;
  joinedOn: string;
}

export interface Shift {
  id: number;
  eventId: number;
  role: string;
  startsAt: string;
  endsAt: string;
  slotsNeeded: number;
  slotsFilled: number;
}

export interface PantryEvent {
  id: number;
  name: string;
  location: string;
  startsAt: string;
  endsAt: string;
  shifts: Shift[];
}

export interface ContactAttempt {
  id: number;
  volunteerId: number;
  contactedAt: string;
  channel: ContactChannel;
  outcome: ContactOutcome;
  note: string | null;
}

export interface NewContactAttempt {
  volunteerId: number;
  contactedAt: string;
  channel: ContactChannel;
  outcome: ContactOutcome;
  note: string | null;
}

export interface ShiftSignup {
  eventName: string;
  role: string;
  startsAt: string;
  status: SignupStatus;
}

export interface VolunteerWithLastContact {
  volunteer: Volunteer;
  lastContact: ContactAttempt | null;
}
