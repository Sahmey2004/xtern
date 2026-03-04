from __future__ import annotations

import os
from typing import Any, Dict, List, Literal, Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from auth_utils import get_current_user, get_service_supabase_client, require_roles
from config import first_env_file, load_project_env


# Load env from repo root first, then backend/.env as fallback.
load_project_env()

app = FastAPI(
    title="Supply Chain PO Automation",
    description="Multi-Agent Purchase Order System Backend",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PipelineRunRequest(BaseModel):
    skus: Optional[List[str]] = Field(default_factory=list)
    horizon_months: Optional[int] = 3


class ApprovalRequest(BaseModel):
    action: Literal["approve", "reject"]
    notes: Optional[str] = None
    line_item_overrides: Optional[List[dict]] = None


class AccountSettingsUpdateRequest(BaseModel):
    full_name: str


def _get_supabase():
    try:
        return get_service_supabase_client()
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def _apply_search_sort_paginate(
    rows: List[Dict[str, Any]],
    *,
    search: str = "",
    sort_by: str = "",
    sort_dir: str = "asc",
    filter_col: str = "",
    filter_val: str = "",
    page: int = 1,
    page_size: int = 25,
) -> Dict[str, Any]:
    data = rows
    if search:
        needle = search.lower()
        data = [
            row
            for row in data
            if any(needle in str(value).lower() for value in row.values() if value is not None)
        ]

    if filter_col and filter_val:
        fneedle = filter_val.lower()
        data = [row for row in data if fneedle in str(row.get(filter_col, "")).lower()]

    if sort_by:
        data = sorted(
            data,
            key=lambda row: (row.get(sort_by) is None, str(row.get(sort_by, ""))),
            reverse=(sort_dir == "desc"),
        )

    total = len(data)
    start = max(0, (page - 1) * page_size)
    end = start + page_size
    page_rows = data[start:end]
    return {"rows": page_rows, "total": total}


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "supply-chain-po-backend",
        "env_file_found": first_env_file(),
        "supabase_configured": bool(os.getenv("SUPABASE_SERVICE_ROLE_KEY")),
        "openai_configured": bool(os.getenv("OPENAI_API_KEY")),
        "llm_provider": "openai",
        "openai_model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
    }


@app.get("/auth/me")
def auth_me(user: Dict[str, Any] = Depends(get_current_user)):
    return {"user": user}


@app.post("/auth/settings/account")
def update_account_settings(
    request: AccountSettingsUpdateRequest,
    user: Dict[str, Any] = Depends(get_current_user),
):
    full_name = (request.full_name or "").strip()
    if not full_name:
        raise HTTPException(status_code=400, detail="full_name is required.")
    client = _get_supabase()
    client.table("user_profiles").update({"full_name": full_name}).eq("user_id", user["user_id"]).execute()
    return {"status": "ok", "full_name": full_name}


@app.get("/test-supabase")
async def test_supabase():
    """Verify Supabase connection works."""
    try:
        client = _get_supabase()
        result = client.table("products").select("*").limit(1).execute()
        return {"status": "connected", "sample_data": result.data}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@app.get("/test-openai")
async def test_openai():
    """Verify OpenAI LLM connection works."""
    try:
        from agents.llm_config import get_llm

        llm = get_llm(max_tokens=50, temperature=0)
        response = llm.invoke("Say hello in one word.")
        return {
            "status": "connected",
            "provider": "openai",
            "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            "response": response.content,
        }
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@app.get("/test-openrouter")
async def test_openrouter_compat():
    """Backward-compatible alias for older clients."""
    return await test_openai()


@app.get("/data-summary")
async def data_summary():
    """Return counts of all seeded tables."""
    client = _get_supabase()
    tables = [
        "products",
        "suppliers",
        "supplier_products",
        "forecasts",
        "inventory",
        "container_specs",
        "supplier_scoring_weights",
        "purchase_orders",
        "decision_log",
    ]
    counts = {}
    for table in tables:
        result = client.table(table).select("*", count="exact").execute()
        counts[table] = result.count
    return {"status": "ok", "counts": counts}


@app.get("/products")
async def products_summary():
    """Backward-compatible summary endpoint."""
    return await data_summary()


