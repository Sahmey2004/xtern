"""
Agent 1: Demand Analyst
- Reads inventory positions and demand forecasts via MCP
- Calculates net replenishment need per SKU
- Flags urgency (critical / normal)
- Writes decision log
"""
import uuid
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


def demand_analyst_node(state: PipelineState) -> PipelineState:
    """LangGraph node: calculates net requirements for each SKU."""
    run_id = state.get('run_id', str(uuid.uuid4()))
    skus_requested = state.get('skus_to_plan', [])
    horizon = state.get('planning_horizon_months', 3)

    # ── Step 1: Pull inventory ────────────────────────────────
    inv_args: dict = {}
    if skus_requested:
        inv_args['skus'] = skus_requested
    else:
        inv_args['below_reorder_only'] = True

    inv_data = call_mcp_tool('erp', 'get_inventory', inv_args)
    inventory = inv_data.get('inventory', [])

    if not inventory:
        return {**state, 'error': 'No inventory records found — run seed_data.py first', 'current_agent': 'demand_analyst'}

    skus = [r['sku'] for r in inventory]

    # ── Step 2: Pull forecasts ────────────────────────────────
    forecast_data = call_mcp_tool('erp', 'get_forecasts', {
        'skus': skus,
        'months_ahead': horizon,
    })
    forecast_summary = forecast_data.get('summary_by_sku', [])
    forecast_by_sku = {f['sku']: f['total_forecast'] for f in forecast_summary}

    # ── Step 3: Calculate net requirements ───────────────────
    net_requirements = []
    for inv in inventory:
        sku = inv['sku']
        available = inv['current_stock'] + inv['in_transit']
        safety = inv['safety_stock']
        forecast = forecast_by_sku.get(sku, 0)

        # Net need = forecast + safety - available (min 0)
        net_qty = max(0, forecast + safety - available)

        # Apply MOQ floor from product data
        product_info = inv.get('products') or {}
        moq = product_info.get('moq', 1) if isinstance(product_info, dict) else 1
        if net_qty > 0 and net_qty < moq:
            net_qty = moq  # round up to MOQ

        urgency = 'critical' if inv['current_stock'] <= inv['safety_stock'] else 'normal'

        if net_qty > 0:
            net_requirements.append({
                'sku': sku,
                'net_qty': net_qty,
                'current_stock': inv['current_stock'],
                'in_transit': inv['in_transit'],
                'safety_stock': inv['safety_stock'],
                'forecast_demand': forecast,
                'urgency': urgency,
                'moq': moq,
            })

    # ── Step 4: LLM validation and rationale ─────────────────
    llm = get_llm()
    prompt = f"""You are a demand planning analyst. Review these net replenishment calculations and provide a brief rationale and confidence score.

Net Requirements (top 5 shown):
{json.dumps(net_requirements[:5], indent=2)}

Total SKUs needing replenishment: {len(net_requirements)}
Planning horizon: {horizon} months

Respond in JSON format ONLY:
{{"rationale": "...", "confidence": 0.0_to_1.0, "flags": ["any concerns"]}}"""

    try:
        response = llm.invoke([SystemMessage(content='You are a supply chain analyst. Respond only with valid JSON.'), HumanMessage(content=prompt)])
        parsed = json.loads(response.content.strip().strip('```json').strip('```'))
        rationale = parsed.get('rationale', 'Demand calculated from forecast minus available stock.')
        confidence = float(parsed.get('confidence', 0.85))
    except Exception:
        rationale = f'Net requirements calculated: {len(net_requirements)} SKUs need replenishment across {horizon}-month horizon.'
        confidence = 0.85

    # ── Step 5: Log decision ──────────────────────────────────
    call_mcp_tool('po', 'log_decision', {
        'run_id': run_id,
        'agent_name': 'DemandAnalyst',
        'inputs': {'skus_requested': skus_requested, 'horizon_months': horizon, 'inventory_count': len(inventory)},
        'output': {'net_requirements_count': len(net_requirements), 'skus': [r['sku'] for r in net_requirements]},
        'confidence': confidence,
        'rationale': rationale,
    })

    return {
        **state,
        'run_id': run_id,
        'inventory_snapshot': inventory,
        'forecast_summary': forecast_summary,
        'net_requirements': net_requirements,
        'skus_to_plan': skus,
        'demand_rationale': rationale,
        'demand_confidence': confidence,
        'current_agent': 'demand_analyst',
        'error': None,
    }
