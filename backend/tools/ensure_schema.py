"""
Manual schema migration script.

Run once after deploying a new backend version that added model columns:

    cd backend
    python tools/ensure_schema.py

This is the safe alternative to RUN_STARTUP_MIGRATIONS=1.
It runs ensure_columns for every table that needs incremental columns,
with full logging and individual try/except per column so a single timeout
never aborts the whole run.
"""
import sys
import os
import logging

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

# Ensure backend root is on the path when run from the repo root.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import ensure_columns, engine, IS_POSTGRES, IS_SQLITE
from models import MARKETPLACE_SNAPSHOT_EXTRA_COLUMNS, PRODUCT_EXTRA_COLUMNS

log.info("Database kind: %s", "postgres" if IS_POSTGRES else ("sqlite" if IS_SQLITE else "other"))
log.info("Applying incremental columns to 'products' (%d columns)...", len(PRODUCT_EXTRA_COLUMNS))
ensure_columns("products", PRODUCT_EXTRA_COLUMNS)

log.info("Applying incremental columns to 'marketplace_snapshots' (%d columns)...", len(MARKETPLACE_SNAPSHOT_EXTRA_COLUMNS))
ensure_columns("marketplace_snapshots", MARKETPLACE_SNAPSHOT_EXTRA_COLUMNS)

log.info("Done.")
