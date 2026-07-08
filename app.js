/**
 * app.js — entry point. Wires up middleware, mounts routes, and serves
 * the frontend (public/) as a single-page app.
 */

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const seed = require('./lib/seed');

// Make sure the DB has at least an admin user / question bank / settings.
seed();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/auth', require('./routes/auth'));
app.use('/api', require('./routes/api'));

// SPA catch-all: any other route either serves the app shell (if logged
// in) or bounces to the login page (if not).
app.get('*', (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.redirect('/auth/login');
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.listen(PORT, () => console.log(`⚡ CodeArena → http://localhost:${PORT}`));