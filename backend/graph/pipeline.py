"""
LangGraph Pipeline — Supply Chain PO Automation
Orchestrates 4 agents in sequence with error handling and human-in-the-loop.
"""
import uuid
from langgraph.graph import StateGraph, END
from graph.state import PipelineState
from agents.demand_analyst import demand_analyst_node
from agents.supplier_selector import supplier_selector_node
from agents.container_optimizer import container_optimizer_node
from agents.po_compiler import po_compiler_node


def route_after_demand(state: PipelineState) -> str:
    """Route: if demand analysis errored or found no requirements, end early."""
    if state.get('error'):
        return 'end'
    if not state.get('net_requirements'):
        return 'end'
    return 'supplier_selector'


def route_after_supplier(state: PipelineState) -> str:
    if state.get('error'):
        return 'end'
    valid = [s for s in state.get('supplier_selections', []) if s.get('supplier_id')]
    if not valid:
        return 'end'
    return 'container_optimizer'


def route_after_container(state: PipelineState) -> str:
    if state.get('error'):
        return 'end'
    return 'po_compiler'


def build_pipeline() -> StateGraph:
    """Constructs and compiles the LangGraph pipeline."""
    graph = StateGraph(PipelineState)

    # Register agent nodes
    graph.add_node('demand_analyst',     demand_analyst_node)
    graph.add_node('supplier_selector',  supplier_selector_node)
    graph.add_node('container_optimizer', container_optimizer_node)
    graph.add_node('po_compiler',        po_compiler_node)

    # Entry point
    graph.set_entry_point('demand_analyst')

    # Conditional routing
    graph.add_conditional_edges('demand_analyst',     route_after_demand,   {'supplier_selector': 'supplier_selector', 'end': END})
    graph.add_conditional_edges('supplier_selector',  route_after_supplier, {'container_optimizer': 'container_optimizer', 'end': END})
    graph.add_conditional_edges('container_optimizer', route_after_container, {'po_compiler': 'po_compiler', 'end': END})
    graph.add_edge('po_compiler', END)

    return graph.compile()


# Singleton — compiled once, reused across requests
pipeline = build_pipeline()


def run_pipeline(skus: list[str] = None, triggered_by: str = 'system', horizon: int = 3) -> PipelineState:
    """
    Runs the full PO automation pipeline.
    Returns the final state including po_number, approval_status, and all agent outputs.
    """
    initial_state: PipelineState = {
        'run_id': str(uuid.uuid4()),
        'triggered_by': triggered_by,
        'planning_horizon_months': horizon,
        'skus_to_plan': skus or [],
        'approval_status': 'pending',
        'current_agent': 'orchestrator',
    }
    final_state = pipeline.invoke(initial_state)
    return final_state
