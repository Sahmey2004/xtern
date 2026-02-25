"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const server = new mcp_js_1.McpServer({
    name: 'erp-data-server', // CHANGE for each server
    version: '0.1.0',
});
// Health check / ping tool
server.tool('ping', 'Health check - returns server name and timestamp', {}, // no input parameters
async () => {
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({
                    server: 'erp-data-server', // CHANGE for each server
                    status: 'ok',
                    timestamp: new Date().toISOString(),
                })
            }]
    };
});
// Start the server
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error('ERP Data Server running on stdio'); // CHANGE for each server
}
main().catch(console.error);
