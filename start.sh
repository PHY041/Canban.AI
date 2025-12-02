#!/bin/bash

# Kanban AI - One-shot Start Script
# Run from project root: ./start.sh [web|desktop|build]

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
MODE="${1:-web}"

if [ "$MODE" = "desktop" ]; then # Desktop app dev mode
    echo "🖥️  Starting Kanban AI Desktop..."
    npm run dev:electron
    exit 0
elif [ "$MODE" = "build" ]; then # Build desktop app for distribution
    echo "📦 Building Kanban AI Desktop App..."
    npm run dist
    echo "✅ Build complete! Check release/ folder"
    exit 0
fi

echo "🚀 Starting Kanban AI (Web Mode)..."
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

# Kill any existing processes on our ports (using 5173 to avoid conflicts with common ports like 3000)
lsof -ti:51723 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# Start backend
echo "📦 Starting backend..."
cd "$SCRIPT_DIR/backend"
source venv/bin/activate
uvicorn app.main:app --reload --port 51723 &
BACKEND_PID=$!

# Start frontend (port 5173 - Vite default, avoids conflict with common dev ports)
echo "🎨 Starting frontend..."
cd "$SCRIPT_DIR/frontend"
npm run dev -- --port 5173 &
FRONTEND_PID=$!

sleep 4
echo ""
echo "✅ =========================================="
echo "   Kanban AI is running!"
echo ""
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:51723"
echo "   API Docs: http://localhost:51723/docs"
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
