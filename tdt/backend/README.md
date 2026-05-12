## TDT backend (FastAPI BFF)

### Run locally

Create a venv (optional) and install deps:

```bash
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
```

Start the server:

```bash
uvicorn app.main:app --reload --port 8000
```

### Auth (mock)

The API expects a header: `X-User-Email`. The frontend sets it from localStorage.

### Routes

- `GET /api/routes`: list available routes
- `POST /api/routes`: create a route (name + pubs in order)
- `POST /api/routes/join`: join a route (required before calling `/api/route` or `/api/state`)

### MongoDB placeholders

The backend currently uses an in-memory store, but these environment variables are prepared for a MongoDB persistence layer:

- `MONGODB_URI` (default: `mongodb://localhost:27017`)
- `MONGODB_DB` (default: `tdt`)
- `MONGODB_USERS_COLLECTION` (default: `users`)
- `MONGODB_ROUTES_COLLECTION` (default: `routes`)
- `MONGODB_CHAT_COLLECTION` (default: `chat`)
- `MONGODB_EVENTS_COLLECTION` (default: `events`)

