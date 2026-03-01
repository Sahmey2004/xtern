"""
Agent 4: PO Compiler
- Assembles final draft PO from all prior agent outputs
- Writes to Supabase via po-management MCP server
- Produces human-readable summary
"""
from langchain_core.messages import SystemMessage, HumanMessage
from agents.llm_config import get_llm, update_agent_activity
from mcp_client.client import call_mcp_tool
from graph.state import PipelineState


def po_compiler_node(state: PipelineState) -> PipelineState:
    """LangGraph node: compiles and saves draft PO."""
    agent_name = 'POCompiler'
    run_id = state.get('run_id', 'unknown')
    order_line_items = state.get('order_line_items', [])
    container_plan = state.get('container_plan', {})
    triggered_by = state.get('triggered_by', 'system')

    if not order_line_items:
        error_message = 'No order line items to compile'
        return {
            **state,
            'error': error_message,
            'current_agent': 'po_compiler',
            'agent_activity': update_agent_activity(
                state,
                agent_name,
                status='failed',
                summary=error_message,
                details={'line_item_count': 0},
            ),
        }

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
    summary_prompt = f"""Write a concise executive summary (2-3 sentences) for this purchase order:
- SKUs: {len(po_lines)}
- Subtotal: ${subtotal:,.2f}
- Estimated freight: ${freight:,.0f}
- Total: ${total_usd:,.2f}
- Container: {container_plan.get('num_containers', 1)}x {container_plan.get('container_type', 'N/A')} at {container_plan.get('binding_utilisation_pct', 0):.0f}% utilisation

Output plain text only (no JSON)."""
    llm_error = None
    llm_used = False
    try:
        llm = get_llm(max_tokens=1024, temperature=0.1)
        response = llm.invoke([SystemMessage(content='You are a procurement analyst.'), HumanMessage(content=summary_prompt)])
        po_notes = response.content.strip()
        llm_used = True
    except RuntimeError as exc:
        error_message = f'{agent_name} could not reach OpenRouter: {exc}'
        return {
            **state,
            'current_agent': 'po_compiler',
            'error': error_message,
            'agent_activity': update_agent_activity(
                state,
                agent_name,
                status='failed',
                summary=error_message,
                llm_error=str(exc),
                details={'line_item_count': len(po_lines), 'subtotal_usd': round(subtotal, 2)},
            ),
        }
    except Exception as exc:
        llm_error = f'OpenRouter request failed: {exc}'
        po_notes = f"Draft PO: {len(po_lines)} SKUs, subtotal ${subtotal:,.2f}, est. freight ${freight:,.0f}, total ${total_usd:,.2f}."

    # Create PO in Supabase
    try:
        result = call_mcp_tool('po', 'create_draft_po', {
            'run_id': run_id,
            'created_by': triggered_by,
            'line_items': po_lines,
            'container_plan': container_plan if container_plan else None,
            'notes': po_notes,
        })
    except Exception as exc:
        error_message = f'{agent_name} could not create the draft PO: {exc}'
        return {
            **state,
            'current_agent': 'po_compiler',
            'error': error_message,
            'agent_activity': update_agent_activity(
                state,
                agent_name,
                status='failed',
                summary=error_message,
                llm_used=llm_used,
                llm_error=llm_error,
                details={'line_item_count': len(po_lines), 'subtotal_usd': round(subtotal, 2)},
            ),
        }

    po_number = result.get('po_number')
    if not po_number:
        error_message = f"PO creation failed: {result}"
        return {
            **state,
            'error': error_message,
            'current_agent': 'po_compiler',
            'agent_activity': update_agent_activity(
                state,
                agent_name,
                status='failed',
                summary=error_message,
                llm_used=llm_used,
                llm_error=llm_error,
                details={'line_item_count': len(po_lines), 'subtotal_usd': round(subtotal, 2)},
            ),
        }

    rationale = f"Draft PO {po_number} created with {len(po_lines)} line items. Total ${total_usd:,.2f} (freight included). Awaiting planner review."

    call_mcp_tool('po', 'log_decision', {
        'run_id': run_id,
        'po_number': po_number,
        'agent_name': agent_name,
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
        'agent_activity': update_agent_activity(
            state,
            agent_name,
            status='completed',
            summary=rationale,
            confidence=0.95,
            llm_used=llm_used,
            llm_error=llm_error,
            details={
                'po_number': po_number,
                'line_item_count': len(po_lines),
                'subtotal_usd': round(subtotal, 2),
                'freight_usd': round(freight, 2),
                'total_usd': round(total_usd, 2),
            },
        ),
    }
