"""
Agent 2: Supplier Selector
- Scores and selects the best supplier for each SKU using MCP
- Uses weighted criteria: quality, delivery, lead time, cost
- Writes decision log
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


def supplier_selector_node(state: PipelineState) -> PipelineState:
    """LangGraph node: selects best supplier for each SKU."""
    run_id = state.get('run_id', 'unknown')
    net_requirements = state.get('net_requirements', [])

    if not net_requirements:
        return {**state, 'error': 'No net requirements — demand analyst must run first', 'current_agent': 'supplier_selector'}

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
    llm = get_llm()
    prompt = f"""You are a procurement analyst. {total_scored} out of {len(net_requirements)} SKUs have been matched to suppliers.

Sample selections (first 3):
{json.dumps([s for s in supplier_selections[:3] if s.get('supplier_id')], indent=2)}

Provide a brief procurement summary and confidence score in JSON:
{{"rationale": "...", "confidence": 0.0_to_1.0}}"""

    try:
        response = llm.invoke([SystemMessage(content='Respond only with valid JSON.'), HumanMessage(content=prompt)])
        parsed = json.loads(response.content.strip().strip('```json').strip('```'))
        rationale = parsed.get('rationale', '')
        confidence = float(parsed.get('confidence', 0.82))
    except Exception:
        rationale = f'Supplier selected for {total_scored}/{len(net_requirements)} SKUs using weighted scoring.'
        confidence = 0.82

    call_mcp_tool('po', 'log_decision', {
        'run_id': run_id,
        'agent_name': 'SupplierSelector',
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
    }
