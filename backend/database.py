import os

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./radar_marketplace.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_columns(table_name, columns_spec):
    """Add missing columns to a SQLite table without dropping data. No-op on non-SQLite engines."""
    if not DATABASE_URL.startswith("sqlite"):
        return
    with engine.begin() as conn:
        existing = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info({0})".format(table_name)).fetchall()}
        for col_name, col_type in columns_spec.items():
            if col_name not in existing:
                conn.exec_driver_sql("ALTER TABLE {0} ADD COLUMN {1} {2}".format(table_name, col_name, col_type))
