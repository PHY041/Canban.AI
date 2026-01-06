#!/bin/bash
# Auto-start Kanban AI and open browser

cd "/Users/haoyangpang/Desktop/kanban claude/kanban-ai"
nohup ./start.sh web > /dev/null 2>&1 &
disown

# Wait for frontend to be ready, then open browser
sleep 8
open http://localhost:5173
