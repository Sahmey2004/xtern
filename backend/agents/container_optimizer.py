"""
Agent 3: Container Optimizer
- Fetches product dimensions for all ordered SKUs
- Calls logistics MCP server to calculate optimal container plan
- Outputs TEU count, utilisation %, estimated freight cost
"""
import json
from langchain_core.messages import SystemMessage, HumanMessage
from agents.llm_config import get_llm, update_agent_activity
from mcp_client.client import call_mcp_tool
from graph.state import PipelineState


def container_optimizer_node(state: PipelineState) -> PipelineState:
    """LangGraph node: calculates container plan for the order."""
    agent_name = 'ContainerOptimizer'
    run_id = state.get('run_id', 'unknown')
    supplier_selections = state.get('supplier_selections', [])

    valid_selections = [s for s in supplier_selections if s.get('supplier_id')]
    if not valid_selections:
        error_message = 'No valid supplier selections for container planning'
        return {
            **state,
            'error': error_message,
            'current_agent': 'container_optimizer',
            'agent_activity': update_agent_activity(
                state,
                agent_name,
                status='failed',
                summary=error_message,
                details={'supplier_selection_count': len(supplier_selections)},
            ),
        }

    # ── Fetch product dimensions ──────────────────────────────
    skus = [s['sku'] for s in valid_selections]
    try:
        product_data = call_mcp_tool('erp', 'get_products', {'skus': skus})
    except Exception as exc:
        error_message = f'{agent_name} could not load product dimensions: {exc}'
        return {
            **state,
            'current_agent': 'container_optimizer',
            'error': error_message,
            'agent_activity': update_agent_activity(
                state,
                agent_name,
                status='failed',
                summary=error_message,
                details={'sku_count': len(skus)},
            ),
        }
    products_by_sku = {p['sku']: p for p in product_data.get('products', [])}

    # ── Build line items with physical dimensions ──────────────
    line_items = []
    order_line_items = []

    for sel in valid_selections:
        sku = sel['sku']
        prod = products_by_sku.get(sku, {})
        qty = sel['net_qty']
        unit_price = sel['unit_price']

        line_items.append({
            'sku': sku,
            'qty': qty,
            'unit_weight_kg': prod.get('unit_weight_kg', 1.0),
            'unit_cbm': prod.get('unit_cbm', 0.01),
        })
        order_line_items.append({
            'sku': sku,
            'supplier_id': sel['supplier_id'],
            'qty': qty,
            'unit_price': unit_price,
            'rationale': sel.get('rationale', ''),
        })

    # ── Calculate container plan ──────────────────────────────
    try:
        container_result = call_mcp_tool('logistics', 'calculate_container_plan', {
            'line_items': line_items,
            'preferred_container_type': 'auto',
        })
    except Exception as exc:
        error_message = f'{agent_name} could not calculate a container plan: {exc}'
        return {
            **state,
            'order_line_items': order_line_items,
            'current_agent': 'container_optimizer',
            'error': error_message,
            'agent_activity': update_agent_activity(
                state,
                agent_name,
                status='failed',
                summary=error_message,
                details={'sku_count': len(line_items)},
            ),
        }
    container_plan = container_result.get('recommended_plan', {})

    # ── LLM rationale ─────────────────────────────────────────
    prompt = f"""Container plan result:
- Container type: {container_plan.get('container_type')}
- Count: {container_plan.get('num_containers')}
- Volume utilisation: {container_plan.get('volume_utilisation_pct')}%
- Weight utilisation: {container_plan.get('weight_utilisation_pct')}%
- Estimated freight: ${container_plan.get('estimated_freight_usd', 0):,.0f}

Write a one-sentence rationale and confidence score. JSON only:
{{"rationale": "...", "confidence": 0.0_to_1.0}}"""
    llm_error = None
    llm_used = False
    try:
        llm = get_llm(max_tokens=512, temperature=0.1)
        response = llm.invoke([SystemMessage(content='Respond only with valid JSON.'), HumanMessage(content=prompt)])
        llm_used = True
    except RuntimeError as exc:
        error_message = f'{agent_name} could not reach OpenRouter: {exc}'
        return {
            **state,
            'order_line_items': order_line_items,
            'container_plan': container_plan,
            'current_agent': 'container_optimizer',
            'error': error_message,
            'agent_activity': update_agent_activity(
                state,
                agent_name,
                status='failed',
                summary=error_message,
                llm_error=str(exc),
                details={'sku_count': len(line_items), 'container_plan': container_plan},
            ),
        }
    except Exception as exc:
        error_message = f'{agent_name} OpenRouter request failed: {exc}'
        return {
            **state,
            'order_line_items': order_line_items,
            'container_plan': container_plan,
            'current_agent': 'container_optimizer',
            'error': error_message,
            'agent_activity': update_agent_activity(
                state,
                agent_name,
                status='failed',
                summary=error_message,
                llm_error=str(exc),
                details={'sku_count': len(line_items), 'container_plan': container_plan},
            ),
        }

    try:
        parsed = json.loads(response.content.strip().strip('```json').strip('```'))
        rationale = parsed.get('rationale', '')
        confidence = float(parsed.get('confidence', 0.88))
    except Exception as exc:
        llm_error = f'OpenRouter response parse failed: {exc}'
        util = container_plan.get('binding_utilisation_pct', 0)
        rationale = f"{container_plan.get('num_containers', 1)}x {container_plan.get('container_type', '40ft')} container(s) at {util:.0f}% utilisation, est. ${container_plan.get('estimated_freight_usd', 0):,.0f} freight."
        confidence = 0.88

    call_mcp_tool('po', 'log_decision', {
        'run_id': run_id,
        'agent_name': agent_name,
        'inputs': {'sku_count': len(line_items), 'total_cbm': container_result.get('total_cbm')},
        'output': container_plan,
        'confidence': confidence,
        'rationale': rationale,
    })

    return {
        **state,
        'order_line_items': order_line_items,
        'container_plan': container_plan,
        'container_rationale': rationale,
        'container_confidence': confidence,
        'current_agent': 'container_optimizer',
        'error': None,
        'agent_activity': update_agent_activity(
            state,
            agent_name,
            status='completed',
            summary=rationale,
            confidence=confidence,
            llm_used=llm_used,
            llm_error=llm_error,
            details={
                'sku_count': len(line_items),
                'container_type': container_plan.get('container_type'),
                'num_containers': container_plan.get('num_containers'),
                'binding_utilisation_pct': container_plan.get('binding_utilisation_pct'),
                'estimated_freight_usd': container_plan.get('estimated_freight_usd'),
            },
        ),
    }
