#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "Iniciando MapaSeller..."
echo "Backend: http://localhost:8000/docs"
echo "Frontend: http://localhost:5173"
echo ""

cleanup() {
  echo ""
  echo "Encerrando backend e frontend..."
  jobs -p | xargs -r kill
}

trap cleanup EXIT INT TERM

(
  cd backend
  source .venv/bin/activate
  uvicorn main:app --reload --reload-dir . --reload-exclude ".venv/*" --port 8000
) &

(
  cd frontend
  npm run dev
) &

wait
