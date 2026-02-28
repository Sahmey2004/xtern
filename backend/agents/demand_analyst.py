"""
Agent 1: Demand Analyst
- Reads inventory positions and demand forecasts via MCP
- Calculates net replenishment need per SKU
- Flags urgency (critical / normal)
- Writes decision log
"""
import uuid
import json
from langchain_core.messages import SystemMessage, HumanMessage
from agents.llm_config import get_llm, update_agent_activity
from mcp_client.client import call_mcp_tool
from graph.state import PipelineState


def demand_analyst_node(state: PipelineState) -> PipelineState:
    """LangGraph node: calculates net requirements for each SKU."""
    agent_name = 'DemandAnalyst'
    run_id = state.get('run_id', str(uuid.uuid4()))
    skus_requested = state.get('skus_to_plan', [])
    horizon = state.get('planning_horizon_months', 3)

    # ── Step 1: Pull inventory ────────────────────────────────
    inv_args: dict = {}
    if skus_requested:
        inv_args['skus'] = skus_requested
    else:
        inv_args['below_reorder_only'] = True

    try:
        inv_data = call_mcp_tool('erp', 'get_inventory', inv_args)
    except Exception as exc:
        error_message = f'{agent_name} could not load inventory data: {exc}'
        return {
            **state,
            'run_id': run_id,
            'current_agent': 'demand_analyst',
            'error': error_message,
            'agent_activity': update_agent_activity(
                state,
                agent_name,
                status='failed',
                summary=error_message,
                details={'requested_skus': skus_requested, 'horizon_months': horizon},
            ),
        }
    inventory = inv_data.get('inventory', [])

    if not inventory:
        error_message = 'No inventory records found — run seed_data.py first'
        return {
            **state,
            'error': error_message,
            'current_agent': 'demand_analyst',
            'agent_activity': update_agent_activity(
                state,
                agent_name,
                status='failed',
                summary=error_message,
                details={'inventory_count': 0, 'requested_skus': skus_requested, 'horizon_months': horizon},
            ),
        }

    skus = [r['sku'] for r in inventory]

    # ── Step 2: Pull forecasts ────────────────────────────────
    try:
        forecast_data = call_mcp_tool('erp', 'get_forecasts', {
            'skus': skus,
            'months_ahead': horizon,
        })
    except Exception as exc:
        error_message = f'{agent_name} could not load forecast data: {exc}'
        return {
            **state,
            'run_id': run_id,
            'inventory_snapshot': inventory,
            'skus_to_plan': skus,
            'current_agent': 'demand_analyst',
            'error': error_message,
            'agent_activity': update_agent_activity(
                state,
                agent_name,
                status='failed',
                summary=error_message,
                details={'inventory_count': len(inventory), 'horizon_months': horizon},
            ),
        }
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
    prompt = f"""You are a demand planning analyst. Review these net replenishment calculations and provide a brief rationale and confidence score.

Net Requirements (top 5 shown):
{json.dumps(net_requirements[:5], indent=2)}

Total SKUs needing replenishment: {len(net_requirements)}
Planning horizon: {horizon} months

Respond in JSON format ONLY:
{{"rationale": "...", "confidence": 0.0_to_1.0, "flags": ["any concerns"]}}"""
    llm_error = None
    llm_used = False
    try:
        llm = get_llm(max_tokens=1024, temperature=0.1)
        response = llm.invoke([SystemMessage(content='You are a supply chain analyst. Respond only with valid JSON.'), HumanMessage(content=prompt)])
        llm_used = True
    except RuntimeError as exc:
        error_message = f'{agent_name} could not reach OpenRouter: {exc}'
        return {
            **state,
            'run_id': run_id,
            'inventory_snapshot': inventory,
            'forecast_summary': forecast_summary,
            'net_requirements': net_requirements,
            'skus_to_plan': skus,
            'current_agent': 'demand_analyst',
            'error': error_message,
            'agent_activity': update_agent_activity(
                state,
                agent_name,
                status='failed',
                summary=error_message,
                llm_error=str(exc),
                details={
                    'inventory_count': len(inventory),
                    'net_requirements_count': len(net_requirements),
                    'horizon_months': horizon,
                },
            ),
        }
    except Exception as exc:
        error_message = f'{agent_name} OpenRouter request failed: {exc}'
        return {
            **state,
            'run_id': run_id,
            'inventory_snapshot': inventory,
            'forecast_summary': forecast_summary,
            'net_requirements': net_requirements,
            'skus_to_plan': skus,
            'current_agent': 'demand_analyst',
            'error': error_message,
            'agent_activity': update_agent_activity(
                state,
                agent_name,
                status='failed',
                summary=error_message,
                llm_error=str(exc),
                details={
                    'inventory_count': len(inventory),
                    'net_requirements_count': len(net_requirements),
                    'horizon_months': horizon,
                },
            ),
        }

    try:
        parsed = json.loads(response.content.strip().strip('```json').strip('```'))
        rationale = parsed.get('rationale', 'Demand calculated from forecast minus available stock.')
        confidence = float(parsed.get('confidence', 0.85))
    except Exception as exc:
        llm_error = f'OpenRouter response parse failed: {exc}'
        rationale = f'Net requirements calculated: {len(net_requirements)} SKUs need replenishment across {horizon}-month horizon.'
        confidence = 0.85

    # ── Step 5: Log decision ──────────────────────────────────
    call_mcp_tool('po', 'log_decision', {
        'run_id': run_id,
        'agent_name': agent_name,
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
        'agent_activity': update_agent_activity(
            state,
            agent_name,
            status='completed',
            summary=rationale,
            confidence=confidence,
            llm_used=llm_used,
            llm_error=llm_error,
            details={
                'inventory_count': len(inventory),
                'net_requirements_count': len(net_requirements),
                'sample_skus': [r['sku'] for r in net_requirements[:5]],
                'horizon_months': horizon,
            },
        ),
    }
