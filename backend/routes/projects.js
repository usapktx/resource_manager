const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authenticate, requireEditor } = require('../middleware/auth');

function logAudit(user, action, entityId, details) {
  db.prepare(
    'INSERT INTO audit_log (user_id, user_name, user_role, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(user.id, user.fullName, user.role, action, 'project', entityId, JSON.stringify(details));
}

// GET all projects
router.get('/', authenticate, (req, res) => {
  try {
    const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single project
router.get('/:id', authenticate, (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create project
router.post('/', authenticate, requireEditor, (req, res) => {
  try {
    const { name, description = '', start_date, end_date, status = 'active' } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const validStatuses = ['active', 'completed', 'on-hold'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'status must be active, completed, or on-hold' });
    }
    const result = db.prepare(
      'INSERT INTO projects (name, description, start_date, end_date, status) VALUES (?, ?, ?, ?, ?)'
    ).run(name, description, start_date || null, end_date || null, status);
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    logAudit(req.user, 'created', project.id, { name, status });
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update project
router.put('/:id', authenticate, requireEditor, (req, res) => {
  try {
    const { name, description = '', start_date, end_date, status } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Project not found' });

    const validStatuses = ['active', 'completed', 'on-hold'];
    const newStatus = status || existing.status;
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({ error: 'status must be active, completed, or on-hold' });
    }

    db.prepare(
      'UPDATE projects SET name = ?, description = ?, start_date = ?, end_date = ?, status = ? WHERE id = ?'
    ).run(name, description, start_date || null, end_date || null, newStatus, req.params.id);

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    logAudit(req.user, 'updated', project.id, {
      name, status: newStatus,
      previous: { name: existing.name, status: existing.status },
    });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE project
router.delete('/:id', authenticate, requireEditor, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    logAudit(req.user, 'deleted', existing.id, { name: existing.name });
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
