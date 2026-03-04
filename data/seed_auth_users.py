"""
Seed demo auth users into Supabase Auth.

Creates or updates:
- admin@procurepilot.demo    (administrator)
- manager1@procurepilot.demo (po_manager)
- manager2@procurepilot.demo (po_manager)

Roles are stored in user_metadata.role so the frontend middleware
can read them without an extra DB round-trip.

Usage:
    cd data
    python seed_auth_users.py
"""
from __future__ import annotations

import os
import sys
from typing import Any, Dict, Optional

import requests
from dotenv import load_dotenv

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


def headers() -> Dict[str, str]:
    return {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }


def list_users() -> list[Dict[str, Any]]:
    res = requests.get(
        f"{SUPABASE_URL}/auth/v1/admin/users",
        headers=headers(),
        params={"page": 1, "per_page": 1000},
        timeout=30,
    )
    res.raise_for_status()
    return res.json().get("users", [])


def find_by_email(users: list[Dict[str, Any]], email: str) -> Optional[Dict[str, Any]]:
    for user in users:
        if str(user.get("email", "")).lower() == email.lower():
            return user
    return None


def create_user(email: str, password: str, full_name: str, role: str) -> Dict[str, Any]:
    res = requests.post(
        f"{SUPABASE_URL}/auth/v1/admin/users",
        headers=headers(),
        json={
            "email": email,
            "password": password,
            "email_confirm": True,          # skip email verification
            "user_metadata": {
                "full_name": full_name,
                "role": role,               # read by getRole() in frontend/src/lib/auth.ts
            },
        },
        timeout=30,
    )
    res.raise_for_status()
    return res.json()


def update_user(user_id: str, password: str, full_name: str, role: str) -> Dict[str, Any]:
    res = requests.put(
        f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
        headers=headers(),
        json={
            "password": password,
            "email_confirm": True,
            "user_metadata": {
                "full_name": full_name,
                "role": role,
            },
        },
        timeout=30,
    )
    res.raise_for_status()
    return res.json()


def main() -> None:
    print("Seeding demo auth users…")
    existing_users = list_users()

    for demo in DEMO_USERS:
        existing = find_by_email(existing_users, demo["email"])
        if existing:
            update_user(existing["id"], demo["password"], demo["full_name"], demo["role"])
            action = "updated"
        else:
            create_user(demo["email"], demo["password"], demo["full_name"], demo["role"])
            action = "created"

        print(f"  ✓ {demo['email']} ({demo['role']}): {action}")

    print()
    print("Done. Log in with:")
    print("  admin@procurepilot.demo    / ChangeMe123!  (administrator)")
    print("  manager1@procurepilot.demo / ChangeMe123!  (po_manager)")
    print("  manager2@procurepilot.demo / ChangeMe123!  (po_manager)")
    print()
    print("Change passwords via DEMO_ADMIN_PASSWORD / DEMO_MANAGER1_PASSWORD /")
    print("DEMO_MANAGER2_PASSWORD env vars before running if needed.")


if __name__ == "__main__":
    main()
