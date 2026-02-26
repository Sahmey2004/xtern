"""
Shared LangGraph state schema for the PO automation pipeline.
All agents read from and write to this TypedDict.
"""
from typing import TypedDict, Optional, List, Dict, Any


class PipelineState(TypedDict, total=False):
    # ── Run metadata ──────────────────────────────────────────
    run_id: str
    triggered_by: str           # user who started the run
    planning_horizon_months: int

    # ── SKU selection ─────────────────────────────────────────
    skus_to_plan: List[str]     # empty = auto-select below-reorder SKUs

    # ── Agent 1: Demand Analyst ───────────────────────────────
    inventory_snapshot: List[Dict[str, Any]]
    forecast_summary: List[Dict[str, Any]]   # {sku, total_forecast, months}
    net_requirements: List[Dict[str, Any]]   # {sku, net_qty, urgency}
    demand_rationale: str
    demand_confidence: float

    # ── Agent 2: Supplier Selector ────────────────────────────
    supplier_selections: List[Dict[str, Any]]  # {sku, supplier_id, score, rationale}
    supplier_rationale: str
    supplier_confidence: float

    # ── Agent 3: Container Optimizer ─────────────────────────
    order_line_items: List[Dict[str, Any]]     # {sku, supplier_id, qty, unit_price}
    container_plan: Optional[Dict[str, Any]]
    container_rationale: str
    container_confidence: float

    # ── Agent 4: PO Compiler ──────────────────────────────────
    po_number: Optional[str]
    po_total_usd: float
    po_rationale: str

    # ── Human-in-the-loop ─────────────────────────────────────
    approval_status: str          # 'pending' | 'approved' | 'rejected'
    reviewer_notes: Optional[str]
    line_item_overrides: Optional[List[Dict[str, Any]]]

    # ── Error handling ────────────────────────────────────────
    error: Optional[str]
    current_agent: str
