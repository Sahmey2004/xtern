"""
Agent 3: Container Optimizer
- Fetches product dimensions for all ordered SKUs
- Calls logistics MCP server to calculate optimal container plan
- Outputs TEU count, utilisation %, estimated freight cost
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
        max_tokens=512,
        temperature=0.1,
        default_headers={
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'Supply Chain PO Automation',
        }
    )


def container_optimizer_node(state: PipelineState) -> PipelineState:
    """LangGraph node: calculates container plan for the order."""
    run_id = state.get('run_id', 'unknown')
    supplier_selections = state.get('supplier_selections', [])

    valid_selections = [s for s in supplier_selections if s.get('supplier_id')]
    if not valid_selections:
        return {**state, 'error': 'No valid supplier selections for container planning', 'current_agent': 'container_optimizer'}

    # ── Fetch product dimensions ──────────────────────────────
    skus = [s['sku'] for s in valid_selections]
    product_data = call_mcp_tool('erp', 'get_products', {'skus': skus})
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
    container_result = call_mcp_tool('logistics', 'calculate_container_plan', {
        'line_items': line_items,
        'preferred_container_type': 'auto',
    })
    container_plan = container_result.get('recommended_plan', {})

    # ── LLM rationale ─────────────────────────────────────────
    llm = get_llm()
    prompt = f"""Container plan result:
- Container type: {container_plan.get('container_type')}
- Count: {container_plan.get('num_containers')}
- Volume utilisation: {container_plan.get('volume_utilisation_pct')}%
- Weight utilisation: {container_plan.get('weight_utilisation_pct')}%
- Estimated freight: ${container_plan.get('estimated_freight_usd', 0):,.0f}

Write a one-sentence rationale and confidence score. JSON only:
{{"rationale": "...", "confidence": 0.0_to_1.0}}"""

    try:
        response = llm.invoke([SystemMessage(content='Respond only with valid JSON.'), HumanMessage(content=prompt)])
        parsed = json.loads(response.content.strip().strip('```json').strip('```'))
        rationale = parsed.get('rationale', '')
        confidence = float(parsed.get('confidence', 0.88))
    except Exception:
        util = container_plan.get('binding_utilisation_pct', 0)
        rationale = f"{container_plan.get('num_containers', 1)}x {container_plan.get('container_type', '40ft')} container(s) at {util:.0f}% utilisation, est. ${container_plan.get('estimated_freight_usd', 0):,.0f} freight."
        confidence = 0.88

    call_mcp_tool('po', 'log_decision', {
        'run_id': run_id,
        'agent_name': 'ContainerOptimizer',
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
    }
