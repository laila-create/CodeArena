const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const seed = require('./lib/seed');

seed();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/auth', require('./routes/auth'));
app.use('/api', require('./routes/api'));

// SPA catch-all: serve app.html for all non-auth routes
const { auth } = require('./middleware/auth');
app.get('*', (req, res) => {
  // If trying to access app without token, redirect to login
  const token = req.cookies?.token;
  if (!token) return res.redirect('/auth/login');
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.listen(PORT, () => console.log(`⚡ CodeArena → http://localhost:${PORT}`));
