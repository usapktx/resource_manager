const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db } = require('../database');
const { authenticate, requireEditor } = require('../middleware/auth');

// GET all users (any authenticated user can view the list)
router.get('/', authenticate, (req, res) => {
  try {
    const users = db.prepare(
      'SELECT id, username, full_name, email, role, force_password_reset, created_at FROM users ORDER BY full_name'
    ).all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create user (team_lead or manager only)
router.post('/', authenticate, requireEditor, (req, res) => {
  try {
    const { username, password, full_name, email, role } = req.body;
    if (!username || !password || !full_name || !role) {
      return res.status(400).json({ error: 'username, password, full_name, and role are required' });
    }
    const validRoles = ['team_lead', 'manager', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'role must be team_lead, manager, or viewer' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO users (username, password_hash, full_name, email, role, force_password_reset) VALUES (?, ?, ?, ?, ?, 0)'
    ).run(username, hash, full_name, email || null, role);

    const user = db.prepare(
      'SELECT id, username, full_name, email, role, force_password_reset, created_at FROM users WHERE id = ?'
    ).get(result.lastInsertRowid);

    res.status(201).json(user);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT update user details (team_lead or manager only)
router.put('/:id', authenticate, requireEditor, (req, res) => {
  try {
    const { full_name, email, role } = req.body;
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const validRoles = ['team_lead', 'manager', 'viewer'];
    const newRole = role || existing.role;
    if (!validRoles.includes(newRole)) {
      return res.status(400).json({ error: 'role must be team_lead, manager, or viewer' });
    }

    db.prepare('UPDATE users SET full_name = ?, email = ?, role = ? WHERE id = ?')
      .run(full_name || existing.full_name, email || existing.email, newRole, req.params.id);

    const user = db.prepare(
      'SELECT id, username, full_name, email, role, force_password_reset, created_at FROM users WHERE id = ?'
    ).get(req.params.id);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT reset password — sets a temporary password and forces change on next login
router.put('/:id/reset-password', authenticate, requireEditor, (req, res) => {
  try {
    const { temp_password } = req.body;
    if (!temp_password || temp_password.length < 6) {
      return res.status(400).json({ error: 'Temporary password must be at least 6 characters' });
    }

    const existing = db.prepare('SELECT id, username, full_name FROM users WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const hash = bcrypt.hashSync(temp_password, 10);
    db.prepare('UPDATE users SET password_hash = ?, force_password_reset = 1 WHERE id = ?')
      .run(hash, req.params.id);

    res.json({ message: `Temporary password set for ${existing.full_name}. They will be prompted to change it on next login.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE user (team_lead or manager only, cannot delete yourself)
router.delete('/:id', authenticate, requireEditor, (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    const existing = db.prepare('SELECT id, full_name FROM users WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found' });

    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ message: `User ${existing.full_name} deleted` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
