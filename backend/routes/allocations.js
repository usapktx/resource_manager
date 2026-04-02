const express = require('express');
const router = express.Router();
const { db } = require('../database');
const { authenticate, requireEditor } = require('../middleware/auth');

function logAudit(user, action, entityId, details) {
  db.prepare(
    'INSERT INTO audit_log (user_id, user_name, user_role, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(user.id, user.fullName, user.role, action, 'allocation', entityId, JSON.stringify(details));
}

// GET all allocations (with resource and project names)
router.get('/', authenticate, (req, res) => {
  try {
    const { resource_id, project_id, week_start_from, week_start_to } = req.query;

    let query = `
      SELECT
        a.*,
        r.name as resource_name,
        r.role as resource_role,
        p.name as project_name,
        p.status as project_status
      FROM allocations a
      JOIN resources r ON a.resource_id = r.id
      JOIN projects p ON a.project_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (resource_id) { query += ' AND a.resource_id = ?'; params.push(resource_id); }
    if (project_id) { query += ' AND a.project_id = ?'; params.push(project_id); }
    if (week_start_from) { query += ' AND a.week_start >= ?'; params.push(week_start_from); }
    if (week_start_to) { query += ' AND a.week_start <= ?'; params.push(week_start_to); }

    query += ' ORDER BY a.week_start, r.name, p.name';

    const allocations = db.prepare(query).all(...params);
    res.json(allocations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET utilization summary per resource per week
router.get('/summary/utilization', authenticate, (req, res) => {
  try {
    const { week_start_from, week_start_to } = req.query;

    let query = `
      SELECT
        a.resource_id,
        r.name as resource_name,
        r.role as resource_role,
        a.week_start,
        SUM(a.percentage) as total_percentage
      FROM allocations a
      JOIN resources r ON a.resource_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (week_start_from) { query += ' AND a.week_start >= ?'; params.push(week_start_from); }
    if (week_start_to) { query += ' AND a.week_start <= ?'; params.push(week_start_to); }

    query += ' GROUP BY a.resource_id, a.week_start ORDER BY r.name, a.week_start';

    const summary = db.prepare(query).all(...params);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single allocation
router.get('/:id', authenticate, (req, res) => {
  try {
    const allocation = db.prepare(`
      SELECT a.*, r.name as resource_name, p.name as project_name
      FROM allocations a
      JOIN resources r ON a.resource_id = r.id
      JOIN projects p ON a.project_id = p.id
      WHERE a.id = ?
    `).get(req.params.id);
    if (!allocation) return res.status(404).json({ error: 'Allocation not found' });
    res.json(allocation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create allocation
router.post('/', authenticate, requireEditor, (req, res) => {
  try {
    const { resource_id, project_id, week_start, percentage, notes = '' } = req.body;

    if (!resource_id || !project_id || !week_start || percentage === undefined) {
      return res.status(400).json({ error: 'resource_id, project_id, week_start, and percentage are required' });
    }
    if (percentage < 0 || percentage > 200) {
      return res.status(400).json({ error: 'percentage must be between 0 and 200' });
    }

    const resource = db.prepare('SELECT id, name FROM resources WHERE id = ?').get(resource_id);
    if (!resource) return res.status(404).json({ error: 'Resource not found' });

    const project = db.prepare('SELECT id, name FROM projects WHERE id = ?').get(project_id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const result = db.prepare(`
      INSERT INTO allocations (resource_id, project_id, week_start, percentage, notes, created_by_id, created_by_name, updated_by_id, updated_by_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(resource_id, project_id, week_start, percentage, notes, req.user.id, req.user.fullName, req.user.id, req.user.fullName);

    const allocation = db.prepare(`
      SELECT a.*, r.name as resource_name, p.name as project_name
      FROM allocations a
      JOIN resources r ON a.resource_id = r.id
      JOIN projects p ON a.project_id = p.id
      WHERE a.id = ?
    `).get(result.lastInsertRowid);

    logAudit(req.user, 'created', allocation.id, {
      resource_name: resource.name,
      project_name: project.name,
      week_start,
      percentage,
      notes,
    });

    res.status(201).json(allocation);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'An allocation for this resource, project, and week already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT update allocation
router.put('/:id', authenticate, requireEditor, (req, res) => {
  try {
    const { resource_id, project_id, week_start, percentage, notes } = req.body;

    const existing = db.prepare('SELECT * FROM allocations WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Allocation not found' });

    const newPercentage = percentage !== undefined ? percentage : existing.percentage;
    if (newPercentage < 0 || newPercentage > 200) {
      return res.status(400).json({ error: 'percentage must be between 0 and 200' });
    }

    db.prepare(`
      UPDATE allocations
      SET resource_id = ?, project_id = ?, week_start = ?, percentage = ?, notes = ?,
          updated_by_id = ?, updated_by_name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      resource_id || existing.resource_id,
      project_id || existing.project_id,
      week_start || existing.week_start,
      newPercentage,
      notes !== undefined ? notes : existing.notes,
      req.user.id,
      req.user.fullName,
      req.params.id
    );

    const allocation = db.prepare(`
      SELECT a.*, r.name as resource_name, p.name as project_name
      FROM allocations a
      JOIN resources r ON a.resource_id = r.id
      JOIN projects p ON a.project_id = p.id
      WHERE a.id = ?
    `).get(req.params.id);

    logAudit(req.user, 'updated', allocation.id, {
      resource_name: allocation.resource_name,
      project_name: allocation.project_name,
      week_start: allocation.week_start,
      old_percentage: existing.percentage,
      new_percentage: newPercentage,
    });

    res.json(allocation);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'An allocation for this resource, project, and week already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// DELETE allocation
router.delete('/:id', authenticate, requireEditor, (req, res) => {
  try {
    const existing = db.prepare(`
      SELECT a.*, r.name as resource_name, p.name as project_name
      FROM allocations a
      JOIN resources r ON a.resource_id = r.id
      JOIN projects p ON a.project_id = p.id
      WHERE a.id = ?
    `).get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Allocation not found' });

    db.prepare('DELETE FROM allocations WHERE id = ?').run(req.params.id);

    logAudit(req.user, 'deleted', existing.id, {
      resource_name: existing.resource_name,
      project_name: existing.project_name,
      week_start: existing.week_start,
      percentage: existing.percentage,
    });

    res.json({ message: 'Allocation deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
