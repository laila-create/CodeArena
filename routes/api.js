const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const { auth, adminOnly } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

const SETTINGS = path.join(__dirname, '..', 'data', 'settings.json');
function getSettings() { return JSON.parse(fs.readFileSync(SETTINGS)); }

// ── Current user ───────────────────────────────────────
router.get('/me', auth, (req, res) => res.json({ ok: true, user: req.user }));

// ── Settings ───────────────────────────────────────────
router.get('/settings', auth, (req, res) => res.json(getSettings()));

router.post('/settings', auth, adminOnly, express.json(), (req, res) => {
  const s = req.body;
  const settings = {
    normalTimer: parseInt(s.normalTimer) || 30,
    challengeTimer: parseInt(s.challengeTimer) || 20,
    challengeLives: parseInt(s.challengeLives) || 3,
    challengeStreakThreshold: parseInt(s.challengeStreakThreshold) || 3,
    questionsPerQuiz: parseInt(s.questionsPerQuiz) || 10,
    showExplanations: s.showExplanations === true || s.showExplanations === 'true'
  };
  fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2));
  res.json({ ok: true, settings });
});

// ── Questions ──────────────────────────────────────────
router.get('/questions', auth, (req, res) => {
  let qs = db.read('questions');
  const { category, difficulty, q } = req.query;
  if (category && category !== 'all') qs = qs.filter(x => x.category === category);
  if (difficulty && difficulty !== 'all') qs = qs.filter(x => x.difficulty === difficulty);
  if (q) qs = qs.filter(x => x.question.toLowerCase().includes(q.toLowerCase()));
  res.json(qs);
});

router.post('/questions', auth, adminOnly, express.json(), (req, res) => {
  const { category, difficulty, question, code, options, answer, explanation } = req.body;
  const doc = db.insert('questions', {
    category: category.trim(), difficulty,
    question: question.trim(),
    code: code?.trim() || null,
    options: options.map(o => o.trim()),
    answer: parseInt(answer),
    explanation: explanation?.trim() || ''
  });
  res.json({ ok: true, question: doc });
});

router.put('/questions/:id', auth, adminOnly, express.json(), (req, res) => {
  const { category, difficulty, question, code, options, answer, explanation } = req.body;
  const doc = db.update('questions', req.params.id, {
    category: category.trim(), difficulty,
    question: question.trim(),
    code: code?.trim() || null,
    options: options.map(o => o.trim()),
    answer: parseInt(answer),
    explanation: explanation?.trim() || ''
  });
  res.json({ ok: true, question: doc });
});

router.delete('/questions/:id', auth, adminOnly, (req, res) => {
  db.remove('questions', req.params.id);
  res.json({ ok: true });
});

// ── Stats (admin dashboard) ────────────────────────────
router.get('/stats', auth, adminOnly, (req, res) => {
  const questions = db.read('questions');
  const users = db.read('users');
  const sessions = db.read('sessions');
  const completed = sessions.filter(s => s.status === 'completed');
  const avgScore = completed.length
    ? Math.round(completed.reduce((sum, s) => {
        const correct = (s.answers||[]).filter(a=>a.correct).length;
        const total = (s.questions||[]).length;
        return sum + (total ? correct/total*100 : 0);
      }, 0) / completed.length)
    : 0;
  const categories = [...new Set(questions.map(q => q.category))];
  const byCategory = categories.map(cat => ({
    name: cat,
    total: questions.filter(q => q.category === cat).length,
    easy: questions.filter(q => q.category === cat && q.difficulty === 'easy').length,
    medium: questions.filter(q => q.category === cat && q.difficulty === 'medium').length,
    hard: questions.filter(q => q.category === cat && q.difficulty === 'hard').length
  }));
  res.json({ questions: questions.length, users: users.length, sessions: sessions.length, avgScore, byCategory });
});

// ── Quiz Sessions ──────────────────────────────────────
router.post('/quiz/start', auth, express.json(), (req, res) => {
  const { mode, difficulty, category } = req.body;
  const settings = getSettings();
  let pool = db.read('questions');
  if (difficulty && difficulty !== 'all') pool = pool.filter(q => q.difficulty === difficulty);
  if (category && category !== 'all') pool = pool.filter(q => q.category === category);
  pool = pool.sort(() => Math.random() - 0.5).slice(0, settings.questionsPerQuiz);
  if (!pool.length) return res.json({ ok: false, error: 'No questions match your filters.' });

  const session = db.insert('sessions', {
    mode: mode === 'challenge' ? 'challenge' : 'normal',
    difficulty: difficulty || 'all',
    category: category || 'all',
    userId: req.user.id,
    questions: pool.map(q => q.id),
    answers: [],
    lives: mode === 'challenge' ? settings.challengeLives : null,
    streak: 0, bestStreak: 0, status: 'active'
  });
  res.json({ ok: true, sessionId: session.id, total: pool.length });
});

