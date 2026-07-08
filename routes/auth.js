const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('../lib/db');
const { sign } = require('../middleware/auth');

const PUBLIC = path.join(__dirname, '..', 'public');

// Serve auth SPA
router.get('/login', (req, res) => res.sendFile(path.join(PUBLIC, 'auth.html')));
router.get('/signup', (req, res) => res.sendFile(path.join(PUBLIC, 'auth.html')));
router.get('/forgot', (req, res) => res.sendFile(path.join(PUBLIC, 'auth.html')));

// POST login
router.post('/login', express.json(), (req, res) => {
  const { email, password } = req.body;
  const user = db.findOne('users', u => u.email === email?.toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.json({ ok: false, error: 'Invalid email or password.' });
  }
  if (user.status === 'suspended') {
    return res.json({ ok: false, error: 'This account has been suspended. Contact an administrator.' });
  }
  const token = sign(user);
  res.cookie('token', token, { httpOnly: true, maxAge: 7*24*60*60*1000, sameSite: 'lax' });
  res.json({ ok: true });
});

// POST signup
router.post('/signup', express.json(), (req, res) => {
  const { name, email, password, confirm, securityQuestion, securityAnswer } = req.body;
  if (!name || !email || !password || !securityQuestion || !securityAnswer)
    return res.json({ ok: false, error: 'All fields are required.' });
  if (password !== confirm)
    return res.json({ ok: false, error: 'Passwords do not match.' });
  if (password.length < 6)
    return res.json({ ok: false, error: 'Password must be at least 6 characters.' });
  if (db.findOne('users', u => u.email === email.toLowerCase().trim()))
    return res.json({ ok: false, error: 'An account with this email already exists.' });

  const user = db.insert('users', {
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: bcrypt.hashSync(password, 10),
    role: 'user',
    securityQuestion: securityQuestion.trim(),
    securityAnswer: bcrypt.hashSync(securityAnswer.toLowerCase().trim(), 10)
  });
  const token = sign(user);
  res.cookie('token', token, { httpOnly: true, maxAge: 7*24*60*60*1000, sameSite: 'lax' });
  res.json({ ok: true });
});

// POST forgot - step 1: get security question
router.post('/forgot/question', express.json(), (req, res) => {
  const user = db.findOne('users', u => u.email === req.body.email?.toLowerCase().trim());
  if (!user) return res.json({ ok: false, error: 'No account found with that email.' });
  res.json({ ok: true, question: user.securityQuestion });
});

// POST forgot - step 2: verify answer and reset password
router.post('/forgot/reset', express.json(), (req, res) => {
  const { email, answer, newPassword, confirmPassword } = req.body;
  const user = db.findOne('users', u => u.email === email?.toLowerCase().trim());
  if (!user) return res.json({ ok: false, error: 'Account not found.' });
  if (!bcrypt.compareSync(answer?.toLowerCase().trim(), user.securityAnswer))
    return res.json({ ok: false, error: 'Incorrect answer. Try again.' });
  if (newPassword !== confirmPassword)
    return res.json({ ok: false, error: 'Passwords do not match.' });
  if (newPassword.length < 6)
    return res.json({ ok: false, error: 'Password must be at least 6 characters.' });
  db.update('users', user.id, { password: bcrypt.hashSync(newPassword, 10) });
  res.json({ ok: true });
});

// POST logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

module.exports = router;