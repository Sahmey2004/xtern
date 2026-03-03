# Supply Chain PO Automation — Setup Guide

## Prerequisites
- Node.js 18+
- Python 3.11+
- A Supabase account (free tier): https://supabase.com
- An OpenAI API account: https://platform.openai.com

## 1. Create your .env file

Create `.env` in the repo root (or `backend/.env` as a fallback) with these values:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

Get Supabase keys from: Supabase Dashboard → Project Settings → API
Get OpenAI key from: https://platform.openai.com/api-keys

## 2. Create frontend/.env.local

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

## 3. Set up Supabase schema

In Supabase Dashboard → SQL Editor, run the contents of:
`supabase/schema.sql`

## 4. Seed the database

```bash
cd data
pip install supabase python-dotenv
python seed_data.py
```

Expected output: 60 products, 6 suppliers, ~195 supplier-products, 720 forecasts, 60 inventory records

## 5. Start the backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Test: http://localhost:8000/health

## 6. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open: http://localhost:3000

## 7. Run your first pipeline

1. Go to http://localhost:3000/pipeline
2. Select some SKUs (or leave empty for auto-selection)
3. Click "Run Pipeline"
4. Watch agents execute (takes ~30-60s)
5. Go to /approvals to review and approve the draft PO
6. Go to /logs to see the full audit trail

## Verifying things work

```bash
# Backend health
curl http://localhost:8000/health

# Supabase + OpenAI test
curl http://localhost:8000/test-supabase
curl http://localhost:8000/test-openai

# Data counts
curl http://localhost:8000/data-summary
```
