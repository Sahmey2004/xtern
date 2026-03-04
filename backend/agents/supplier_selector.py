"""
Agent 2: Supplier Selector
- Scores and selects one primary supplier plus 2-3 alternatives per SKU
- Emits concise metrics and short concerns bullets
- Writes decision log
"""
from __future__ import annotations

import json
from datetime import date
from typing import Any, Dict, List

from langchain_core.messages import HumanMessage, SystemMessage

from agents.llm_config import get_llm, update_agent_activity
from graph.state import PipelineState
from mcp_client.client import call_mcp_tool


def _days_until(target_iso: str | None) -> int | None:
    if not target_iso:
        return None
    try:
        target = date.fromisoformat(target_iso[:10])
    except Exception:
        return None
    return (target - date.today()).days


def supplier_selector_node(state: PipelineState) -> PipelineState:
    """LangGraph node: selects suppliers with alternatives for each SKU."""
    agent_name = "SupplierSelector"
    run_id = state.get("run_id", "unknown")
    net_requirements = state.get("net_requirements", [])

    if not net_requirements:
        error_message = "No net requirements - demand analyst must run first"
        return {
            **state,
            "error": error_message,
            "current_agent": "supplier_selector",
            "agent_activity": update_agent_activity(
                state,
                agent_name,
                status="failed",
                summary=error_message,
                details={"net_requirements_count": 0},
            ),
        }

    supplier_selections: List[Dict[str, Any]] = []
    total_scored = 0

    for req in net_requirements:
        sku = req["sku"]
        order_qty = int(req.get("final_order_qty") or req.get("net_qty") or 0)
        need_by_date = req.get("need_by_date")
        days_to_need = _days_until(need_by_date)

        try:
            result = call_mcp_tool("supplier", "score_suppliers", {"sku": sku, "order_qty": order_qty})
            ranked = result.get("ranked_suppliers", []) or []
            if not ranked:
                raise RuntimeError("No ranked suppliers returned.")

            top_candidates = ranked[:4]
            recommended = top_candidates[0]
            alternatives = top_candidates[1:4]

            try:
                commitments = call_mcp_tool(
                    "po",
                    "get_open_commitments",
                    {
                        "skus": [sku],
                        "supplier_ids": [candidate.get("supplier_id") for candidate in top_candidates if candidate.get("supplier_id")],
                    },
                )
            except Exception:
                commitments = {}

            by_supplier = ((commitments.get("by_supplier") or {}).get(sku, {})) if isinstance(commitments, dict) else {}
            open_for_recommended = by_supplier.get(recommended.get("supplier_id"), {}) if isinstance(by_supplier, dict) else {}

            confidence = round(min(0.99, max(0.4, float(recommended.get("score", 60)) / 100.0)), 2)
            confidence_meaning = "Probability recommendation remains best fit given current cost, quality, lead time, and delivery signals."

            switch_considerations: List[Dict[str, Any]] = []
            for alt in alternatives:
                switch_considerations.append(
                    {
                        "supplier_id": alt.get("supplier_id"),
                        "supplier_name": alt.get("supplier_name"),
                        "delta_lead_time_days": int((alt.get("lead_time_days") or 0) - (recommended.get("lead_time_days") or 0)),
                        "delta_unit_price": round(float((alt.get("unit_price") or 0) - (recommended.get("unit_price") or 0)), 2),
                        "delta_score": round(float((alt.get("score") or 0) - (recommended.get("score") or 0)), 2),
                    }
                )

            concerns: List[str] = []
            if days_to_need is not None and (recommended.get("lead_time_days") or 0) > max(days_to_need, 0):
                concerns.append("Lead time is longer than required need-by window.")
            if float(recommended.get("moq_fit_pct") or 100) < 100:
                concerns.append("MOQ fit below 100%; potential over-order risk.")
            if int(open_for_recommended.get("open_po_qty", 0) or 0) > 0:
                concerns.append("Existing open PO found for this SKU/supplier; verify duplication risk.")

            supplier_selections.append(
                {
                    "sku": sku,
                    "supplier_id": recommended["supplier_id"],
                    "supplier_name": recommended.get("supplier_name"),
                    "unit_price": recommended.get("unit_price"),
                    "score": recommended.get("score"),
                    "lead_time_days": recommended.get("lead_time_days"),
                    "net_qty": order_qty,
                    "urgency": req.get("urgency", "normal"),
                    "urgency_color": req.get("urgency_color"),
                    "rationale": f"{recommended.get('supplier_name')} score {recommended.get('score')}, lead {recommended.get('lead_time_days')}d, unit ${float(recommended.get('unit_price') or 0):.2f}",
                    "confidence": confidence,
                    "confidence_meaning": confidence_meaning,
                    "recommended_supplier": {
                        "supplier_id": recommended.get("supplier_id"),
                        "supplier_name": recommended.get("supplier_name"),
                        "delivery_performance": recommended.get("score_breakdown", {}).get("delivery"),
                        "quality": recommended.get("score_breakdown", {}).get("quality"),
                        "lead_time_days": recommended.get("lead_time_days"),
                        "unit_price": recommended.get("unit_price"),
                        "score": recommended.get("score"),
                        "open_po_qty": int(open_for_recommended.get("open_po_qty", 0) or 0),
                        "next_open_po_eta": open_for_recommended.get("next_open_po_eta"),
                    },
                    "alternatives": [
                        {
                            "supplier_id": alt.get("supplier_id"),
                            "supplier_name": alt.get("supplier_name"),
                            "delivery_performance": alt.get("score_breakdown", {}).get("delivery"),
                            "quality": alt.get("score_breakdown", {}).get("quality"),
                            "lead_time_days": alt.get("lead_time_days"),
                            "unit_price": alt.get("unit_price"),
                            "score": alt.get("score"),
                            "open_po_qty": int(((by_supplier.get(alt.get("supplier_id"), {}) if isinstance(by_supplier, dict) else {}).get("open_po_qty", 0) or 0)),
                            "next_open_po_eta": (by_supplier.get(alt.get("supplier_id"), {}) if isinstance(by_supplier, dict) else {}).get("next_open_po_eta"),
                        }
                        for alt in alternatives
                    ],
                    "switch_considerations": switch_considerations,
                    "concerns": concerns,
                    "all_candidates": top_candidates,
                }
            )
            total_scored += 1
        except Exception as exc:
            supplier_selections.append(
                {
                    "sku": sku,
                    "supplier_id": None,
                    "error": str(exc),
                    "net_qty": order_qty,
                    "urgency": req.get("urgency", "normal"),
                    "urgency_color": req.get("urgency_color"),
                    "concerns": ["No supplier recommendation available for this SKU."],
                }
            )

    prompt = f"""Summarize supplier selections with concise tone. JSON only:
{{
  "rationale": "one short sentence",
  "confidence": 0.0_to_1.0,
  "concerns": ["short bullet", "short bullet"]
}}

Sample rows:
{json.dumps(supplier_selections[:4], indent=2)}
"""

    llm_error = None
    llm_used = False
    concerns: List[str] = []
    try:
        llm = get_llm(max_tokens=500, temperature=0.1)
        response = llm.invoke([SystemMessage(content="Respond only with valid JSON."), HumanMessage(content=prompt)])
        llm_used = True
        parsed = json.loads(response.content.strip().strip("```json").strip("```"))
        rationale = parsed.get("rationale", "")
        confidence = float(parsed.get("confidence", 0.84))
        concerns = [str(item) for item in (parsed.get("concerns") or [])[:4]]
    except RuntimeError as exc:
        error_message = f"{agent_name} could not reach OpenAI: {exc}"
        return {
            **state,
            "supplier_selections": supplier_selections,
            "current_agent": "supplier_selector",
            "error": error_message,
            "agent_activity": update_agent_activity(
                state,
                agent_name,
                status="failed",
                summary=error_message,
                llm_error=str(exc),
                details={"matched_count": total_scored, "net_requirements_count": len(net_requirements)},
            ),
        }
    except Exception as exc:
        llm_error = f"OpenAI response parse failed: {exc}"
        rationale = f"Primary suppliers chosen for {total_scored}/{len(net_requirements)} SKUs with alternatives attached."
        confidence = 0.84

    call_mcp_tool(
        "po",
        "log_decision",
        {
            "run_id": run_id,
            "agent_name": agent_name,
            "inputs": {"sku_count": len(net_requirements)},
            "output": {
                "matched_count": total_scored,
                "selections": [
                    {
                        "sku": selection["sku"],
                        "supplier": selection.get("supplier_id"),
                        "concerns": selection.get("concerns", []),
                    }
                    for selection in supplier_selections
                ],
                "concerns": concerns,
            },
            "confidence": confidence,
            "rationale": rationale,
        },
    )

    return {
        **state,
        "supplier_selections": supplier_selections,
        "supplier_rationale": rationale,
        "supplier_confidence": confidence,
        "current_agent": "supplier_selector",
        "error": None,
        "agent_activity": update_agent_activity(
            state,
            agent_name,
            status="completed",
            summary=rationale,
            confidence=confidence,
            llm_used=llm_used,
            llm_error=llm_error,
            details={
                "matched_count": total_scored,
                "net_requirements_count": len(net_requirements),
                "concerns": concerns,
                "top_suppliers": [
                    {
                        "sku": selection["sku"],
                        "supplier_id": selection.get("supplier_id"),
                        "score": selection.get("score"),
                        "alternatives_count": len(selection.get("alternatives", [])),
                    }
                    for selection in supplier_selections[:8]
                ],
            },
        ),
    }

