# CanBan.AI

AI-powered Kanban board with automatic task prioritization, built for managing multiple workstreams efficiently.

## 🖥️ Desktop App (Recommended)

Download the latest release for your platform:
- **macOS**: `CanBan.AI-x.x.x.dmg`
- **Windows**: `CanBan.AI-Setup-x.x.x.exe`
- **Linux**: `CanBan.AI-x.x.x.AppImage`

Or build from source (see [Build Desktop App](#build-desktop-app) section).

### First-Time Setup (5 minutes)

After installing, you need to configure 3 API keys. Here's how to get them:

#### 1️⃣ Get Supabase URL & Key (Free)
1. Go to [supabase.com](https://supabase.com) → Sign up (free)
2. Click "New Project" → name it anything (e.g., "canban")
3. Wait ~2 min for setup, then go to **Settings** (gear icon) → **API**
4. Copy:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public** key: `eyJhbGci...` (the long one)

#### 2️⃣ Set Up Database Tables
1. In Supabase, go to **SQL Editor** (left sidebar)
2. Paste the contents of `backend/supabase_schema.sql`
3. Click **Run** ✓

#### 3️⃣ Get OpenAI API Key (~$5 credit free)
1. Go to [platform.openai.com](https://platform.openai.com) → Sign up
2. Go to **API Keys** → "Create new secret key"
3. Copy the key starting with `sk-...`

#### 4️⃣ Save Your Keys
Create a file at `~/.canban-ai/.env`:
```bash
mkdir -p ~/.canban-ai
nano ~/.canban-ai/.env
```
Add these lines (replace with your keys):
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
OPENAI_API_KEY=sk-your-openai-key
```
Save with `Ctrl+O`, `Enter`, `Ctrl+X`

🎉 **Done! Open CanBan.AI and start managing tasks!**

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

App will be available at http://localhost:5173 (uses this port to avoid conflicts with common ports like 3000)

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

## Build Desktop App

### Prerequisites
- Node.js 18+
- Python 3.9+
- PyInstaller (`pip install pyinstaller`)

### Development Mode
```bash
# Install dependencies
npm install
cd backend && pip install -r requirements.txt && cd ..

# Option 1: Quick start script
./start.sh desktop

# Option 2: npm command
npm run dev:electron
```

### Build for Distribution
```bash
# Quick build script
./start.sh build

# Or build for specific platform
npm run dist:mac    # macOS .dmg
npm run dist:win    # Windows .exe
npm run dist:linux  # Linux .AppImage
```

Built apps will be in the `release/` folder. Share the `.dmg`/`.exe` file via email or upload to GitHub Releases.

### App Icons
Place your icons in `assets/`:
- `icon.png` (512x512, for Linux)
- `icon.icns` (for macOS) - generate at https://cloudconvert.com/png-to-icns
- `icon.ico` (for Windows) - generate at https://cloudconvert.com/png-to-ico

## License

MIT
