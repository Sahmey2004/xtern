import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'po-management-server',       // CHANGE for each server
  version: '0.1.0',
});

// Health check / ping tool
server.tool(
  'ping',
  'Health check - returns server name and timestamp',
  {},  // no input parameters
  async () => {
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          server: 'po-management-server',  // CHANGE for each server
          status: 'ok',
          timestamp: new Date().toISOString(),
        })
      }]
    };
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('PO Management Server running on stdio');  // CHANGE for each server
}

main().catch(console.error);