router.get('/quiz/:id', auth, (req, res) => {
  const s = db.findOne('sessions', s => s.id === req.params.id && s.userId === req.user.id);
  if (!s) return res.status(404).json({ ok: false });
  // Attach full question objects
  const allQ = db.read('questions');
  const questions = s.questions.map(qid => allQ.find(q => q.id === qid)).filter(Boolean);
  res.json({ ok: true, session: s, questions });
});

router.post('/quiz/:id/answer', auth, express.json(), (req, res) => {
  let s = db.findOne('sessions', s => s.id === req.params.id && s.userId === req.user.id);
  if (!s || s.status !== 'active') return res.status(400).json({ ok: false });

  const { questionId, selected, timeTaken } = req.body;
  const settings = getSettings();
  const allQ = db.read('questions');
  const q = allQ.find(q => q.id === questionId);
  if (!q) return res.status(400).json({ ok: false });

  const correct = selected === q.answer;
  const newStreak = correct ? s.streak + 1 : 0;
  const newBest = Math.max(s.bestStreak, newStreak);
  let newLives = s.lives;
  let status = s.status;

  if (s.mode === 'challenge' && !correct) {
    newLives--;
    if (newLives <= 0) status = 'gameover';
  }

  const answers = [...s.answers, { questionId, selected, correct, timeTaken: timeTaken || 0 }];
  const isLast = answers.length >= s.questions.length;
  if (isLast && status === 'active') status = 'completed';

  db.update('sessions', s.id, { answers, streak: newStreak, bestStreak: newBest, lives: newLives, status });

  res.json({
    ok: true, correct,
    correctIndex: q.answer,
    explanation: settings.showExplanations ? q.explanation : null,
    lives: newLives, streak: newStreak,
    gameOver: status === 'gameover',
    finished: status === 'completed' || status === 'gameover'
  });
});

router.get('/quiz/:id/results', auth, (req, res) => {
  const s = db.findOne('sessions', s => s.id === req.params.id && s.userId === req.user.id);
  if (!s) return res.status(404).json({ ok: false });
  const allQ = db.read('questions');
  const answered = s.answers || [];
  const correct = answered.filter(a => a.correct).length;
  const total = s.questions.length;
  const avgTime = answered.length
    ? Math.round(answered.reduce((sum,a) => sum + (a.timeTaken||0), 0) / answered.length) : 0;
  const review = answered.map(a => {
    const q = allQ.find(q => q.id === a.questionId);
    return q ? { ...q, selected: a.selected, correct: a.correct, timeTaken: a.timeTaken } : null;
  }).filter(Boolean);
  res.json({ ok: true, session: s, correct, total, avgTime, review,
    score: total > 0 ? Math.round(correct/total*100) : 0 });
});

// ── Categories list ────────────────────────────────────
router.get('/categories', auth, (req, res) => {
  const cats = [...new Set(db.read('questions').map(q => q.category))];
  res.json(cats);
});

