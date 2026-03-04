"""
Agent 1: Demand Analyst
- Reads inventory positions and demand forecasts via MCP
- Calculates net replenishment need per SKU
- Flags urgency: critical / watch / normal (3-level)
- Checks for open POs per SKU
- Estimates need-by date and sales delta
- Writes decision log
"""
import uuid
import json
from datetime import datetime, timedelta
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

    # ── Step 2: Pull forecasts (current + historical for sales delta) ──
    try:
        forecast_data = call_mcp_tool('erp', 'get_forecasts', {
            'skus': skus,
            'months_ahead': horizon,
            'include_historical': True,
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
    all_forecasts = forecast_data.get('forecasts', [])

    # Forward-looking totals by SKU
    today = datetime.now().date()
    current_month_str = today.replace(day=1).isoformat()
    forecast_by_sku = {f['sku']: f['total_forecast'] for f in forecast_summary}

    # Historical actuals by SKU for sales delta
    historical_by_sku: dict = {}
    for row in all_forecasts:
        if row.get('period', '') < current_month_str and row.get('actual_qty') is not None:
            sku = row['sku']
            if sku not in historical_by_sku:
                historical_by_sku[sku] = []
            historical_by_sku[sku].append({'period': row['period'], 'actual_qty': row['actual_qty']})

    # ── Step 3: Check for open POs per SKU ───────────────────
    open_po_by_sku: dict = {}
    open_po_check_error: str | None = None
    try:
        pos_data = call_mcp_tool('po', 'get_pos', {'status': 'all', 'limit': 50})
        for po in pos_data.get('purchase_orders', []):
            if po.get('status') in ('draft', 'pending_approval'):
                for line in po.get('po_line_items', []):
                    sku = line.get('sku')
                    if sku:
                        if sku not in open_po_by_sku:
                            open_po_by_sku[sku] = {'count': 0, 'qty': 0}
                        open_po_by_sku[sku]['count'] += 1
                        open_po_by_sku[sku]['qty'] += line.get('qty_ordered', 0)
    except Exception as exc:
        open_po_check_error = str(exc)  # record but don't fail pipeline

    # ── Step 4: Calculate net requirements ───────────────────
    net_requirements = []
    for inv in inventory:
        sku = inv['sku']
        available = inv['current_stock'] + inv['in_transit']
        safety = inv['safety_stock']
        reorder_point = inv.get('reorder_point', safety)
        forecast = forecast_by_sku.get(sku, 0)

        # Open PO info — looked up first so it can be deducted from net need
        open_info = open_po_by_sku.get(sku, {'count': 0, 'qty': 0})
        uf_qty_in = inv['in_transit'] + open_info['qty']

        # Net need = forecast + safety - available - already_ordered (min 0)
        # Deducting open_po_qty prevents re-ordering what's already been ordered but not yet shipped
        net_qty = max(0, forecast + safety - available - open_info['qty'])

        # Apply MOQ floor from product data
        product_info = inv.get('products') or {}
        moq = product_info.get('moq', 1) if isinstance(product_info, dict) else 1
        final_order_qty = net_qty
        if final_order_qty > 0 and final_order_qty < moq:
            final_order_qty = moq  # round up to MOQ

        # 3-level urgency
        if inv['current_stock'] <= safety:
            urgency = 'critical'
        elif inv['current_stock'] <= reorder_point:
            urgency = 'watch'
        else:
            urgency = 'normal'

        # Need-by date: estimate days until stockout
        monthly_demand = forecast / horizon if horizon > 0 and forecast > 0 else 0
        if monthly_demand > 0:
            days_of_stock = int(inv['current_stock'] / (monthly_demand / 30))
            need_by_date = (today + timedelta(days=max(0, days_of_stock))).strftime('%b %d, %Y')
        else:
            need_by_date = 'N/A'

        # Sales delta: compare last 3 months actuals vs prior 3 months
        sales_delta_pct = None
        history = sorted(historical_by_sku.get(sku, []), key=lambda x: x['period'], reverse=True)
        if len(history) >= 6:
            recent_actual = sum(h['actual_qty'] for h in history[:3])
            prior_actual = sum(h['actual_qty'] for h in history[3:6])
            if prior_actual > 0:
                sales_delta_pct = round(((recent_actual - prior_actual) / prior_actual) * 100, 1)
        elif len(history) >= 2:
            recent_actual = history[0]['actual_qty']
            prior_actual = history[-1]['actual_qty']
            if prior_actual > 0:
                sales_delta_pct = round(((recent_actual - prior_actual) / prior_actual) * 100, 1)

        if final_order_qty > 0:
            net_requirements.append({
                'sku': sku,
                'net_qty': net_qty,
                'current_stock': inv['current_stock'],
                'in_transit': inv['in_transit'],
                'safety_stock': safety,
                'forecast_demand': forecast,
                'urgency': urgency,
                'moq': moq,
                'final_order_qty': final_order_qty,
                'uf_qty_in': uf_qty_in,
                'open_po_count': open_info['count'],
                'open_po_qty': open_info['qty'],
                'need_by_date': need_by_date,
                'sales_delta_pct': sales_delta_pct,
            })

    # ── Step 5: LLM validation and rationale ─────────────────
    sample_reqs_json = json.dumps(
        [{'sku': r['sku'], 'urgency': r['urgency'], 'net_qty': r['net_qty'], 'need_by': r['need_by_date']}
         for r in net_requirements[:5]],
        indent=2
    )
    prompt = f"""You are a demand planning analyst. Review these net replenishment calculations and provide a concise one-line summary and confidence score. No paragraphs.

Net Requirements ({len(net_requirements)} SKUs needing replenishment):
{sample_reqs_json}

Planning horizon: {horizon} months

Respond in JSON ONLY (one-line rationale, no paragraphs):
{{"rationale": "...", "confidence": 0.0_to_1.0, "flags": ["any concerns"]}}"""
    llm_error = None
    llm_used = False
    try:
        llm = get_llm(max_tokens=512, temperature=0.1)
        response = llm.invoke([SystemMessage(content='You are a supply chain analyst. Respond only with valid JSON.'), HumanMessage(content=prompt)])
        llm_used = True
    except RuntimeError as exc:
        error_message = f'{agent_name} could not reach OpenAI: {exc}'
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
        error_message = f'{agent_name} OpenAI request failed: {exc}'
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
        raw = response.content.strip()
        if raw.startswith('```'):
            raw = raw.split('\n', 1)[-1]
            raw = raw.rsplit('```', 1)[0].strip()
        parsed = json.loads(raw)
        rationale = parsed.get('rationale', 'Demand calculated from forecast minus available stock.')
        confidence = float(parsed.get('confidence', 0.85))
    except Exception as exc:
        llm_error = f'OpenAI response parse failed: {exc}'
        critical_count = sum(1 for r in net_requirements if r['urgency'] == 'critical')
        rationale = f'{len(net_requirements)} SKUs need replenishment across {horizon}-month horizon. {critical_count} critical.'
        confidence = 0.85

    # ── Step 6: Log decision ──────────────────────────────────
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
                'open_po_skus_deducted': list(open_po_by_sku.keys()),
                'open_po_check_error': open_po_check_error,
            },
        ),
    }
