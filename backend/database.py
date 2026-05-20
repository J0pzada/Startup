import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


DEFAULT_SQLITE_URL = "sqlite:///./radar_marketplace.db"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_SQLITE_URL).strip() or DEFAULT_SQLITE_URL

# Normaliza esquema padrão do Supabase/Heroku (postgres://) para SQLAlchemy.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql+psycopg2://" + DATABASE_URL[len("postgres://"):]
elif DATABASE_URL.startswith("postgresql://") and "+" not in DATABASE_URL.split("://", 1)[0]:
    DATABASE_URL = "postgresql+psycopg2://" + DATABASE_URL[len("postgresql://"):]

IS_SQLITE = DATABASE_URL.startswith("sqlite")
IS_POSTGRES = DATABASE_URL.startswith("postgresql")

connect_args = {"check_same_thread": False} if IS_SQLITE else {}
engine_kwargs = {"connect_args": connect_args}
if IS_POSTGRES:
    engine_kwargs.update({"pool_pre_ping": True, "pool_size": 5, "max_overflow": 5})

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_columns(table_name, columns_spec):
    """Add missing columns to a SQLite/Postgres table without dropping data.

    Em produção Postgres a fonte de verdade é supabase/migrations. Esta função
    cobre dev SQLite e bootstrap simples em Postgres. Usa ADD COLUMN IF NOT EXISTS
    quando suportado, e PRAGMA table_info no SQLite.
    """
    if IS_SQLITE:
        with engine.begin() as conn:
            existing = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info({0})".format(table_name)).fetchall()}
            for col_name, col_type in columns_spec.items():
                if col_name not in existing:
                    conn.exec_driver_sql("ALTER TABLE {0} ADD COLUMN {1} {2}".format(table_name, col_name, col_type))
        return

    if IS_POSTGRES:
        with engine.begin() as conn:
            for col_name, col_type in columns_spec.items():
                conn.exec_driver_sql(
                    "ALTER TABLE {0} ADD COLUMN IF NOT EXISTS {1} {2}".format(table_name, col_name, col_type)
                )
        return


def get_database_info():
    return {
        "url_kind": "postgres" if IS_POSTGRES else ("sqlite" if IS_SQLITE else "other"),
        "is_sqlite": IS_SQLITE,
        "is_postgres": IS_POSTGRES,
    }
