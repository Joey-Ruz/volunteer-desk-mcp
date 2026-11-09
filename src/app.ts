// Composition root: the only place that knows which concrete classes get wired together.

import type { DatabaseSync } from 'node:sqlite';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  SqliteContactRepository,
  SqliteEventRepository,
  SqliteVolunteerRepository,
} from './data/sqlite_repositories.js';
import type { NewContactAttempt } from './domain/types.js';
import type { Clock } from './services/clock.js';
import { ConfirmationTokens, type TokenGenerator } from './services/confirmation_tokens.js';
import { ContactLogService } from './services/contact_log_service.js';
import { EventService } from './services/event_service.js';
import { VolunteerService } from './services/volunteer_service.js';
import { registerContactTools } from './tools/contact_tools.js';
import { registerEventTools } from './tools/event_tools.js';
import { registerVolunteerTools } from './tools/volunteer_tools.js';

export const CONFIRMATION_TOKEN_TTL_MINUTES = 10;

export interface Services {
  events: EventService;
  volunteers: VolunteerService;
  contactLog: ContactLogService;
}

export function createServices(
  db: DatabaseSync,
  clock: Clock,
  generateToken?: TokenGenerator,
): Services {
  const eventRepository = new SqliteEventRepository(db);
  const volunteerRepository = new SqliteVolunteerRepository(db);
  const contactRepository = new SqliteContactRepository(db);
  const tokens = new ConfirmationTokens<NewContactAttempt>(
    CONFIRMATION_TOKEN_TTL_MINUTES,
    generateToken,
  );

  return {
    events: new EventService(eventRepository, clock),
    volunteers: new VolunteerService(volunteerRepository, contactRepository, clock),
    contactLog: new ContactLogService(volunteerRepository, contactRepository, tokens, clock),
  };
}

export function createServer(services: Services): McpServer {
  const server = new McpServer({ name: 'volunteer-desk', version: '1.0.0' });
  registerEventTools(server, services.events);
  registerVolunteerTools(server, services.volunteers);
  registerContactTools(server, services.contactLog);
  return server;
}
