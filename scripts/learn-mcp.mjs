import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const [operation, value, output] = process.argv.slice(2);
if (!['search', 'fetch', 'code'].includes(operation) || !value) {
  throw new Error(
    'Usage: npm run grounding:retrieve -- <search|fetch|code> "<query or Learn URL>" [output.json]',
  );
}
if (operation === 'fetch') {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'learn.microsoft.com' ||
    url.username ||
    url.password
  ) {
    throw new Error(
      'Only HTTPS documentation on learn.microsoft.com is permitted.',
    );
  }
}
const client = new Client({
  name: 'fabric-challenge-maintainer',
  version: '1.0.0',
});
try {
  await client.connect(
    new StreamableHTTPClientTransport(
      new URL('https://learn.microsoft.com/api/mcp'),
    ),
  );
  const { tools } = await client.listTools();
  const name = {
    search: 'microsoft_docs_search',
    fetch: 'microsoft_docs_fetch',
    code: 'microsoft_code_sample_search',
  }[operation];
  if (!tools.some((tool) => tool.name === name))
    throw new Error(`MCP no longer advertises ${name}; review the client.`);
  const result = await client.callTool({
    name,
    arguments: operation === 'fetch' ? { url: value } : { query: value },
  });
  if (result.isError) throw new Error(JSON.stringify(result));
  const record = {
    retrievedAt: new Date().toISOString(),
    endpoint: 'https://learn.microsoft.com/api/mcp',
    tool: name,
    input: value,
    result,
  };
  if (output) {
    const path = resolve(output);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, {
      flag: 'wx',
    });
    console.log(`Saved actual MCP response to ${path}`);
  } else {
    console.log(JSON.stringify(record, null, 2));
  }
} finally {
  await client.close();
}
