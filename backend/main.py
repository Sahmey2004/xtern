from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import List, Optional
import os
import asyncio
import json
from pathlib import Path

# Load .env from parent directory
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=str(env_path))

app = FastAPI(
    title='Supply Chain PO Automation',
    description='Multi-Agent Purchase Order System Backend',
    version='0.1.0'
)

# Allow frontend to call backend (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:3000', 'https://*.vercel.app'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

@app.get('/health')
def health_check():
    return {
        'status': 'ok',
        'service': 'supply-chain-po-backend',
        'supabase_configured': bool(os.getenv('SUPABASE_SERVICE_ROLE_KEY')),
        'openrouter_configured': bool(os.getenv('OPENROUTER_API_KEY')),
    }

@app.get('/test-supabase')
async def test_supabase():
    """Verify Supabase connection works."""
    try:
        from supabase import create_client
        client = create_client(
            os.getenv('NEXT_PUBLIC_SUPABASE_URL'),
            os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        )
        # Try to query a table (will return empty before seeding)
        result = client.table('products').select('*').limit(1).execute()
        return {'status': 'connected', 'sample_data': result.data}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}

@app.get('/test-openrouter')
async def test_openrouter():
    """Verify OpenRouter LLM connection works."""
    try:
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(
            model='meta-llama/llama-3.1-8b-instruct:free',
            openai_api_key=os.getenv('OPENROUTER_API_KEY'),
            openai_api_base='https://openrouter.ai/api/v1',
            max_tokens=50,
            default_headers={
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'Supply Chain PO Automation'
            }
        )
        response = llm.invoke('Say hello in one word.')
        return {'status': 'connected', 'response': response.content}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}
    
@app.get('/data-summary')
async def data_summary():
    """Return counts of all seeded tables."""
    from supabase import create_client
    client = create_client(
        os.getenv('NEXT_PUBLIC_SUPABASE_URL'),
        os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    )
    tables = ['products', 'suppliers', 'supplier_products',
             'forecasts', 'inventory', 'container_specs',
             'supplier_scoring_weights']
    counts = {}
    for table in tables:
        result = client.table(table).select('*', count='exact').execute()
        counts[table] = result.count
    return {'status': 'ok', 'counts': counts}

@app.get("/products")
async def get_products():
    """Returns counts of all seeded tables."""
    try:
        from supabase import create_client

        client = create_client(
            os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )

        tables = [
            'products', 'suppliers', 'supplier_products',
            'forecasts', 'inventory', 'container_specs',
            'supplier_scoring_weights'
        ]

        counts = {}
        for table in tables:
            result = client.table(table).select('*', count='exact').execute()
            counts[table] = result.count

        return {
            "status": "ok",
            "counts": counts
        }

    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }



# ─── REQUEST/RESPONSE MODELS ─────────────────────────────────

class PipelineRunRequest(BaseModel):
    skus: Optional[List[str]] = []
    triggered_by: Optional[str] = 'planner'
    horizon_months: Optional[int] = 3

class ApprovalRequest(BaseModel):
    reviewer: str
    action: str           # 'approve' | 'reject'
    notes: Optional[str] = None
    line_item_overrides: Optional[List[dict]] = None


# ─── PIPELINE ENDPOINTS ───────────────────────────────────────

@app.post('/pipeline/run')
async def run_pipeline_endpoint(request: PipelineRunRequest):
    """
    Triggers the multi-agent PO pipeline.
    Runs synchronously (blocks until all 4 agents complete).
    Returns full state including po_number and per-agent outputs.
    """
    try:
        from graph.pipeline import run_pipeline
        state = run_pipeline(
            skus=request.skus or [],
            triggered_by=request.triggered_by or 'planner',
            horizon=request.horizon_months or 3,
        )
        return {
            'status': 'completed' if not state.get('error') else 'error',
            'run_id': state.get('run_id'),
            'po_number': state.get('po_number'),
            'po_total_usd': state.get('po_total_usd'),
            'approval_status': state.get('approval_status'),
            'net_requirements_count': len(state.get('net_requirements', [])),
            'supplier_selections_count': len(state.get('supplier_selections', [])),
            'container_plan': state.get('container_plan'),
            'demand_rationale': state.get('demand_rationale'),
            'supplier_rationale': state.get('supplier_rationale'),
            'container_rationale': state.get('container_rationale'),
            'po_rationale': state.get('po_rationale'),
            'error': state.get('error'),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/pipeline/approve/{po_number}')
async def approve_po(po_number: str, request: ApprovalRequest):
    """
    Approves or rejects a draft PO.
    Human-in-the-loop gate — no PO is committed without this.
    """
    if request.action not in ('approve', 'reject'):
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")
    try:
        from mcp_client.client import call_mcp_tool
        new_status = 'approved' if request.action == 'approve' else 'rejected'
        result = call_mcp_tool('po', 'update_po_status', {
            'po_number': po_number,
            'new_status': new_status,
            'reviewer': request.reviewer,
            'notes': request.notes or '',
            'line_item_overrides': request.line_item_overrides or [],
        })
        return {'status': 'ok', 'po_number': po_number, 'new_status': new_status, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/pipeline/pos')
async def get_purchase_orders(status: str = 'all', limit: int = 20):
    """Returns Purchase Orders with their line items."""
    try:
        from mcp_client.client import call_mcp_tool
        result = call_mcp_tool('po', 'get_pos', {'status': status, 'limit': limit})
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/pipeline/logs')
async def get_decision_logs(run_id: Optional[str] = None, po_number: Optional[str] = None, limit: int = 50):
    """Returns decision log entries for audit trail."""
    try:
        from mcp_client.client import call_mcp_tool
        args: dict = {'limit': limit}
        if run_id: args['run_id'] = run_id
        if po_number: args['po_number'] = po_number
        result = call_mcp_tool('po', 'get_decision_log', args)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))