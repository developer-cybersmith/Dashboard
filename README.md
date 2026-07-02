# Mitkat Dashboard

Internal dashboard for project and employee management with live analytics.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:5173 — API runs on http://localhost:4000.

## Production

```bash
npm run build
npm start
```

## Environment variables

| Variable | Description |
|----------|-------------|
| `DEFAULT_PASSWORD` | Shared login password for authorized users |
| `PORT` | Server port (Railway sets this automatically) |

Copy `.env.example` to `.env` for local overrides.

## Deploy on Railway

1. Connect this GitHub repo to Railway
2. Build command: `npm run build`
3. Start command: `npm start`
4. Set `DEFAULT_PASSWORD` in Railway variables

Health check: `/api/health`
