import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CONTACT_CHANNELS, CONTACT_OUTCOMES } from '../domain/types.js';
import type { ContactLogService } from '../services/contact_log_service.js';
import { WRITE_ANNOTATIONS, toToolResult } from './tool_result.js';

export function registerContactTools(server: McpServer, contactLog: ContactLogService): void {
  server.registerTool(
    'log_contact_attempt',
    {
      title: 'Log a contact attempt',
      description:
        'Records that someone reached out to a volunteer. This is a two-step tool. ' +
        'Call it WITHOUT confirmation_token first: it saves nothing and returns a preview plus a ' +
        'short-lived token. Show the preview to the user, and only after they approve, call it ' +
        'again with the same details and that token to save. This tool never sends any message.',
      inputSchema: {
        volunteer_id: z.number().int().describe('The volunteer who was contacted.'),
        channel: z.enum(CONTACT_CHANNELS).describe('How they were contacted.'),
        outcome: z.enum(CONTACT_OUTCOMES).describe('What happened.'),
        note: z.string().max(280).optional().describe('Optional short note.'),
        confirmation_token: z
          .string()
          .optional()
          .describe('Leave out to preview. Include the token from the preview to save.'),
      },
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ volunteer_id, channel, outcome, note, confirmation_token }) => {
      return toToolResult(
        contactLog.logContactAttempt({
          volunteerId: volunteer_id,
          channel,
          outcome,
          note,
          confirmationToken: confirmation_token,
        }),
      );
    },
  );
}
