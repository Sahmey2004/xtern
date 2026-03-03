"""
MCP Client — calls MCP servers via subprocess (stdio transport).
Agents import this to read/write data through MCP tools.
"""
import json
import subprocess
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent

MCP_SERVERS = {
    'erp':      PROJECT_ROOT / 'mcp-servers' / 'erp-data-server',
    'supplier': PROJECT_ROOT / 'mcp-servers' / 'supplier-data-server',
    'logistics': PROJECT_ROOT / 'mcp-servers' / 'logistics-server',
    'po':       PROJECT_ROOT / 'mcp-servers' / 'po-management-server',
}


def call_mcp_tool(server_key: str, tool_name: str, arguments: dict) -> dict:
    """
    Invokes a tool on an MCP server via stdio JSON-RPC.
    Returns the parsed tool result as a dict.
    """
    server_dir = MCP_SERVERS[server_key]
    dist_path = server_dir / 'dist' / 'index.js'

    if not dist_path.exists():
        raise FileNotFoundError(f"MCP server not built: {dist_path}. Run 'npm run build' in {server_dir}")

    # JSON-RPC messages: initialize → initialized notification → tools/call
    messages = [
        json.dumps({"jsonrpc": "2.0", "id": 1, "method": "initialize",
                    "params": {"protocolVersion": "2025-03-26", "capabilities": {},
                               "clientInfo": {"name": "python-mcp-client", "version": "1.0.0"}}}),
        json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}),
        json.dumps({"jsonrpc": "2.0", "id": 2, "method": "tools/call",
                    "params": {"name": tool_name, "arguments": arguments}}),
    ]
    stdin_data = '\n'.join(messages) + '\n'

    result = subprocess.run(
        ['node', str(dist_path)],
        input=stdin_data,
        capture_output=True,
        text=True,
        timeout=30,
        cwd=str(server_dir),
    )

    if result.returncode != 0:
        raise RuntimeError(f"MCP server '{server_key}' exited {result.returncode}: {result.stderr}")

    # Parse the last JSON-RPC response (id: 2)
    stdout_lines = result.stdout.strip().split('\n')
    for line in stdout_lines:
        try:
            msg = json.loads(line)
            if msg.get('id') == 2:
                if 'error' in msg:
                    raise RuntimeError(f"MCP tool '{tool_name}' error: {msg['error']}")
                result_obj = msg.get('result', {})
                if 'isError' in result_obj and result_obj['isError']:
                    # Handle application-level errors (like my log_decision failure)
                    error_msg = result_obj.get('content', [{}])[0].get('text', 'Unknown tool error')
                    raise RuntimeError(f"MCP tool '{tool_name}' failed: {error_msg}")
                    
                content = result_obj.get('content', [])
                if content and content[0].get('type') == 'text':
                    return json.loads(content[0]['text'])
        except json.JSONDecodeError:
            continue

    print(f"DEBUG: MCP Server '{server_key}' stdout:\n{result.stdout}")
    print(f"DEBUG: MCP Server '{server_key}' stderr:\n{result.stderr}")
    raise RuntimeError(f"No valid response from MCP server '{server_key}' for tool '{tool_name}'")
