import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { VolunteerService } from '../services/volunteer_service.js';
import { READ_ONLY_ANNOTATIONS, toToolResult } from './tool_result.js';

export function registerVolunteerTools(server: McpServer, volunteers: VolunteerService): void {
  server.registerTool(
    'find_volunteers_not_contacted',
    {
      title: 'Find volunteers not contacted recently',
      description:
        'Finds volunteers with no logged contact attempt in the last N days, longest silence first ' +
        '(never-contacted volunteers come first). Includes their preferred channel and last outcome.',
      inputSchema: {
        days: z.number().int().min(1).describe('How many days without contact counts as "quiet".'),
      },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ days }) => toToolResult(volunteers.findNotContactedInDays(days)),
  );

  server.registerTool(
    'get_volunteer_history',
    {
      title: 'Get a volunteer\'s history',
      description:
        'Gets one volunteer\'s contact details, upcoming shifts, past shifts (attended or no-show), ' +
        'and every logged contact attempt. Look up by volunteer_id or by name.',
      inputSchema: {
        volunteer_id: z.number().int().optional().describe('The volunteer\'s id.'),
        name: z
          .string()
          .optional()
          .describe('First name, last name, or full name. Used only if volunteer_id is not given.'),
      },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ volunteer_id, name }) => {
      return toToolResult(volunteers.getVolunteerHistory({ volunteerId: volunteer_id, name }));
    },
  );
}