// ── My Dashboard (member stats) ────────────────────────
router.get('/me/stats', auth, (req, res) => {
  const mySessions = db.read('sessions').filter(s => s.userId === req.user.id);
  const completed = mySessions.filter(s => s.status === 'completed' || s.status === 'gameover');

  const scoreOf = s => {
    const correct = (s.answers || []).filter(a => a.correct).length;
    const total = (s.questions || []).length;
    return total ? Math.round(correct / total * 100) : 0;
  };

  const scores = completed.map(scoreOf);
  const totalQuizzes = completed.length;
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const bestScore = scores.length ? Math.max(...scores) : 0;
  const bestStreak = completed.reduce((m, s) => Math.max(m, s.bestStreak || 0), 0);
  const perfectCount = scores.filter(sc => sc === 100).length;
  const challengeWins = completed.filter(s => s.mode === 'challenge' && s.status === 'completed').length;

  const byCat = {};
  completed.forEach(s => {
    const cat = (!s.category || s.category === 'all') ? 'Mixed' : s.category;
    byCat[cat] = byCat[cat] || { name: cat, count: 0, totalScore: 0 };
    byCat[cat].count++;
    byCat[cat].totalScore += scoreOf(s);
  });
  const categoryBreakdown = Object.values(byCat)
    .map(c => ({ name: c.name, count: c.count, avg: Math.round(c.totalScore / c.count) }))
    .sort((a, b) => b.count - a.count);

  const recent = completed.slice(-8).reverse().map(s => ({
    id: s.id, mode: s.mode, category: s.category, difficulty: s.difficulty,
    score: scoreOf(s),
    correct: (s.answers || []).filter(a => a.correct).length,
    total: (s.questions || []).length,
    status: s.status, createdAt: s.createdAt
  }));

  const badges = [
    { id: 'first', icon: '🥉', name: 'First Steps', desc: 'Complete your first quiz', unlocked: totalQuizzes >= 1 },
    { id: 'ten', icon: '🎯', name: 'Dedicated', desc: 'Complete 10 quizzes', unlocked: totalQuizzes >= 10 },
    { id: 'perfect', icon: '💯', name: 'Perfectionist', desc: 'Score 100% on a quiz', unlocked: perfectCount >= 1 },
    { id: 'streak', icon: '🔥', name: 'On Fire', desc: 'Reach a streak of 5+', unlocked: bestStreak >= 5 },
    { id: 'survivor', icon: '🛡️', name: 'Survivor', desc: 'Win a Challenge mode round', unlocked: challengeWins >= 1 },
    { id: 'master', icon: '👑', name: 'Arena Master', desc: '80%+ average across 3+ quizzes', unlocked: avgScore >= 80 && totalQuizzes >= 3 }
  ];

  res.json({ ok: true, totalQuizzes, avgScore, bestScore, bestStreak, perfectCount, categoryBreakdown, recent, badges });
});

// ── Leaderboard (bonus: classement de session) ─────────
router.get('/leaderboard', auth, (req, res) => {
  const sessions = db.read('sessions').filter(s => s.status === 'completed' || s.status === 'gameover');
  const users = db.read('users');
  const rows = sessions.map(s => {
    const correct = (s.answers || []).filter(a => a.correct).length;
    const total = (s.questions || []).length;
    const user = users.find(u => u.id === s.userId);
    return {
      sessionId: s.id, userId: s.userId, name: user ? user.name : 'Utilisateur',
      score: total ? Math.round(correct / total * 100) : 0,
      mode: s.mode, createdAt: s.createdAt
    };
  }).sort((a, b) => b.score - a.score || new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);
  res.json(rows);
});

// ── User Management (admin only) ───────────────────────
router.get('/users', auth, adminOnly, (req, res) => {
  const users = db.read('users').map(({ password, securityAnswer, securityQuestion, ...safe }) => ({
    ...safe,
    username: safe.username || safe.email.split('@')[0],
    phone: safe.phone || null,
    avatarUrl: safe.avatarUrl || null,
    status: safe.status || 'active'
  }));
  res.json(users);
});

router.put('/users/:id/role', auth, adminOnly, express.json(), (req, res) => {
  const { role } = req.body;
  if (!['admin', 'user'].includes(role)) return res.status(400).json({ ok: false, error: 'Invalid role.' });
  if (req.params.id === req.user.id) return res.status(400).json({ ok: false, error: "You can't change your own role." });
  const target = db.findOne('users', u => u.id === req.params.id);
  if (!target) return res.status(404).json({ ok: false, error: 'User not found.' });
  const updated = db.update('users', req.params.id, { role });
  const { password, securityAnswer, securityQuestion, ...safe } = updated;
  res.json({ ok: true, user: safe });
});

router.put('/users/:id/status', auth, adminOnly, express.json(), (req, res) => {
  const { status } = req.body;
  if (!['active', 'suspended'].includes(status)) return res.status(400).json({ ok: false, error: 'Invalid status.' });
  if (req.params.id === req.user.id) return res.status(400).json({ ok: false, error: "You can't change your own status." });
  const target = db.findOne('users', u => u.id === req.params.id);
  if (!target) return res.status(404).json({ ok: false, error: 'User not found.' });
  const updated = db.update('users', req.params.id, { status });
  const { password, securityAnswer, securityQuestion, ...safe } = updated;
  res.json({ ok: true, user: safe });
});

router.delete('/users/:id', auth, adminOnly, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ ok: false, error: "You can't delete your own account." });
  const target = db.findOne('users', u => u.id === req.params.id);
  if (!target) return res.status(404).json({ ok: false, error: 'User not found.' });
  db.remove('users', req.params.id);
  res.json({ ok: true });
});

module.exports = router;