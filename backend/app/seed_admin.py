from app.database import SessionLocal, init_db
from app.seed import ensure_default_users


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        users = ensure_default_users(db)
        for user in users:
            print(f"{user.role}: {user.email}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
