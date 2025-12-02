# Canban.AI

AI-powered Kanban board with automatic task prioritization, built for managing multiple workstreams efficiently.

## Features

- **AI Priority Engine**: Automatically prioritizes tasks based on deadlines, complexity, and patterns
- **AI Text Extraction**: Paste any text (emails, syllabus, meeting notes) and AI extracts tasks automatically
- **Daily Briefing**: AI-generated summary of your priorities and suggestions
- **Drag & Drop**: Intuitive card movement between columns
- **Multi-Board Support**: Manage multiple projects/modules in one place
- **Board Management**: Add, edit, and delete boards with custom colors
- **Smart Suggestions**: Get AI-powered recommendations for any task

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, dnd-kit
- **Backend**: FastAPI (Python), Supabase
- **AI**: OpenAI GPT-4o-mini

## Quick Start

### 1. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the schema from `backend/supabase_schema.sql`
3. Copy your project URL and anon key from Settings > API

### 2. Configure Environment

Backend:
```bash
cd backend
cp .env.example .env
# Edit .env with your credentials:
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_KEY=your-anon-key
# OPENAI_API_KEY=your-openai-key
```

Frontend:
```bash
cd frontend
cp .env.example .env
# Edit if needed (default: http://localhost:8000)
```

### 3. Run Backend

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

API will be available at http://localhost:8000

### 4. Run Frontend

```bash
cd frontend
npm install
npm run dev
```

App will be available at http://localhost:5173

## API Endpoints

### Boards
- `GET /api/boards` - List all boards
- `POST /api/boards` - Create board
- `PUT /api/boards/:id` - Update board
- `DELETE /api/boards/:id` - Delete board

### Cards
- `GET /api/cards/board/:boardId` - List cards in board
- `POST /api/cards` - Create card
- `PUT /api/cards/:id` - Update card
- `DELETE /api/cards/:id` - Delete card
- `POST /api/cards/:id/move` - Move card

### AI
- `POST /api/ai/prioritize` - AI prioritization
- `POST /api/ai/suggest` - Get suggestions for card
- `GET /api/ai/daily-briefing` - Daily briefing
- `POST /api/ai/extract-tasks` - Extract tasks from pasted text
- `POST /api/ai/create-extracted-tasks` - Create cards from extracted tasks

## AI Features

### Paste & Extract
Click "Paste & Extract" button, paste any text (emails, syllabus, meeting notes), and AI will:
- Extract actionable tasks with titles
- Detect deadlines from natural language ("next Tuesday", "Dec 15")
- Estimate priority based on urgency words
- Suggest time estimates and tags
- Preview before creating cards

## Default Boards

The schema creates these boards by default:
- Work (canmarket.ai)
- Research - Stanford
- Research - Mobile/Android
- Module 1-6 (University courses)

## License

MIT
