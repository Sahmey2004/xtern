// mcp-servers/logistics-server/src/helpers.ts
export function jsonResponse(data) {
    return {
        content: [{
                type: 'text',
                text: JSON.stringify(data, null, 2),
            }],
    };
}
export function errorResponse(message) {
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({ error: message }),
            }],
        isError: true,
    };
}
