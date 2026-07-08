const jwt = require('jsonwebtoken');
const db = require('../lib/db');
const SECRET = process.env.JWT_SECRET || 'codearena_jwt_2024';

function auth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.redirect('/auth/login');
  try {
    const payload = jwt.verify(token, SECRET);
    const user = db.findOne('users', u => u.id === payload.id);
    if (!user) return res.redirect('/auth/login');
    if (user.status === 'suspended') {
      res.clearCookie('token');
      return res.redirect('/auth/login');
    }
    const { password, securityAnswer, ...safe } = user;
    req.user = safe;
    next();
  } catch {
    res.clearCookie('token');
    res.redirect('/auth/login');
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).sendFile(require('path').join(__dirname,'../public/403.html'));
  next();
}

function sign(user) {
  return jwt.sign({ id: user.id }, SECRET, { expiresIn: '7d' });
}

module.exports = { auth, adminOnly, sign };