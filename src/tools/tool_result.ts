// Turns a service Result into the shape MCP expects. Shared by every tool handler.

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Result } from '../domain/result.js';

export function toToolResult<Value>(result: Result<Value>): CallToolResult {
  switch (result.kind) {
    case 'success':
      return { content: [{ type: 'text', text: JSON.stringify(result.value, null, 2) }] };
    case 'failure':
      return { content: [{ type: 'text', text: result.message }], isError: true };
  }
}

/** Lookups never change data and never reach outside this server. */
export const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  openWorldHint: false,
} as const;

/** Adds a row; never edits or deletes, and repeating it adds another row. */
export const WRITE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;
