"""
Agent 2: Supplier Selector
- Scores and selects the best supplier for each SKU using MCP
- Uses weighted criteria: quality, delivery, lead time, cost
- Returns primary supplier + up to 2 alternatives with sub-score metrics
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
                # Extract sub-scores from score_breakdown if available
                breakdown = recommended.get('score_breakdown', {})
                quality_score = breakdown.get('quality', recommended.get('quality_score'))
                delivery_performance = breakdown.get('delivery', recommended.get('delivery_performance'))
                cost_rating = breakdown.get('cost', recommended.get('cost_rating'))

                # Enrich all_candidates with sub-scores
                enriched_candidates = []
                for c in ranked[:3]:
                    cb = c.get('score_breakdown', {})
                    enriched_candidates.append({
                        'supplier_id': c['supplier_id'],
                        'supplier_name': c['supplier_name'],
                        'unit_price': c['unit_price'],
                        'score': c['score'],
                        'lead_time_days': c['lead_time_days'],
                        'moq_fit_pct': c.get('moq_fit_pct', 100),
                        'quality_score': cb.get('quality', c.get('quality_score')),
                        'delivery_performance': cb.get('delivery', c.get('delivery_performance')),
                        'cost_rating': cb.get('cost', c.get('cost_rating')),
                    })

                supplier_selections.append({
                    'sku': sku,
                    'supplier_id': recommended['supplier_id'],
                    'supplier_name': recommended['supplier_name'],
                    'unit_price': recommended['unit_price'],
                    'score': recommended['score'],
                    'lead_time_days': recommended['lead_time_days'],
                    'net_qty': net_qty,
                    'urgency': req['urgency'],
                    'quality_score': quality_score,
                    'delivery_performance': delivery_performance,
                    'cost_rating': cost_rating,
                    'rationale': (
                        f"Selected {recommended['supplier_name']} (score {recommended['score']}/100): "
                        f"${recommended['unit_price']:.2f}/unit, {recommended['lead_time_days']}d lead time, "
                        f"MOQ fit {recommended.get('moq_fit_pct', 100)}%"
                    ),
                    'concerns': [],
                    'all_candidates': enriched_candidates,
                })
                total_scored += 1
        except Exception as e:
            supplier_selections.append({
                'sku': sku,
                'supplier_id': None,
                'error': str(e),
                'net_qty': net_qty,
                'urgency': req['urgency'],
                'concerns': [],
            })

    # LLM summary with concerns as bullet points
    prompt = f"""You are a procurement analyst. {total_scored} out of {len(net_requirements)} SKUs have been matched to suppliers.

Sample selections (first 3):
{json.dumps([s for s in supplier_selections[:3] if s.get('supplier_id')], indent=2)}

Respond in JSON ONLY:
{{"rationale": "One sentence why the primary suppliers were chosen.", "confidence": 0.0_to_1.0, "concerns": ["concern 1", "concern 2"]}}

Keep rationale to ONE sentence. List real procurement concerns as short bullet strings (max 3). If no concerns, use empty array."""
    llm_error = None
    llm_used = False
    try:
        llm = get_llm(max_tokens=512, temperature=0.1)
        response = llm.invoke([SystemMessage(content='Respond only with valid JSON.'), HumanMessage(content=prompt)])
        llm_used = True
    except RuntimeError as exc:
        error_message = f'{agent_name} could not reach OpenAI: {exc}'
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
        error_message = f'{agent_name} OpenAI request failed: {exc}'
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

    concerns = []
    try:
        raw = response.content.strip()
        if raw.startswith('```'):
            raw = raw.split('\n', 1)[-1]
            raw = raw.rsplit('```', 1)[0].strip()
        parsed = json.loads(raw)
        rationale = parsed.get('rationale', '')
        confidence = float(parsed.get('confidence', 0.82))
        concerns = parsed.get('concerns', [])
        if not isinstance(concerns, list):
            concerns = []
    except Exception as exc:
        llm_error = f'OpenAI response parse failed: {exc}'
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
        'supplier_concerns': concerns,
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
                'concerns': concerns,
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
