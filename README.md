# ⚡ CodeArena

Full-stack quiz platform — Node.js + Express + plain HTML/CSS/JS + JSON storage.

## Stack
- **Backend**: Node.js + Express
- **Frontend**: Pure HTML + CSS + JavaScript (no frameworks)
- **Storage**: JSON files (no database setup required)
- **Auth**: JWT in httpOnly cookies

## Quick Start

```bash
npm install
npm start
# → http://localhost:3000
```

## Demo Account
| Field    | Value            |
|----------|------------------|
| Email    | ali@codearena.io |
| Password | admin123         |
| Role     | Admin            |

## Features
- Login / Sign Up with security question (for password recovery)
- Forgot Password — 3-step flow: email → security question → reset
- Left sidebar with: Home, Admin (Dashboard / Questions / Settings), Dark/Light mode, Logout
- Quiz: Normal mode (feedback + explanations) and Challenge mode (lives, streak, timer)
- Admin: Stats dashboard, Question CRUD with modal, Settings

## Structure
```
├── app.js
├── routes/
│   ├── auth.js       # login, signup, forgot password
│   └── api.js        # questions, sessions, settings, stats
├── middleware/auth.js # JWT cookie verification
├── lib/
│   ├── db.js         # JSON file CRUD helper
│   └── seed.js       # initial data
├── public/
│   ├── auth.html     # login/signup/forgot (pure HTML)
│   ├── app.html      # main SPA (sidebar + all pages)
│   └── 403.html
└── data/             # auto-created
    ├── users.json
    ├── questions.json
    ├── sessions.json
    └── settings.json
```

