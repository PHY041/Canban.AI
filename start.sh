#!/bin/bash

# Kanban AI - One-shot Start Script
# Run from project root: ./start.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting Kanban AI..."
echo ""

# Check if .env exists
if [ ! -f "backend/.env" ]; then
    echo "⚠️  backend/.env not found!"
    echo "Creating from template... Please edit with your credentials:"
    cp backend/.env.example backend/.env
    echo ""
    echo "Required in backend/.env:"
    echo "  SUPABASE_URL=https://your-project.supabase.co"
    echo "  SUPABASE_KEY=your-anon-key"
    echo "  OPENAI_API_KEY=your-openai-key"
    echo ""
    echo "After editing, run ./start.sh again"
    exit 1
fi

# Ensure PATH includes homebrew
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# Kill any existing processes on our ports
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Start backend
echo "📦 Starting backend..."
cd "$SCRIPT_DIR/backend"
source venv/bin/activate
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!

# Start frontend
echo "🎨 Starting frontend..."
cd "$SCRIPT_DIR/frontend"
npm run dev -- --port 3000 &
FRONTEND_PID=$!

# Wait for servers to be ready
sleep 4

echo ""
echo "✅ =========================================="
echo "   Kanban AI is running!"
echo ""
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo "============================================"
echo ""
echo "Press Ctrl+C to stop"

# Handle shutdown
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM

# Wait for processes
wait
