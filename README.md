# CanBan.AI

AI-powered Kanban board with automatic task prioritization, built for managing multiple workstreams efficiently.

## 🖥️ Desktop App (Recommended)

Download the latest release for your platform:
- **macOS (Apple Silicon)**: `CanBan.AI-x.x.x-arm64.dmg`
- **Windows**: `CanBan.AI-Setup-x.x.x.exe` *(coming soon)*
- **Linux**: `CanBan.AI-x.x.x.AppImage` *(coming soon)*

## 🚀 First-Time Setup (5 minutes)

### Step 1: Get Your API Keys (all free!)

You need 3 things. Here's exactly where to get them:

| What | Where to Get | Time |
|------|-------------|------|
| **Supabase URL** | [supabase.com](https://supabase.com) → New Project → Settings → API | 2 min |
| **Supabase Key** | Same page, copy "anon public" key | - |
| **OpenAI Key** | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) → Create new key | 1 min |

<details>
<summary>📖 Detailed instructions (click to expand)</summary>

#### Get Supabase URL & Key
1. Go to [supabase.com](https://supabase.com) → Sign up (free, no credit card)
2. Click **"New Project"** → name it "canban" → set a password → Create
3. Wait ~2 minutes for setup
4. Click **Settings** (gear icon, bottom left) → **API**
5. Copy these two values:
   - **Project URL**: looks like `https://abcdefg.supabase.co`
   - **anon public** key: the long string starting with `eyJ...`

#### Get OpenAI API Key
1. Go to [platform.openai.com](https://platform.openai.com) → Sign up
2. Click **API Keys** (left sidebar) → **"Create new secret key"**
3. Copy the key (starts with `sk-...`)
4. Note: New accounts get ~$5 free credits

</details>

### Step 2: Set Up Database

1. In Supabase, go to **SQL Editor** (left sidebar)
2. Copy everything from [`backend/supabase_schema.sql`](backend/supabase_schema.sql)
3. Paste into SQL Editor → Click **Run**
4. You should see "Success" ✓

### Step 3: Enter Keys in App

1. **Open CanBan.AI**
2. Click the **⚙️ Settings** button (top right)
3. Paste your 3 keys
4. Click **Save Settings**
5. **Restart the app**

🎉 **Done! Start managing your tasks with AI!**

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **AI Priority** | Click "AI Prioritize" → AI analyzes deadlines & complexity → auto-ranks tasks |
| **Paste & Extract** | Paste emails, syllabi, meeting notes → AI extracts tasks automatically |
| **Daily Briefing** | AI summary of your priorities and what to focus on |
| **Multi-Board** | Separate boards for Work, School, Projects, etc. |
| **Drag & Drop** | Move cards between To Do / In Progress / Done |

---

## 🛠️ For Developers

### Run from Source

```bash
# Clone
git clone https://github.com/PHY041/Canban.AI.git
cd Canban.AI

# Install
npm install
cd backend && pip install -r requirements.txt && cd ..

# Run (opens Electron app with hot-reload)
./start.sh desktop
```

### Build Desktop App

```bash
# Install PyInstaller first
pip install pyinstaller

# Build for your platform
./start.sh build

# Output: release/CanBan.AI-x.x.x.dmg
```

### Tech Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS, dnd-kit
- **Backend**: FastAPI (Python), Supabase
- **AI**: OpenAI GPT-4o-mini
- **Desktop**: Electron

---

## 📡 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/boards` | List all boards |
| `POST /api/boards` | Create board |
| `GET /api/cards/board/:id` | List cards in board |
| `POST /api/cards` | Create card |
| `POST /api/ai/prioritize` | AI prioritization |
| `POST /api/ai/extract-tasks` | Extract tasks from text |
| `GET /api/ai/daily-briefing` | Daily AI briefing |
| `GET /api/settings` | Load saved settings |
| `POST /api/settings` | Save settings to ~/.canban-ai/.env |

---

## 📄 License

MIT
