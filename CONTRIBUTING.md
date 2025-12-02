# Contributing to CanBan.AI

Thank you for your interest in contributing to Kanban AI! 🎉

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/Canban.AI.git`
3. Create a branch: `git checkout -b feature/your-feature-name`

## Development Setup

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Environment Variables
Copy `.env.example` to `.env` and fill in your credentials:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Your Supabase secret key
- `OPENAI_API_KEY` - Your OpenAI API key

## Code Style

- **Python**: Follow PEP 8
- **TypeScript**: Use ESLint + Prettier
- **Commits**: Use [Conventional Commits](https://conventionalcommits.org)
  - `feat:` New feature
  - `fix:` Bug fix
  - `docs:` Documentation
  - `style:` Formatting
  - `refactor:` Code restructuring
  - `test:` Adding tests
  - `chore:` Maintenance

## Pull Request Process

1. Update README.md if needed
2. Ensure all tests pass
3. Request review from maintainers

## Questions?

Open an issue or start a discussion!

