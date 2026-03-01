import os
from typing import Any, Dict

from langchain_openai import ChatOpenAI

from config import load_project_env


def get_llm(
    model: str | None = None,
    *,
    max_tokens: int = 1024,
    temperature: float = 0.2,
) -> ChatOpenAI:
    load_project_env()

    api_key = os.getenv("OPENROUTER_API_KEY")
    resolved_model = model or os.getenv("OPENROUTER_MODEL", "openrouter/free")
    if not api_key:
        raise RuntimeError(
            "OPENROUTER_API_KEY is not configured. Add it to the repo root .env or backend/.env before running the pipeline."
        )

    return ChatOpenAI(
        model=resolved_model,
        openai_api_key=api_key,
        openai_api_base="https://openrouter.ai/api/v1",
        max_tokens=max_tokens,
        temperature=temperature,
        default_headers={
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Supply Chain PO Automation",
        },
    )


def update_agent_activity(
    state: Dict[str, Any],
    agent_name: str,
    *,
    status: str,
    summary: str,
    confidence: float | None = None,
    llm_used: bool = False,
    llm_error: str | None = None,
    details: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    activity = dict(state.get("agent_activity", {}))
    activity[agent_name] = {
        "status": status,
        "summary": summary,
        "confidence": confidence,
        "llm_used": llm_used,
        "llm_error": llm_error,
        "details": details or {},
    }
    return activity
