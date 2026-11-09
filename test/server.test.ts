// End-to-end: starts the built server over stdio, exactly as Claude Desktop does.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const READ_TOOLS = [
  'find_unfilled_shifts',
  'find_volunteers_not_contacted',
  'get_volunteer_history',
  'list_upcoming_events',
];

let client: Client;
let tempFolder: string;

before(async () => {
  tempFolder = mkdtempSync(join(tmpdir(), 'volunteer-desk-'));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(import.meta.dirname, '..', 'src', 'index.js')],
    env: { ...process.env, VOLUNTEER_DESK_DB: join(tempFolder, 'test.db') } as Record<string, string>,
    stderr: 'ignore',
  });
  client = new Client({ name: 'server-test', version: '1.0.0' });
  await client.connect(transport);
});

after(async () => {
  await client.close();
  rmSync(tempFolder, { recursive: true, force: true });
});

test('the server exposes exactly five tools', async () => {
  const { tools } = await client.listTools();
  const names = tools.map((tool) => tool.name).sort();
  assert.deepEqual(names, [...READ_TOOLS, 'log_contact_attempt'].sort());
});

test('read tools are annotated read-only and the write tool is not', async () => {
  const { tools } = await client.listTools();
  for (const tool of tools) {
    const expectReadOnly = READ_TOOLS.includes(tool.name);
    assert.equal(tool.annotations?.readOnlyHint, expectReadOnly, tool.name);
  }
});

test('the server seeds itself on first start and answers a lookup', async () => {
  const result = await client.callTool({ name: 'list_upcoming_events', arguments: {} });
  assert.notEqual(result.isError, true);
  const content = result.content as { type: string; text: string }[];
  const events = JSON.parse(content[0]?.text ?? '[]') as unknown[];
  assert.equal(events.length, 6);
});
