const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authenticate } = require('../middleware/auth');

// GET /api/audit-log
router.get('/', authenticate, (req, res) => {
  try {
    const { entity_type, user_id, limit = 100, offset = 0 } = req.query;

    let query = 'SELECT * FROM audit_log WHERE 1=1';
    const params = [];

    if (entity_type) {
      query += ' AND entity_type = ?';
      params.push(entity_type);
    }
    if (user_id) {
      query += ' AND user_id = ?';
      params.push(user_id);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const logs = db.prepare(query).all(...params);
    const parsed = logs.map(l => ({
      ...l,
      details: l.details ? JSON.parse(l.details) : null,
    }));

    const total = db.prepare(
      'SELECT COUNT(*) as count FROM audit_log' +
      (entity_type || user_id ? ' WHERE ' + [entity_type ? 'entity_type = ?' : '', user_id ? 'user_id = ?' : ''].filter(Boolean).join(' AND ') : '')
    ).get(...[entity_type, user_id].filter(Boolean));

    res.json({ logs: parsed, total: total ? total.count : 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
