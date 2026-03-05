# ProcureAI -- Technical Design Document

**Cummins Xtern 2026 Competition**
**Date:** March 2026
**Version:** 1.0

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Agent Roles and Decision Boundaries](#2-agent-roles-and-decision-boundaries)
3. [MCP Usage and Context Flow](#3-mcp-usage-and-context-flow)
4. [Orchestration Strategy](#4-orchestration-strategy)
5. [Data Persistence and Audit Strategy](#5-data-persistence-and-audit-strategy)
6. [Security Overview](#6-security-overview)

---

## 1. Architecture Overview

ProcureAI is a multi-agent supply chain purchase order automation system. It uses four specialized AI agents, orchestrated by LangGraph, to analyze demand, select suppliers, optimize container packing, and compile purchase orders -- with human review gates at each stage.

**Technology Stack:**
- **Frontend:** Next.js 14 (TypeScript)
- **Backend:** Python FastAPI
- **Orchestration:** LangGraph StateGraph
- **Tool Layer:** 4 Model Context Protocol (MCP) servers (TypeScript)
- **Database:** Supabase (PostgreSQL)
- **LLM:** OpenAI-compatible model via OpenRouter

### Architecture Diagram

```
+------------------------------------------------------------------+
|                        FRONTEND (Next.js 14)                     |
|   +------------------+  +----------------+  +----------------+   |
|   | Pipeline Control |  |   Approvals    |  |   Audit Logs   |   |
|   | (Step-by-Step)   |  |   Dashboard    |  |    Viewer      |   |
|   +--------+---------+  +-------+--------+  +-------+--------+   |
+------------|----------------------|-------------------|----------+
             |                      |                   |
             v                      v                   v
+------------------------------------------------------------------+
|                    BACKEND (FastAPI)                              |
|                                                                  |
|   /pipeline/run    /pipeline/approve/:po    /pipeline/pos        |
|   /pipeline/logs                                                 |
|                                                                  |
|   +----------------------------------------------------------+  |
|   |              LangGraph StateGraph                        |  |
|   |                                                          |  |
|   |   DemandAnalyst --> SupplierSelector --> ContainerOpt    |  |
|   |                                           --> POCompiler |  |
|   |                                                          |  |
|   |   (conditional routing: skip downstream on failure)      |  |
|   +-----+----------+----------+----------+-------------------+  |
|         |          |          |          |                       |
|   +-----v----------v----------v----------v-------------------+  |
|   |           MCP Client (subprocess stdio JSON-RPC)         |  |
|   +-----+----------+----------+----------+-------------------+  |
+---------|----------|----------|----------|----------------------+
          |          |          |          |
          v          v          v          v
   +-----------+ +----------+ +--------+ +-------------+
   | erp-data  | | supplier | | logis- | | po-manage-  |
   | server    | | -data    | | tics   | | ment server |
   |           | | server   | | server | |             |
   +-----------+ +----------+ +--------+ +-------------+
          |          |          |          |
          +----------+----------+----------+
                     |
                     v
          +---------------------+
          |  Supabase (Postgres)|
          |  10 tables + Auth   |
          +---------------------+
```

---

## 2. Agent Roles and Decision Boundaries

Each agent operates within a strictly defined scope. Agents receive structured input from the shared LangGraph state and write structured output back to it. No agent directly invokes another; all coordination flows through the orchestrator.

### 2.1 DemandAnalyst

- **Purpose:** Analyzes historical forecasts and current inventory to determine reorder quantities.
- **Inputs:** Product catalog, inventory levels, demand forecasts.
- **Outputs:** List of products requiring replenishment with recommended order quantities.
- **Decision boundary:** Determines *what* to order and *how much*, but not *from whom* or *how to ship*.
- **MCP server:** `erp-data-server` (reads products, inventory, forecasts).

### 2.2 SupplierSelector

- **Purpose:** Scores and ranks eligible suppliers for each product needing replenishment.
- **Inputs:** Demand analysis output (products and quantities), supplier catalog, scoring weights.
- **Outputs:** Ranked supplier assignments per product with scoring rationale.
- **Decision boundary:** Determines *from whom* to order based on cost, reliability, and lead time. Does not modify quantities or logistics.
- **MCP server:** `supplier-data-server` (reads suppliers, supplier_products, scoring weights).

### 2.3 ContainerOptimizer

- **Purpose:** Performs bin-packing optimization to consolidate line items into shipping containers.
- **Inputs:** Supplier-assigned line items with quantities and dimensions, container specifications.
- **Outputs:** Container allocation plan (which items go in which containers, utilization percentages).
- **Decision boundary:** Determines *how to pack* orders into containers. Does not change supplier assignments or quantities.
- **MCP server:** `logistics-server` (reads container_specs, runs bin-packing logic).

### 2.4 POCompiler

- **Purpose:** Assembles final purchase orders from optimized, supplier-assigned line items.
- **Inputs:** Container-optimized line items grouped by supplier.
- **Outputs:** Draft purchase orders with PO numbers, line items, totals, and status set to `pending_approval`.
- **Decision boundary:** Determines *the final PO structure*. Does not re-evaluate suppliers or quantities. Writes POs to the database for human review.
- **MCP server:** `po-management-server` (creates POs, writes to decision_log).

---

## 3. MCP Usage and Context Flow

### 3.1 Model Context Protocol Architecture

ProcureAI uses four TypeScript MCP servers, each exposing domain-specific tools that agents call to read from and write to the database. This design isolates data access by domain and provides a consistent tool interface for the LLM agents.

| MCP Server | Domain | Key Tools |
|---|---|---|
| `erp-data-server` | Products, inventory, forecasts | get_products, get_inventory, get_forecasts |
| `supplier-data-server` | Suppliers, scoring | get_suppliers, get_supplier_products, get_scoring_weights |
| `logistics-server` | Container specs, packing | get_container_specs, optimize_packing |
| `po-management-server` | PO lifecycle, audit | create_po, update_po_status, log_decision |

### 3.2 Invocation Mechanism

The Python backend invokes MCP servers via subprocess stdio using JSON-RPC 2.0. The MCP client (`backend/mcp_client/client.py`) spawns each server as a child process, sends JSON-RPC requests over stdin, and reads responses from stdout.

```
Agent --> MCP Client --> subprocess(node mcp-server) --> Supabase
                 stdin (JSON-RPC request)  -->
                 <-- stdout (JSON-RPC response)
```

### 3.3 Context Flow Through the Pipeline

State is passed between agents via the LangGraph shared state object. Each agent reads from upstream fields and writes to its own output field:

```
LangGraph State:
  demand_analysis     <-- written by DemandAnalyst
  supplier_selection  <-- written by SupplierSelector (reads demand_analysis)
  container_plan      <-- written by ContainerOptimizer (reads supplier_selection)
  purchase_orders     <-- written by POCompiler (reads container_plan)
  errors              <-- appended by any agent on failure
  run_id              <-- set at pipeline start, used for audit correlation
```

---

## 4. Orchestration Strategy

### 4.1 LangGraph StateGraph

The pipeline is implemented as a LangGraph `StateGraph` with four agent nodes and conditional edges. The graph executes sequentially by default:

```
START --> DemandAnalyst --> SupplierSelector --> ContainerOptimizer --> POCompiler --> END
```

### 4.2 Conditional Routing (Failure Handling)

Each transition includes a conditional check. If an upstream agent fails or produces empty output, downstream agents are skipped and the pipeline terminates early with an error recorded in state:

```
DemandAnalyst
  |-- success --> SupplierSelector
  |-- failure --> END (with error)

SupplierSelector
  |-- success --> ContainerOptimizer
  |-- failure --> END (with error)

ContainerOptimizer
  |-- success --> POCompiler
  |-- failure --> END (with error)
```

This prevents cascading failures and ensures partial results are not used to generate invalid purchase orders.

### 4.3 Human-in-the-Loop

The pipeline supports step-by-step execution with review gates:

- **Step-by-step mode:** The frontend triggers each pipeline stage individually, allowing the user to review intermediate results before proceeding.
- **Supplier override:** After SupplierSelector runs, users can manually override supplier assignments before continuing to ContainerOptimizer.
- **PO approval/rejection:** Final purchase orders are created with `pending_approval` status. Users approve or reject via `POST /pipeline/approve/:po_number`, which updates the PO status and logs the decision.

---

## 5. Data Persistence and Audit Strategy

### 5.1 Database Schema

Supabase PostgreSQL hosts 10 tables organized into three domains:

**Catalog and Inventory:**
- `products` -- 60 diesel engine parts (part number, description, unit cost, dimensions, weight)
- `suppliers` -- 6 suppliers (name, location, lead time, reliability score)
- `supplier_products` -- many-to-many mapping with supplier-specific pricing
- `forecasts` -- 720 demand forecast records (product, period, quantity)
- `inventory` -- current stock levels per product
- `container_specs` -- shipping container dimensions and weight limits
- `supplier_scoring_weights` -- configurable weights for supplier ranking criteria

**Purchase Orders:**
- `purchase_orders` -- PO header (po_number, supplier, status, total, timestamps)
- `po_line_items` -- PO detail lines (product, quantity, unit price, line total)

**Audit:**
- `decision_log` -- complete agent decision trail

### 5.2 Decision Log (Audit Trail)

Every agent writes a record to `decision_log` after each execution. This provides a complete, queryable audit trail for compliance and debugging.

| Column | Type | Description |
|---|---|---|
| `run_id` | UUID | Correlates all decisions within a single pipeline execution |
| `agent_name` | TEXT | Which agent made the decision |
| `timestamp` | TIMESTAMPTZ | When the decision was recorded |
| `inputs` | JSONB | Structured input the agent received |
| `output` | JSONB | Structured output the agent produced |
| `confidence` | FLOAT (0-1) | Agent's self-assessed confidence in the decision |
| `rationale` | TEXT | Human-readable explanation of the decision logic |
| `po_number` | TEXT | Associated PO number (nullable, set by POCompiler) |

The `run_id` field allows operators to trace every decision across all four agents for any given pipeline run. The JSONB `inputs` and `output` columns preserve the full structured data for post-hoc analysis.

### 5.3 Synthetic Data

The system ships with synthetic seed data for demonstration:
- 60 diesel engine parts across multiple categories
- 6 suppliers with varied cost, reliability, and lead-time profiles
- 720 forecast records covering 12 months of projected demand

---

## 6. Security Overview

### 6.1 Authentication and Authorization

- **Authentication:** Supabase Auth handles user authentication with email/password credentials.
- **Roles:** Two roles are defined -- `administrator` (full access) and `po_manager` (PO approval/rejection only).
- **RBAC enforcement:** Next.js middleware checks the user's role on each request and restricts access to protected routes and API endpoints accordingly.

### 6.2 Transport Security

- **HTTPS:** All traffic to Supabase (database and auth) is encrypted via TLS, provided by Supabase's managed infrastructure.
- **CORS policy:** The FastAPI backend enforces a CORS policy that restricts cross-origin requests to the frontend's origin.

### 6.3 Secrets Management

- All credentials (Supabase URL, service role key, OpenRouter API key) are stored in environment variables and loaded from `.env` files.
- `.env` files are excluded from version control via `.gitignore`.
- The frontend receives only `NEXT_PUBLIC_` prefixed variables, limiting client-side exposure.

### 6.4 Database Security

- **Row-Level Security (RLS):** RLS policies are supported by the schema but disabled for the competition demo to simplify development and judging. In a production deployment, RLS would restrict row access based on the authenticated user's role.
- **Service role key:** The backend uses the Supabase service role key (bypasses RLS) for agent operations. This key is never exposed to the frontend.

### 6.5 Production Considerations

For a production deployment beyond the competition, the following would be added:
- Enable RLS with per-role policies on all tables.
- Add rate limiting to the FastAPI endpoints.
- Implement API key rotation and secret vaulting.
- Add input validation and sanitization on all agent outputs before database writes.
- Introduce network segmentation between the MCP servers and the public-facing API.

---

*ProcureAI -- Cummins Xtern 2026*
