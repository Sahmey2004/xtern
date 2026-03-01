"""
Agent 2: Supplier Selector
- Scores and selects the best supplier for each SKU using MCP
- Uses weighted criteria: quality, delivery, lead time, cost
- Writes decision log
"""
import json
from langchain_core.messages import SystemMessage, HumanMessage
from agents.llm_config import get_llm, update_agent_activity
from mcp_client.client import call_mcp_tool
from graph.state import PipelineState


def supplier_selector_node(state: PipelineState) -> PipelineState:
    """LangGraph node: selects best supplier for each SKU."""
    agent_name = 'SupplierSelector'
    run_id = state.get('run_id', 'unknown')
    net_requirements = state.get('net_requirements', [])

    if not net_requirements:
        error_message = 'No net requirements — demand analyst must run first'
        return {
            **state,
            'error': error_message,
            'current_agent': 'supplier_selector',
            'agent_activity': update_agent_activity(
                state,
                agent_name,
                status='failed',
                summary=error_message,
                details={'net_requirements_count': 0},
            ),
        }

    supplier_selections = []
    total_scored = 0

    for req in net_requirements:
        sku = req['sku']
        net_qty = req['net_qty']

        try:
            result = call_mcp_tool('supplier', 'score_suppliers', {
                'sku': sku,
                'order_qty': net_qty,
            })

            ranked = result.get('ranked_suppliers', [])
            recommended = result.get('recommended_supplier', {})

            if recommended:
                supplier_selections.append({
                    'sku': sku,
                    'supplier_id': recommended['supplier_id'],
                    'supplier_name': recommended['supplier_name'],
                    'unit_price': recommended['unit_price'],
                    'score': recommended['score'],
                    'lead_time_days': recommended['lead_time_days'],
                    'net_qty': net_qty,
                    'urgency': req['urgency'],
                    'rationale': (
                        f"Selected {recommended['supplier_name']} (score {recommended['score']}/100): "
                        f"${recommended['unit_price']:.2f}/unit, {recommended['lead_time_days']}d lead time, "
                        f"MOQ fit {recommended.get('moq_fit_pct', 100)}%"
                    ),
                    'all_candidates': ranked[:3],  # keep top 3 for audit
                })
                total_scored += 1
        except Exception as e:
            # Fallback: no supplier found
            supplier_selections.append({
                'sku': sku,
                'supplier_id': None,
                'error': str(e),
                'net_qty': net_qty,
                'urgency': req['urgency'],
            })

    # LLM summary
    prompt = f"""You are a procurement analyst. {total_scored} out of {len(net_requirements)} SKUs have been matched to suppliers.

Sample selections (first 3):
{json.dumps([s for s in supplier_selections[:3] if s.get('supplier_id')], indent=2)}

Provide a brief procurement summary and confidence score in JSON:
{{"rationale": "...", "confidence": 0.0_to_1.0}}"""
    llm_error = None
    llm_used = False
    try:
        llm = get_llm(max_tokens=1024, temperature=0.1)
        response = llm.invoke([SystemMessage(content='Respond only with valid JSON.'), HumanMessage(content=prompt)])
        llm_used = True
    except RuntimeError as exc:
        error_message = f'{agent_name} could not reach OpenRouter: {exc}'
        return {
            **state,
            'supplier_selections': supplier_selections,
            'current_agent': 'supplier_selector',
            'error': error_message,
            'agent_activity': update_agent_activity(
                state,
                agent_name,
                status='failed',
                summary=error_message,
                llm_error=str(exc),
                details={'matched_count': total_scored, 'net_requirements_count': len(net_requirements)},
            ),
        }
    except Exception as exc:
        error_message = f'{agent_name} OpenRouter request failed: {exc}'
        return {
            **state,
            'supplier_selections': supplier_selections,
            'current_agent': 'supplier_selector',
            'error': error_message,
            'agent_activity': update_agent_activity(
                state,
                agent_name,
                status='failed',
                summary=error_message,
                llm_error=str(exc),
                details={'matched_count': total_scored, 'net_requirements_count': len(net_requirements)},
            ),
        }

    try:
        parsed = json.loads(response.content.strip().strip('```json').strip('```'))
        rationale = parsed.get('rationale', '')
        confidence = float(parsed.get('confidence', 0.82))
    except Exception as exc:
        llm_error = f'OpenRouter response parse failed: {exc}'
        rationale = f'Supplier selected for {total_scored}/{len(net_requirements)} SKUs using weighted scoring.'
        confidence = 0.82

    call_mcp_tool('po', 'log_decision', {
        'run_id': run_id,
        'agent_name': agent_name,
        'inputs': {'sku_count': len(net_requirements)},
        'output': {'matched_count': total_scored, 'selections': [{'sku': s['sku'], 'supplier': s.get('supplier_id')} for s in supplier_selections]},
        'confidence': confidence,
        'rationale': rationale,
    })

    return {
        **state,
        'supplier_selections': supplier_selections,
        'supplier_rationale': rationale,
        'supplier_confidence': confidence,
        'current_agent': 'supplier_selector',
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
                'matched_count': total_scored,
                'net_requirements_count': len(net_requirements),
                'top_suppliers': [
                    {
                        'sku': selection['sku'],
                        'supplier_id': selection.get('supplier_id'),
                        'score': selection.get('score'),
                    }
                    for selection in supplier_selections[:5]
                ],
            },
        ),
    }
