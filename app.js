const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const seed = require('./lib/seed');

seed();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => console.log(`⚡ CodeArena → http://localhost:${PORT}`));