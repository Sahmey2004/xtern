#!/bin/bash
# test.sh - Test erp-data-server tools

INIT='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
NOTIF='{"jsonrpc":"2.0","method":"notifications/initialized"}'
T1='{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_products","arguments":{}}}'
T2='{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_products","arguments":{"category":"filters"}}}'
T3='{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"get_inventory","arguments":{"sku":"FLT-001"}}}'
T4='{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"get_forecasts","arguments":{"sku":"FLT-001"}}}'

(echo "$INIT"; echo "$NOTIF"; echo "$T1"; echo "$T2"; echo "$T3"; echo "$T4") | node dist/index.js 2>/dev/null