"""
Agent 1: Demand Analyst
- Reads inventory positions and demand forecasts via MCP
- Checks open PO commitments for each SKU
- Calculates concise replenishment fields with urgency color
- Writes decision log
"""
from __future__ import annotations

import json
import uuid
from datetime import date, datetime, timedelta
from typing import Any, Dict, List

from langchain_core.messages import HumanMessage, SystemMessage

from agents.llm_config import get_llm, update_agent_activity
from graph.state import PipelineState
from mcp_client.client import call_mcp_tool


def _parse_period(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.strptime(value[:10], "%Y-%m-%d").date()
    except Exception:
        return None


def _weighted_trend_adjustment_qty(forecast_rows: List[Dict[str, Any]], sku: str, base_forecast_qty: int) -> tuple[int, float, float]:
    """Returns (uf_qty, yoy_pct, qoq_pct) from forecast/actual history."""
    today = date.today()
    series: List[tuple[date, float]] = []
    for row in forecast_rows:
        if row.get("sku") != sku:
            continue
        period = _parse_period(row.get("period"))
        if not period:
            continue
        qty = row.get("actual_qty")
        if qty is None:
            qty = row.get("forecast_qty", 0)
        series.append((period, float(qty or 0)))

    if not series or base_forecast_qty <= 0:
        return 0, 0.0, 0.0

    series.sort(key=lambda item: item[0])

    def avg_for_window(start_month_offset: int, months: int) -> float:
        start = date(today.year, today.month, 1) + timedelta(days=31 * start_month_offset)
        end = start + timedelta(days=31 * months)
        values = [qty for period, qty in series if start <= period < end]
        if not values:
            return 0.0
        return sum(values) / len(values)

    # Recent quarter vs previous quarter
    recent_q = avg_for_window(-3, 3)
    prev_q = avg_for_window(-6, 3)
    qoq_pct = ((recent_q - prev_q) / prev_q) if prev_q > 0 else 0.0

    # Recent quarter vs same quarter last year
    yoy_base = avg_for_window(-15, 3)
    yoy_pct = ((recent_q - yoy_base) / yoy_base) if yoy_base > 0 else qoq_pct

    weighted_pct = (0.6 * yoy_pct) + (0.4 * qoq_pct)
    # Keep the UF adjustment bounded to avoid unrealistic shocks.
    weighted_pct = max(-0.35, min(0.35, weighted_pct))
    uf_qty = int(round(base_forecast_qty * weighted_pct))
    return uf_qty, yoy_pct, qoq_pct


def _urgency_color(days_to_shortage: int) -> str:
    if days_to_shortage <= 14:
        return "red"
    if days_to_shortage <= 30:
        return "yellow"
    return "green"


def demand_analyst_node(state: PipelineState) -> PipelineState:
    """LangGraph node: calculates net requirements for each SKU."""
    agent_name = "DemandAnalyst"
    run_id = state.get("run_id", str(uuid.uuid4()))
    skus_requested = state.get("skus_to_plan", [])
    horizon = state.get("planning_horizon_months", 3)

    inv_args: Dict[str, Any] = {}
    if skus_requested:
        inv_args["skus"] = skus_requested
    else:
        inv_args["below_reorder_only"] = True

    try:
        inv_data = call_mcp_tool("erp", "get_inventory", inv_args)
    except Exception as exc:
        error_message = f"{agent_name} could not load inventory data: {exc}"
        return {
            **state,
            "run_id": run_id,
            "current_agent": "demand_analyst",
            "error": error_message,
            "agent_activity": update_agent_activity(
                state,
                agent_name,
                status="failed",
                summary=error_message,
                details={"requested_skus": skus_requested, "horizon_months": horizon},
            ),
        }
    inventory = inv_data.get("inventory", [])

    if not inventory:
        error_message = "No inventory records found - run seed_data.py first"
        return {
            **state,
            "error": error_message,
            "current_agent": "demand_analyst",
            "agent_activity": update_agent_activity(
                state,
                agent_name,
                status="failed",
                summary=error_message,
                details={"inventory_count": 0, "requested_skus": skus_requested, "horizon_months": horizon},
            ),
        }

    skus = [record["sku"] for record in inventory]

    try:
        forecast_data = call_mcp_tool(
            "erp",
            "get_forecasts",
            {"skus": skus, "months_ahead": horizon},
        )
    except Exception as exc:
        error_message = f"{agent_name} could not load forecast data: {exc}"
        return {
            **state,
            "run_id": run_id,
            "inventory_snapshot": inventory,
            "skus_to_plan": skus,
            "current_agent": "demand_analyst",
            "error": error_message,
            "agent_activity": update_agent_activity(
                state,
                agent_name,
                status="failed",
                summary=error_message,
                details={"inventory_count": len(inventory), "horizon_months": horizon},
            ),
        }

    try:
        historical_forecast_data = call_mcp_tool(
            "erp",
            "get_forecasts",
            {"skus": skus, "months_ahead": max(12, horizon), "include_historical": True},
        )
    except Exception:
        historical_forecast_data = {"forecasts": []}

    forecast_summary = forecast_data.get("summary_by_sku", [])
    forecast_by_sku = {item["sku"]: int(item.get("total_forecast", 0) or 0) for item in forecast_summary}
    historical_rows: List[Dict[str, Any]] = historical_forecast_data.get("forecasts", []) or []

    try:
        commitments_data = call_mcp_tool("po", "get_open_commitments", {"skus": skus})
        commitments_map = commitments_data.get("by_sku", {}) or {}
    except Exception:
        commitments_map = {}

    forecast_results: List[Dict[str, Any]] = []
    net_requirements: List[Dict[str, Any]] = []
    today = date.today()

    for inv in inventory:
        sku = inv["sku"]
        current_stock = int(inv.get("current_stock", 0) or 0)
        in_transit = int(inv.get("in_transit", 0) or 0)
        safety = int(inv.get("safety_stock", 0) or 0)
        forecast = int(forecast_by_sku.get(sku, 0) or 0)

        open_commitment = commitments_map.get(sku, {}) if isinstance(commitments_map, dict) else {}
        open_po_qty = int(open_commitment.get("open_po_qty", 0) or 0)
        next_open_po_eta = open_commitment.get("next_open_po_eta")

        available = current_stock + in_transit
        short_qty = max(0, forecast + safety - available)

        uf_qty, yoy_pct, qoq_pct = _weighted_trend_adjustment_qty(historical_rows, sku, forecast)
        new_order_qty = max(0, short_qty + uf_qty - open_po_qty)

        product_info = inv.get("products") or {}
        moq = int(product_info.get("moq", 1) or 1) if isinstance(product_info, dict) else 1
        final_order_qty = new_order_qty
        if final_order_qty > 0 and final_order_qty < moq:
            final_order_qty = moq

        daily_demand = (forecast / max(1, horizon * 30))
        stock_after_safety = (current_stock + in_transit + open_po_qty) - safety
        if daily_demand <= 0:
            days_to_shortage = 365
        else:
            days_to_shortage = int(max(0, stock_after_safety / daily_demand))

        urgency_color = _urgency_color(days_to_shortage)
        need_by_date = (today + timedelta(days=days_to_shortage)).isoformat() if final_order_qty > 0 else None

        row = {
            "sku": sku,
            "short_qty": short_qty,
            "safety_stock_qty": safety,
            "uf_qty": uf_qty,
            "new_order_qty": new_order_qty,
            "final_order_qty": final_order_qty,
            "moq": moq,
            "need_by_date": need_by_date,
            "open_po_qty": open_po_qty,
            "next_open_po_eta": next_open_po_eta,
            "urgency_color": urgency_color,
            "trend": {
                "yoy_pct": round(yoy_pct, 4),
                "qoq_pct": round(qoq_pct, 4),
            },
            "current_stock": current_stock,
            "in_transit": in_transit,
            "forecast_demand": forecast,
            "urgency": "critical" if urgency_color == "red" else "normal",
        }
        forecast_results.append(row)

        if final_order_qty > 0:
            net_requirements.append(row)

    # If the user explicitly selected SKUs, allow a draft simulation path even when
    # strict shortage math results in zero net requirements.
    if not net_requirements and skus_requested:
        requested_set = {sku.upper() for sku in skus_requested}
        fallback_rows = [row for row in forecast_results if str(row.get("sku", "")).upper() in requested_set]

        for row in fallback_rows[:8]:
            forced_qty = max(int(row.get("moq", 1) or 1), 1)
            simulated_row = {**row}
            simulated_row["new_order_qty"] = forced_qty
            simulated_row["final_order_qty"] = forced_qty
            simulated_row["need_by_date"] = simulated_row.get("need_by_date") or (today + timedelta(days=30)).isoformat()
            simulated_row["urgency_color"] = simulated_row.get("urgency_color") if simulated_row.get("urgency_color") != "green" else "yellow"
            simulated_row["forced_by_user_request"] = True
            simulated_row["urgency"] = "normal"
            net_requirements.append(simulated_row)

    if not net_requirements:
        rationale = (
            f"No replenishment required across {len(inventory)} SKU(s) for the next {horizon} month(s). "
            "Current stock, in-transit inventory, and open PO commitments cover projected demand."
        )
        confidence = 1.0
        summary_lines = ["No SKU currently needs a new purchase order."]
        concerns: List[str] = []

        call_mcp_tool(
            "po",
            "log_decision",
            {
                "run_id": run_id,
                "agent_name": agent_name,
                "inputs": {"skus_requested": skus_requested, "horizon_months": horizon, "inventory_count": len(inventory)},
                "output": {
                    "net_requirements_count": 0,
                "summary_lines": summary_lines,
                "concerns": concerns,
                "sample_rows": [],
                "simulation_mode": False,
            },
            "confidence": confidence,
            "rationale": rationale,
        },
    )

        return {
            **state,
            "run_id": run_id,
            "inventory_snapshot": inventory,
            "forecast_summary": forecast_summary,
            "forecast_results": forecast_results,
            "net_requirements": [],
            "skus_to_plan": skus,
            "demand_rationale": rationale,
            "demand_confidence": confidence,
            "current_agent": "demand_analyst",
            "error": None,
            "agent_activity": update_agent_activity(
                state,
                agent_name,
                status="completed",
                summary=rationale,
                confidence=confidence,
                llm_used=False,
                details={
                    "inventory_count": len(inventory),
                    "net_requirements_count": 0,
                    "summary_lines": summary_lines,
                    "concerns": concerns,
                    "sample_rows": [],
                    "simulation_mode": False,
                    "horizon_months": horizon,
                },
            ),
        }

    prompt = f"""You are a demand planner. Summarize these results in concise operator style.
Return JSON only:
{{
  "rationale": "One short sentence.",
  "confidence": 0.0_to_1.0,
  "lines": ["SKU -> short X -> safety Y -> need by DATE", "max 4 lines"],
  "concerns": ["short bullet", "short bullet"]
}}

Top rows:
{json.dumps(net_requirements[:6], indent=2)}
"""
    llm_error = None
    llm_used = False
    concerns: List[str] = []
    summary_lines: List[str] = []
    try:
        llm = get_llm(max_tokens=700, temperature=0.1)
        response = llm.invoke(
            [
                SystemMessage(content="You are a supply chain analyst. Respond only with valid JSON."),
                HumanMessage(content=prompt),
            ]
        )
        llm_used = True
        parsed = json.loads(response.content.strip().strip("```json").strip("```"))
        rationale = str(parsed.get("rationale", "")).strip()
        confidence = float(parsed.get("confidence", 0.86))
        if confidence <= 0:
            confidence = 0.86
        if confidence > 1:
            confidence = 1.0
        summary_lines = [str(line) for line in (parsed.get("lines") or [])[:4]]
        concerns = [str(item) for item in (parsed.get("concerns") or [])[:4]]
        if not rationale:
            rationale = f"{len(net_requirements)} SKU(s) need replenishment over the next {horizon} month(s)."
        if not summary_lines:
            summary_lines = [
                f"{row['sku']} -> short {row['short_qty']} -> safety {row['safety_stock_qty']} -> need by {row['need_by_date'] or 'N/A'}"
                for row in net_requirements[:4]
            ]
        if any(bool(row.get("forced_by_user_request")) for row in net_requirements):
            rationale = (
                "No strict shortage detected for selected SKUs; generated MOQ-based draft simulation so downstream agents can build a PO preview."
            )
            confidence = max(confidence, 0.8)
    except RuntimeError as exc:
        error_message = f"{agent_name} could not reach OpenAI: {exc}"
        return {
            **state,
            "run_id": run_id,
            "inventory_snapshot": inventory,
            "forecast_summary": forecast_summary,
            "forecast_results": forecast_results,
            "net_requirements": net_requirements,
            "skus_to_plan": skus,
            "current_agent": "demand_analyst",
            "error": error_message,
            "agent_activity": update_agent_activity(
                state,
                agent_name,
                status="failed",
                summary=error_message,
                llm_error=str(exc),
                details={
                    "inventory_count": len(inventory),
                    "net_requirements_count": len(net_requirements),
                    "horizon_months": horizon,
                },
            ),
        }
    except Exception as exc:
        llm_error = f"OpenAI response parse failed: {exc}"
        rationale = f"{len(net_requirements)} SKUs need replenishment over {horizon} month horizon."
        confidence = 0.86
        summary_lines = [
            f"{row['sku']} -> short {row['short_qty']} -> safety {row['safety_stock_qty']} -> need by {row['need_by_date'] or 'N/A'}"
            for row in net_requirements[:4]
        ]
        concerns = []

    call_mcp_tool(
        "po",
        "log_decision",
        {
            "run_id": run_id,
            "agent_name": agent_name,
            "inputs": {"skus_requested": skus_requested, "horizon_months": horizon, "inventory_count": len(inventory)},
            "output": {
                "net_requirements_count": len(net_requirements),
                "summary_lines": summary_lines,
                "concerns": concerns,
                "sample_rows": net_requirements[:5],
            },
            "confidence": confidence,
            "rationale": rationale,
        },
    )

    return {
        **state,
        "run_id": run_id,
        "inventory_snapshot": inventory,
        "forecast_summary": forecast_summary,
        "forecast_results": forecast_results,
        "net_requirements": net_requirements,
        "skus_to_plan": skus,
        "demand_rationale": rationale,
        "demand_confidence": confidence,
        "current_agent": "demand_analyst",
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
                "inventory_count": len(inventory),
                "net_requirements_count": len(net_requirements),
                "summary_lines": summary_lines,
                "concerns": concerns,
                "sample_rows": net_requirements[:6],
                "horizon_months": horizon,
            },
        ),
    }
