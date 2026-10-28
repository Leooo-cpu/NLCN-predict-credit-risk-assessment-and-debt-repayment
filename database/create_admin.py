"""Tạo tài khoản admin mặc định.

Chạy từ thư mục backend:
    python ../database/create_admin.py

Hoặc:
    cd backend && python -m app.seed_admin
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from app.database import SessionLocal, init_db  # noqa: E402
from app.seed import ensure_default_users  # noqa: E402


def main() -> None:
    os.chdir(BACKEND)
    init_db()
    db = SessionLocal()
    try:
        users = ensure_default_users(db)
        print("Tài khoản mặc định (dữ liệu mô phỏng):")
        for user in users:
            print(f"  - {user.role}: {user.email}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
