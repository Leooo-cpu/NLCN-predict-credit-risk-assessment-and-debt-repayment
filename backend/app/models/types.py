from sqlalchemy import JSON
from sqlalchemy.types import TypeDecorator


class JSONType(TypeDecorator):
    """JSON portable giữa PostgreSQL (JSONB) và SQLite."""

    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import JSONB

            return dialect.type_descriptor(JSONB())
        return dialect.type_descriptor(JSON())
