"""Versioned, transactional migrations used by the existing init_db lifecycle."""
from sqlalchemy import String, inspect, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SchemaMigration(Base):
    __tablename__ = "schema_migrations"
    version: Mapped[str] = mapped_column(String(128), primary_key=True)


def apply_migrations(engine) -> None:
    version = "20261108_two_active_roles"
    with engine.begin() as connection:
        postgres = connection.dialect.name == "postgresql"
        if postgres:
            # Serialize startup across backend workers/replicas.
            connection.execute(text("SELECT pg_advisory_xact_lock(2026110801)"))
        if connection.execute(text("SELECT version FROM schema_migrations WHERE version = :version"), {"version": version}).first():
            return
        if postgres:
            for check in inspect(connection).get_check_constraints("users"):
                if "role" in check["sqltext"].lower():
                    name = connection.dialect.identifier_preparer.quote(check["name"])
                    connection.execute(text(f"ALTER TABLE users DROP CONSTRAINT {name}"))
        # Keep user IDs, credentials and all historical foreign keys intact.
        connection.execute(text("UPDATE users SET role = 'OFFICER' WHERE role = 'CREDIT_OFFICER'"))
        connection.execute(text("UPDATE users SET is_active = false WHERE role IN ('VIEWER', 'RISK_VIEWER')"))
        if postgres:
            connection.execute(text("""ALTER TABLE users ADD CONSTRAINT users_role_check
                CHECK (role IN ('ADMIN', 'OFFICER') OR
                       (role IN ('VIEWER', 'RISK_VIEWER') AND is_active = false))"""))
        connection.execute(text("INSERT INTO schema_migrations (version) VALUES (:version)"), {"version": version})
