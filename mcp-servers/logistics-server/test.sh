#!/bin/bash
# test-logistics.sh - Test logistics-server tools

INIT='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
NOTIF='{"jsonrpc":"2.0","method":"notifications/initialized"}'

# Test 1: get_container_specs
T1='{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_container_specs","arguments":{}}}'

# Test 2: Large order - should recommend FCL with >80% utilization
# ~55 CBM, ~18000 kg
T2='{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"calculate_container_fit","arguments":{"items":[{"sku":"ENG-001","quantity":200,"unit_weight_kg":15.0,"unit_cbm":0.15},{"sku":"ENG-002","quantity":150,"unit_weight_kg":20.0,"unit_cbm":0.1},{"sku":"FLT-001","quantity":500,"unit_weight_kg":1.0,"unit_cbm":0.008},{"sku":"ELC-001","quantity":300,"unit_weight_kg":1.5,"unit_cbm":0.015}]}}}'

# Test 3: Small order - should flag <80% and suggest LCL
# ~5 CBM, ~500 kg
T3='{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"calculate_container_fit","arguments":{"items":[{"sku":"GSK-001","quantity":100,"unit_weight_kg":0.3,"unit_cbm":0.003},{"sku":"FLT-002","quantity":50,"unit_weight_kg":0.8,"unit_cbm":0.005}]}}}'

echo "=== Testing logistics-server ==="
echo ""
echo "--- Test 1: get_container_specs ---"
(echo "$INIT"; echo "$NOTIF"; echo "$T1") | node dist/index.js 2>/dev/null
echo ""
echo ""
echo "--- Test 2: Large order (expect FCL, >80% util) ---"
(echo "$INIT"; echo "$NOTIF"; echo "$T2") | node dist/index.js 2>/dev/null
echo ""
echo ""
echo "--- Test 3: Small order (expect LCL flag, <80% util) ---"
(echo "$INIT"; echo "$NOTIF"; echo "$T3") | node dist/index.js 2>/dev/null