@app.post("/pipeline/run")
async def run_pipeline_endpoint(
    request: PipelineRunRequest,
    user: Dict[str, Any] = Depends(require_roles("administrator", "po_manager")),
):
    """
    Triggers the 4-agent PO pipeline.
    """
    try:
        from graph.pipeline import run_pipeline

        state = run_pipeline(
            skus=request.skus or [],
            triggered_by=user.get("full_name", "planner"),
            triggered_by_user_id=user.get("user_id", ""),
            triggered_by_role=user.get("role", "po_manager"),
            horizon=request.horizon_months or 3,
        )

        agent_activity = state.get("agent_activity", {}) or {}
        openai_requests_made = sum(1 for entry in agent_activity.values() if entry.get("llm_used"))

        return {
            "status": "completed" if not state.get("error") else "error",
            "run_id": state.get("run_id"),
            "po_number": state.get("po_number"),
            "po_total_usd": state.get("po_total_usd"),
            "approval_status": state.get("approval_status"),
            "net_requirements_count": len(state.get("net_requirements", [])),
            "supplier_selections_count": len(state.get("supplier_selections", [])),
            "container_plan": state.get("container_plan"),
            "demand_rationale": state.get("demand_rationale"),
            "supplier_rationale": state.get("supplier_rationale"),
            "container_rationale": state.get("container_rationale"),
            "po_rationale": state.get("po_rationale"),
            "agent_activity": agent_activity,
            "openai_requests_made": openai_requests_made,
            "error": state.get("error"),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/pipeline/approve/{po_number}")
async def approve_po(
    po_number: str,
    request: ApprovalRequest,
    user: Dict[str, Any] = Depends(require_roles("administrator")),
):
    if request.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")
    try:
        from mcp_client.client import call_mcp_tool

        new_status = "approved" if request.action == "approve" else "rejected"
        result = call_mcp_tool(
            "po",
            "update_po_status",
            {
                "po_number": po_number,
                "new_status": new_status,
                "reviewer": user.get("full_name"),
                "notes": request.notes or "",
                "line_item_overrides": request.line_item_overrides or [],
            },
        )
        return {"status": "ok", "po_number": po_number, "new_status": new_status, **result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/pipeline/pos")
async def get_purchase_orders(
    status: str = "all",
    limit: int = 20,
    user: Dict[str, Any] = Depends(require_roles("administrator", "po_manager")),
):
    """Returns Purchase Orders with line items."""
    try:
        from mcp_client.client import call_mcp_tool

        args: Dict[str, Any] = {"status": status, "limit": limit}
        if user.get("role") == "po_manager":
            args["created_by_user_id"] = user.get("user_id")
        result = call_mcp_tool("po", "get_pos", args)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/pipeline/logs")
async def get_decision_logs(
    run_id: Optional[str] = None,
    po_number: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    user: Dict[str, Any] = Depends(require_roles("administrator")),
):
    """Returns decision log entries for audit trail."""
    try:
        from mcp_client.client import call_mcp_tool

        args: Dict[str, Any] = {"limit": min(max(limit, 1), 100)}
        if run_id:
            args["run_id"] = run_id
        if po_number:
            args["po_number"] = po_number
        result = call_mcp_tool("po", "get_decision_log", args)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/data/table/{dataset}")
async def get_data_table(
    dataset: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    search: str = "",
    sort_by: str = "",
    sort_dir: Literal["asc", "desc"] = "asc",
    filter_col: str = "",
    filter_val: str = "",
    user: Dict[str, Any] = Depends(require_roles("administrator", "po_manager")),
):
    allowed = {"inventory", "forecasts", "products", "suppliers", "purchase_orders", "po_line_items"}
    if dataset not in allowed:
        raise HTTPException(status_code=404, detail=f"Unsupported dataset '{dataset}'.")

    client = _get_supabase()

    if dataset == "purchase_orders":
        query = client.table("purchase_orders").select("*").order("created_at", desc=True)
        if user.get("role") == "po_manager":
            query = query.eq("created_by_user_id", user.get("user_id"))
        response = query.limit(2000).execute()
        rows = response.data or []
    elif dataset == "po_line_items":
        if user.get("role") == "po_manager":
            po_resp = (
                client.table("purchase_orders")
                .select("po_number")
                .eq("created_by_user_id", user.get("user_id"))
                .limit(2000)
                .execute()
            )
            po_numbers = [row["po_number"] for row in (po_resp.data or [])]
            if not po_numbers:
                rows = []
            else:
                line_resp = client.table("po_line_items").select("*").in_("po_number", po_numbers).limit(5000).execute()
                rows = line_resp.data or []
        else:
            line_resp = client.table("po_line_items").select("*").limit(5000).execute()
            rows = line_resp.data or []
    else:
        response = client.table(dataset).select("*").limit(5000).execute()
        rows = response.data or []

    scoped = _apply_search_sort_paginate(
        rows,
        search=search,
        sort_by=sort_by,
        sort_dir=sort_dir,
        filter_col=filter_col,
        filter_val=filter_val,
        page=page,
        page_size=page_size,
    )
    columns = sorted(list(scoped["rows"][0].keys())) if scoped["rows"] else sorted(list(rows[0].keys())) if rows else []
    return {
        "dataset": dataset,
        "columns": columns,
        "rows": scoped["rows"],
        "page": page,
        "page_size": page_size,
        "total": scoped["total"],
    }
