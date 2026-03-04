"""
Seed demo auth users and matching user_profiles rows.

Creates or updates:
- admin@procurepilot.demo      (administrator)
- manager1@procurepilot.demo   (po_manager)
- manager2@procurepilot.demo   (po_manager)
"""
from __future__ import annotations

import os
import sys
from typing import Any, Dict, Optional

import requests
from dotenv import load_dotenv
from supabase import create_client


PROJECT_ROOT = os.path.join(os.path.dirname(__file__), "..")
load_dotenv(dotenv_path=os.path.join(PROJECT_ROOT, ".env"))

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SERVICE_ROLE_KEY:
    print("ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
    sys.exit(1)


DEMO_USERS = [
    {
        "email": "admin@procurepilot.demo",
        "full_name": "Admin User",
        "role": "administrator",
        "password": os.getenv("DEMO_ADMIN_PASSWORD", "ChangeMe123!"),
    },
    {
        "email": "manager1@procurepilot.demo",
        "full_name": "PO Manager One",
        "role": "po_manager",
        "password": os.getenv("DEMO_MANAGER1_PASSWORD", "ChangeMe123!"),
    },
    {
        "email": "manager2@procurepilot.demo",
        "full_name": "PO Manager Two",
        "role": "po_manager",
        "password": os.getenv("DEMO_MANAGER2_PASSWORD", "ChangeMe123!"),
    },
]


def auth_admin_headers() -> Dict[str, str]:
    return {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }


def list_auth_users() -> list[Dict[str, Any]]:
    response = requests.get(
        f"{SUPABASE_URL}/auth/v1/admin/users",
        headers=auth_admin_headers(),
        params={"page": 1, "per_page": 1000},
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    return payload.get("users", [])


def find_user_by_email(users: list[Dict[str, Any]], email: str) -> Optional[Dict[str, Any]]:
    target = email.lower()
    for user in users:
        if str(user.get("email", "")).lower() == target:
            return user
    return None


def create_auth_user(email: str, password: str, full_name: str) -> Dict[str, Any]:
    response = requests.post(
        f"{SUPABASE_URL}/auth/v1/admin/users",
        headers=auth_admin_headers(),
        json={
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"full_name": full_name},
        },
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def update_auth_user(user_id: str, password: str, full_name: str) -> Dict[str, Any]:
    response = requests.put(
        f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
        headers=auth_admin_headers(),
        json={
            "password": password,
            "email_confirm": True,
            "user_metadata": {"full_name": full_name},
        },
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def main() -> None:
    print("Seeding demo auth users...")
    users = list_auth_users()
    admin_client = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)

    for user in DEMO_USERS:
        existing = find_user_by_email(users, user["email"])
        if existing:
            auth_user = update_auth_user(existing["id"], user["password"], user["full_name"])
            action = "updated"
        else:
            auth_user = create_auth_user(user["email"], user["password"], user["full_name"])
            action = "created"

        auth_user_id = auth_user.get("id")
        if not auth_user_id:
            print(f"ERROR: No user id returned for {user['email']}")
            continue

        admin_client.table("user_profiles").upsert(
            {
                "user_id": auth_user_id,
                "email": user["email"],
                "full_name": user["full_name"],
                "role": user["role"],
            }
        ).execute()
        print(f"  - {user['email']} ({user['role']}): {action}")

    print("Done. Demo users are ready.")


if __name__ == "__main__":
    main()

