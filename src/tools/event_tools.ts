import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EventService } from '../services/event_service.js';
import { READ_ONLY_ANNOTATIONS, toToolResult } from './tool_result.js';

export function registerEventTools(server: McpServer, events: EventService): void {
  server.registerTool(
    'list_upcoming_events',
    {
      title: 'List upcoming events',
      description:
        'Lists the food pantry\'s upcoming events, soonest first, with each shift\'s role, ' +
        'time, and how many volunteer slots are filled versus needed.',
      inputSchema: {},
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () => toToolResult(events.listUpcomingEvents()),
  );

  server.registerTool(
    'find_unfilled_shifts',
    {
      title: 'Find unfilled shifts',
      description:
        'Finds upcoming shifts that still need volunteers, soonest first, with open slot counts. ' +
        'Optionally limit to shifts within the next N days.',
      inputSchema: {
        within_days: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe('Only include shifts within this many days from today.'),
      },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ within_days }) => toToolResult(events.findUnfilledShifts(within_days)),
  );
}
