const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'resourcemanager_dev_secret_change_in_production';

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
}

// Only team_lead and manager can write
function requireEditor(req, res, next) {
  if (!req.user || !['team_lead', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only Team Leads and Managers can make changes.' });
  }
  next();
}

module.exports = { authenticate, requireEditor, JWT_SECRET };
