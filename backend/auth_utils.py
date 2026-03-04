from __future__ import annotations

import os
from functools import lru_cache
from typing import Any, Callable, Dict

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client, create_client

from config import load_project_env


load_project_env()

security = HTTPBearer(auto_error=False)


@lru_cache(maxsize=1)
def get_service_supabase_client() -> Client:
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not service_key:
        raise RuntimeError("Supabase is not configured. Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.")
    return create_client(url, service_key)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> Dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token.")

    client = get_service_supabase_client()
    token = credentials.credentials

    try:
        auth_resp = client.auth.get_user(token)
        user = getattr(auth_resp, "user", None)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid auth token: {exc}") from exc

    if user is None or not getattr(user, "id", None):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unable to resolve authenticated user.")

    profile_resp = (
        client.table("user_profiles")
        .select("user_id,email,full_name,role")
        .eq("user_id", str(user.id))
        .limit(1)
        .execute()
    )
    profile = (profile_resp.data or [None])[0]
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No user profile found for this account. Run data/seed_users.py or create a profile.",
        )

    return {
        "user_id": profile["user_id"],
        "email": profile.get("email") or getattr(user, "email", ""),
        "full_name": profile.get("full_name") or getattr(user, "email", "Unknown User"),
        "role": profile.get("role", "po_manager"),
    }


def require_roles(*roles: str) -> Callable[[Dict[str, Any]], Dict[str, Any]]:
    def dependency(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        if user.get("role") not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this resource.")
        return user

    return dependency

