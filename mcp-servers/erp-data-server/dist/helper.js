"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonResponse = jsonResponse;
exports.errorResponse = errorResponse;
function jsonResponse(data) {
    return {
        content: [{
                type: 'text',
                text: JSON.stringify(data, null, 2),
            }],
    };
}
function errorResponse(message) {
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({ error: message }),
            }],
        isError: true,
    };
}
