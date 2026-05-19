<claude-mem-context>
# Memory Context

# [Startup] recent context, 2026-05-19 12:29am GMT-3

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (21,640t read) | 1,765,393t work | 99% savings

### May 18, 2026
390 4:10p 🟣 Backend Database Layer Implemented: database.py and models.py
391 " 🟣 Scoring Algorithm Implemented in backend/scoring.py
392 " 🟣 Marketplace Adapter Abstract Base Class Created
393 " 🟣 All Four Marketplace Mock Adapters Implemented
394 " 🟣 Pydantic ProductOut Schema Created for API Serialization
395 4:27p 🔴 Python 3.9 Compatibility: Replaced Union Pipe Syntax with typing.Optional
396 " 🟣 XLSX Importer Complete Rewrite for Real-World FM Auto Peças Spreadsheets
397 " 🟣 Scoring Logic Revamped: Negative Stock Status, Sales-Heavy Weighting, Missing Data Penalties
398 " 🟣 New API Endpoints: XLSX Preview, DELETE /products, Negative Stock Dashboard Metric
399 " 🟣 Import Page Redesigned with Preview Workflow and Clear Products Button
425 4:51p ✅ Brand Rename: "Radar Marketplace FM" → "MapaSeller"
413 5:05p 🔵 Radar Marketplace FM — MVP state and XLSX import bug scope
414 " 🔵 Radar FM backend current state — importer, scoring, and API endpoints
415 5:06p 🔵 Frontend and tools audit — UI already handles BRL, negative stock, and clear button
416 5:10p 🔵 Radar Marketplace FM — MVP State and Import Bug Scope
417 " 🔵 Git Status — Unstaged Modifications Across All Core Backend Files
418 5:11p 🟣 importer.py — Full Rewrite with Sheet-Type Detection and Period-Total Division
419 " 🟣 New CLI Diagnostic Tool: backend/tools/inspect_xlsx.py
420 5:12p 🟣 Added POST /preview-xlsx Alias Endpoint in main.py
421 " 🟣 ImportPage Preview Table — Negative Stock Highlighting and BRL Currency Formatting
422 5:13p 🔵 All Six Backend Modules Pass Python Compile Check
423 5:14p 🔵 inspect_xlsx.py Validated Against Sample File — All Fields Correctly Mapped
424 5:15p 🔵 Real FM "Vendidos Ultimos 2 meses.xlsx" Diagnosed — 494 Valid Products, Correct Type and Mapping
S55 Radar Marketplace FM — Fix XLSX import bugs: SKU as float, vendas_60d=0, period-total prices, negative stock alerts, unreliable score (May 18 at 5:15 PM)
426 5:33p 🔵 Brand Rename Scope: All Remaining "Radar Marketplace FM" Occurrences Found
427 " ✅ Brand Rename Completed: "Radar Marketplace FM" → "MapaSeller"
428 5:37p 🔵 Multi-Sheet XLSX: preview_xlsx Only Reading One Sheet, Not All 73 Tables
429 5:38p 🔵 Root Cause Confirmed: preview_xlsx Reads Only Best Single Sheet, Not All 73
430 " 🔴 Fixed: preview_xlsx and read_xlsx Now Aggregate All Sheets Instead of Single Best Sheet
431 " ✅ inspect_xlsx.py Updated: Per-Sheet Diagnostics Display + Brand Rename
432 " 🔵 Spreadsheet Structure Confirmed: 73 Sheets, Consistent Schema, ~24 Products Per Sheet
433 5:39p 🔴 Multi-Sheet Import Fix Verified: 1,963 Products From 73 Sheets
434 9:50p 🔵 MapaSeller Project Pre-Implementation State Captured
435 " 🔵 MapaSeller Backend Architecture Gaps Identified Before Merge Implementation
436 9:51p 🔵 Estoque 15.05.xlsx Completely Fails to Parse — 0 Valid Products Across All 4 Sheets
437 9:52p 🔵 Estoque XLSX Raw Structure Fully Mapped — Two Distinct Column Layouts Across 4 Sheets
438 " 🔵 Live SQLite Database Confirmed: 1963 Products, 14 Columns, No Merge Fields Yet
439 " 🟣 models.py Extended With 9 Merge-Tracking Columns and PRODUCT_EXTRA_COLUMNS Dict
440 9:53p 🟣 database.py Gets ensure_columns() — Safe SQLite Column Migration Without Data Loss
441 9:56p 🟣 importer.py Completely Overhauled — Estoque Parser, SKU Normalization, and Code Extraction Added
442 9:57p 🟣 scoring.py Rewritten — classify_alerta(), classify_estoque_status() Added, Score Penalties Reworked
443 " 🟣 schemas.py ProductOut Extended With 9 Merge-Tracking Fields
444 " 🟣 MapaSeller Intelligent XLSX Merge — Full Implementation Specification
445 10:05p 🔴 classify_alerta() signature corrected — estoque_status parameter removed
446 " 🔴 SQLAlchemy filter ternary ambiguity fixed in leftover query
447 " 🟣 Vendidos XLSX parsing validated — 73 sheets, all detected correctly
448 " 🔵 Estoque 15.05.xlsx parsing validated — 4 sheets, all detected as estoque type
449 " 🟣 End-to-end merge simulation validated — 1826 vendidos + 3219 estoque = 4148 final products
450 10:06p 🔴 _find_existing() fixed — nome fallback disabled when SKU is present but unmatched
451 " 🔵 Tightened match logic results — nome_match_fraco eliminated, pure SKU matching only
452 10:07p 🟣 Frontend formatters.js updated with new alert/status tone and recommendation functions

Access 1765k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>