"""
Agent 4: PO Compiler
- Assembles final draft PO from all prior agent outputs
- Writes to Supabase via po-management MCP server
- Produces human-readable summary
"""
import json
import os
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from mcp_client.client import call_mcp_tool
from graph.state import PipelineState


def get_llm():
    return ChatOpenAI(
        model='meta-llama/llama-3.1-8b-instruct:free',
        openai_api_key=os.getenv('OPENROUTER_API_KEY'),
        openai_api_base='https://openrouter.ai/api/v1',
        max_tokens=1024,
        temperature=0.1,
        default_headers={
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'Supply Chain PO Automation',
        }
    )


def po_compiler_node(state: PipelineState) -> PipelineState:
    """LangGraph node: compiles and saves draft PO."""
    run_id = state.get('run_id', 'unknown')
    order_line_items = state.get('order_line_items', [])
    container_plan = state.get('container_plan', {})
    triggered_by = state.get('triggered_by', 'system')

    if not order_line_items:
        return {**state, 'error': 'No order line items to compile', 'current_agent': 'po_compiler'}

    # Format line items for MCP create_draft_po
    po_lines = [
        {
            'sku': item['sku'],
            'supplier_id': item['supplier_id'],
            'qty_ordered': item['qty'],
            'unit_price': item['unit_price'],
            'rationale': item.get('rationale', ''),
        }
        for item in order_line_items
    ]

    # Calculate totals
    subtotal = sum(l['qty_ordered'] * l['unit_price'] for l in po_lines)
    freight = container_plan.get('estimated_freight_usd', 0) if container_plan else 0
    total_usd = subtotal + freight

    # LLM summary note
    llm = get_llm()
    summary_prompt = f"""Write a concise executive summary (2-3 sentences) for this purchase order:
- SKUs: {len(po_lines)}
- Subtotal: ${subtotal:,.2f}
- Estimated freight: ${freight:,.0f}
- Total: ${total_usd:,.2f}
- Container: {container_plan.get('num_containers', 1)}x {container_plan.get('container_type', 'N/A')} at {container_plan.get('binding_utilisation_pct', 0):.0f}% utilisation

Output plain text only (no JSON)."""

    try:
        response = llm.invoke([SystemMessage(content='You are a procurement analyst.'), HumanMessage(content=summary_prompt)])
        po_notes = response.content.strip()
    except Exception:
        po_notes = f"Draft PO: {len(po_lines)} SKUs, subtotal ${subtotal:,.2f}, est. freight ${freight:,.0f}, total ${total_usd:,.2f}."

    # Create PO in Supabase
    result = call_mcp_tool('po', 'create_draft_po', {
        'run_id': run_id,
        'created_by': triggered_by,
        'line_items': po_lines,
        'container_plan': container_plan if container_plan else None,
        'notes': po_notes,
    })

    po_number = result.get('po_number')
    if not po_number:
        return {**state, 'error': f"PO creation failed: {result}", 'current_agent': 'po_compiler'}

    rationale = f"Draft PO {po_number} created with {len(po_lines)} line items. Total ${total_usd:,.2f} (freight included). Awaiting planner review."

    call_mcp_tool('po', 'log_decision', {
        'run_id': run_id,
        'po_number': po_number,
        'agent_name': 'POCompiler',
        'inputs': {'line_item_count': len(po_lines), 'subtotal_usd': round(subtotal, 2)},
        'output': {'po_number': po_number, 'total_usd': round(total_usd, 2), 'status': 'draft'},
        'confidence': 0.95,
        'rationale': rationale,
    })

    return {
        **state,
        'po_number': po_number,
        'po_total_usd': round(total_usd, 2),
        'po_rationale': rationale,
        'approval_status': 'pending',
        'current_agent': 'po_compiler',
        'error': None,
    }
