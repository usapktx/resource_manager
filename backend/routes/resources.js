const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authenticate, requireEditor } = require('../middleware/auth');

function logAudit(user, action, entityId, details) {
  db.prepare(
    'INSERT INTO audit_log (user_id, user_name, user_role, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(user.id, user.fullName, user.role, action, 'resource', entityId, JSON.stringify(details));
}

// GET all resources
router.get('/', authenticate, (req, res) => {
  try {
    const resources = db.prepare('SELECT * FROM resources ORDER BY name').all();
    res.json(resources.map(r => ({ ...r, skills: JSON.parse(r.skills || '[]') })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single resource
router.get('/:id', authenticate, (req, res) => {
  try {
    const resource = db.prepare('SELECT * FROM resources WHERE id = ?').get(req.params.id);
    if (!resource) return res.status(404).json({ error: 'Resource not found' });
    res.json({ ...resource, skills: JSON.parse(resource.skills || '[]') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create resource
router.post('/', authenticate, requireEditor, (req, res) => {
  try {
    const { name, email, role, skills = [] } = req.body;
    if (!name || !email || !role) {
      return res.status(400).json({ error: 'name, email, and role are required' });
    }
    const skillsJson = JSON.stringify(Array.isArray(skills) ? skills : []);
    const result = db.prepare(
      'INSERT INTO resources (name, email, role, skills) VALUES (?, ?, ?, ?)'
    ).run(name, email, role, skillsJson);
    const resource = db.prepare('SELECT * FROM resources WHERE id = ?').get(result.lastInsertRowid);
    logAudit(req.user, 'created', resource.id, { name, email, role, skills });
    res.status(201).json({ ...resource, skills: JSON.parse(resource.skills || '[]') });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'A resource with this email already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT update resource
router.put('/:id', authenticate, requireEditor, (req, res) => {
  try {
    const { name, email, role, skills = [] } = req.body;
    if (!name || !email || !role) {
      return res.status(400).json({ error: 'name, email, and role are required' });
    }
    const existing = db.prepare('SELECT * FROM resources WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Resource not found' });

    const skillsJson = JSON.stringify(Array.isArray(skills) ? skills : []);
    db.prepare(
      'UPDATE resources SET name = ?, email = ?, role = ?, skills = ? WHERE id = ?'
    ).run(name, email, role, skillsJson, req.params.id);

    const resource = db.prepare('SELECT * FROM resources WHERE id = ?').get(req.params.id);
    logAudit(req.user, 'updated', resource.id, {
      name, email, role, skills,
      previous: { name: existing.name, email: existing.email, role: existing.role },
    });
    res.json({ ...resource, skills: JSON.parse(resource.skills || '[]') });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'A resource with this email already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// DELETE resource
router.delete('/:id', authenticate, requireEditor, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM resources WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Resource not found' });
    db.prepare('DELETE FROM resources WHERE id = ?').run(req.params.id);
    logAudit(req.user, 'deleted', existing.id, { name: existing.name, email: existing.email });
    res.json({ message: 'Resource deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
