# test-mcp.sh (create in project root)
#!/bin/bash
# Usage: ./test-mcp.sh mcp-servers/erp-data-server

SERVER_DIR=$1

# Send initialize + tool call via stdin
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"0.1.0"}}}'
echo '{"jsonrpc":"2.0","method":"notifications/initialized"}'
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"ping","arguments":{}}}'
