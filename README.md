# Contextual AI Assistant

Upload a text file — a policy, a spec, a how-to guide — and ask questions about it. Answers come only from what you uploaded, and you always see the source snippets the answer was pulled from.

No API key? It still runs. Without a Gemini key the app uses a built-in mock mode so you can try the full flow locally.

---

## What it does

1. You upload a `.txt` file (or paste text and click **Ingest text**).
2. The backend splits the document into chunks, embeds them, and stores them in memory.
3. You ask a question. The app finds the most relevant chunks and sends them to Gemini (or the mock provider).
4. You get an answer plus citations — the actual text it used.

Each new ingest replaces the previous document. There is no database; everything lives in memory until you restart the server or hit **Clear**.

---

## Run it with Docker

Easiest way to get both services up:

```bash
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000).

To use real Gemini responses, copy the env file and add your key:

```bash
cp .env.example .env
```

```env
GEMINI_API_KEY=your_key_here
GEMINI_CHAT_MODEL=gemini-2.0-flash
GEMINI_EMBED_MODEL=gemini-embedding-001
```

Docker Compose reads `.env` automatically. Leave `GEMINI_API_KEY` empty for mock mode.

Get a key from [Google AI Studio](https://aistudio.google.com/apikey).

---

## Run it locally

You need Node 20+ and two terminals.

**Backend** (port 4000):

```bash
cd backend
cp .env.example .env   # optional — add GEMINI_API_KEY for real AI
npm install
npm run dev
```

**Frontend** (port 3000):

```bash
cd frontend
npm install
npm run dev
```

The frontend talks to `http://localhost:4000` by default. Change that in `frontend/.env.local` if your backend runs somewhere else:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

---

## Environment variables

| Variable | Where | Default | Notes |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | backend | _(empty)_ | Set this for Gemini. Empty = mock mode. |
| `GEMINI_CHAT_MODEL` | backend | `gemini-2.0-flash` | Model used to generate answers. |
| `GEMINI_EMBED_MODEL` | backend | `gemini-embedding-001` | Model used for embeddings. |
| `PORT` | backend | `4000` | Backend port. |
| `NEXT_PUBLIC_API_BASE_URL` | frontend | `http://localhost:4000` | Baked in at build time for Docker. |

---

## How the pieces fit together

```
Browser (Next.js)  →  Express API  →  chunk → embed → vector store
                                    →  query → retrieve → generate → answer + citations
```

| Service | Stack | Port |
| --- | --- | --- |
| backend | Node 20, TypeScript, Express | 4000 |
| frontend | Next.js 14, TypeScript, Tailwind | 3000 |

The RAG logic lives in the backend on purpose — you can hit it with `curl`, swap the UI later, or scale it independently. Vectors stay in memory because this tool is built around one document at a time; a full vector DB would be overkill here.

`provider.ts` handles the AI layer. With a Gemini key it calls Google's API. Without one it falls back to local embeddings and a simple extractive answer so demos work offline.

---

## API

Handy for testing without the UI.

**Ingest** — JSON or a `.txt` file upload:

```bash
curl -X POST http://localhost:4000/api/ingest \
  -H 'Content-Type: application/json' \
  -d '{"text":"Employees get 20 days of paid leave per year.","source":"policy.txt"}'
```

Or upload a file:

```bash
curl -X POST http://localhost:4000/api/ingest \
  -F "file=@./my-doc.txt"
```

**Query**:

```bash
curl -X POST http://localhost:4000/api/query \
  -H 'Content-Type: application/json' \
  -d '{"question":"How many paid leave days are there?"}'
```

**Reset** — clear the knowledge base:

```bash
curl -X POST http://localhost:4000/api/reset
```

**Health check**:

```bash
curl http://localhost:4000/health
# {"status":"ok","mode":"gemini"}  or  "mock"
```

---

## Project layout

```
.
├── docker-compose.yml
├── .env.example
├── backend/
│   └── src/
│       ├── index.ts        # Express app, CORS, error handling
│       ├── routes.ts       # /api/ingest, /api/query, /api/reset
│       ├── chunker.ts      # splits text into overlapping chunks
│       ├── vectorStore.ts  # in-memory cosine search
│       └── provider.ts     # Gemini + mock fallback
└── frontend/
    ├── app/page.tsx        # UI
    └── lib/api.ts          # backend client
```

---

## Troubleshooting

**"Could not reach the Gemini API"** — usually a network blip. Retry in a minute. Check VPN or firewall if it keeps happening.

**503 / high demand** — Gemini is busy. Wait and retry, or switch to `gemini-2.0-flash` in `.env`.

**Upload fails** — only plain `.txt` files, max 1 MB.

**Knowledge base empty after restart** — expected. Ingest your document again.
