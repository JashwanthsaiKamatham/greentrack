# GreenTrack - Carbon Footprint and Sustainable Resource Management Platform

GreenTrack helps urban communities, small businesses and campuses **track, measure and reduce** their environmental impact.

## Features

- **Carbon dashboard** - daily / weekly / monthly CO2e from commute, energy, food, waste, water and shopping, with trend chart, category breakdown and a monthly carbon budget.
- **Smart resource logger** - log electricity bills, water use, landfill waste and recycling with live progress rings against your own monthly targets and a 6-month history.
- **Eco-action challenges** - join community challenges (zero-plastic week, energy-saving days...), check in daily, see collective impact, create your own, and climb the leaderboard.
- **AI insights (Google Gemini)** - personalised recommendations from your logged data, one-tap AI summaries of entries, an eco-coach you can ask anything, and AI-drafted challenges.
- **Gamification** - eco-points, levels, streaks and badges.
- **Accounts** - email + password (bcrypt hashed), JWT sessions that work across devices.

## Tech stack

| Part | Tech |
| --- | --- |
| Frontend (`client/`) | React, Vite, Tailwind CSS, Recharts |
| Backend (`server/`) | Node.js, Express |
| Database | Supabase (Postgres) with Row Level Security |
| AI | Google Gemini, called from the backend only |

## Project structure

```
client/   what users see (no secrets here - only VITE_API_BASE_URL)
server/   the brain: API, auth, database access, AI (all keys live in server/.env)
```

## Run locally

```bash
# 1. Backend
cd server
cp .env.example .env      # fill in your keys
npm install
npm run setup-db          # creates tables, RLS policies and starter challenges (one time)
npm run dev               # http://localhost:4000

# 2. Frontend (new terminal)
cd client
npm install
npm run dev               # http://localhost:5173
```

Without Supabase keys the server starts in an in-memory demo mode (development only).

## API overview

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/auth/signup`, `/api/auth/login` | Create account / log in |
| GET | `/api/auth/me` | Current user |
| PUT | `/api/profile` | Update name and targets |
| GET/POST | `/api/items` | List / create logged entries |
| PUT/DELETE | `/api/items/:id` | Edit / delete your own entry |
| GET | `/api/stats` | Dashboard numbers |
| GET/POST | `/api/challenges` | List / create challenges |
| POST/DELETE | `/api/challenges/:id/join` | Join / leave |
| POST | `/api/challenges/:id/checkin` | Daily check-in |
| GET | `/api/challenges/leaderboard` | Community leaderboard |
| POST | `/api/ai/generate` | Gemini: `insights`, `summarize`, `assist`, `challenge_idea` |

## Security

- Secrets live only in `server/.env`, which is git-ignored.
- Passwords are hashed with bcrypt; the hash is never sent to the browser.
- The backend checks ownership on every read and write; RLS blocks direct access with the public anon key.
- CORS only allows the deployed frontend (`CLIENT_URL`); rate limiting and Helmet are enabled.

## Deployment

- Backend: Render web service, root directory `server`, start command `npm start`.
- Frontend: Vercel, root directory `client`, env var `VITE_API_BASE_URL` = Render URL.

Emission factors are rounded averages meant for awareness, not certified carbon accounting.
