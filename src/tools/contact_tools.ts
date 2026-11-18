import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CONTACT_CHANNELS, CONTACT_OUTCOMES } from '../domain/types.js';
import {
  MAX_CONTACTS_PER_GROUP,
  type ContactEntry,
  type ContactLogService,
} from '../services/contact_log_service.js';
import { WRITE_ANNOTATIONS, toToolResult } from './tool_result.js';

const contactSchema = z.object({
  volunteer_id: z.number().int().describe('The volunteer who was contacted.'),
  channel: z.enum(CONTACT_CHANNELS).describe('How they were contacted.'),
  outcome: z.enum(CONTACT_OUTCOMES).describe('What happened.'),
  note: z.string().max(280).optional().describe('Optional short note.'),
});

export function registerContactTools(server: McpServer, contactLog: ContactLogService): void {
  server.registerTool(
    'log_contact_attempt',
    {
      title: 'Log contact attempts',
      description:
        'Records that someone reached out to one or more volunteers. Put every contact to log in ' +
        `one "contacts" list (1 to ${MAX_CONTACTS_PER_GROUP}); the same volunteer may appear twice, ` +
        'for example a call and then a text. This is a two-step tool. Call it WITHOUT ' +
        'confirmation_token first: it saves nothing and returns one preview of the whole group ' +
        'plus a short-lived token. Show the preview to the user, and only after they approve, ' +
        'call it again with the same contacts in the same order and that token to save all of ' +
        'them at once. This tool never sends any message.',
      inputSchema: {
        contacts: z
          .array(contactSchema)
          .min(1)
          .max(MAX_CONTACTS_PER_GROUP)
          .describe('Every contact attempt to log in this group.'),
        confirmation_token: z
          .string()
          .optional()
          .describe('Leave out to preview. Include the token from the preview to save.'),
      },
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ contacts, confirmation_token }) => {
      const entries: ContactEntry[] = contacts.map((contact) => {
        return {
          volunteerId: contact.volunteer_id,
          channel: contact.channel,
          outcome: contact.outcome,
          note: contact.note,
        };
      });
      return toToolResult(
        contactLog.logContactAttempts({ contacts: entries, confirmationToken: confirmation_token }),
      );
    },
  );
}
