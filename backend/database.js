const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'resourcemanager.db');

// PreparedStatement wraps sql.js to mimic better-sqlite3's API
class PreparedStatement {
  constructor(dbWrapper, sql) {
    this._dbWrapper = dbWrapper;
    this._sql = sql;
  }

  all(...args) {
    const stmt = this._dbWrapper._db.prepare(this._sql);
    if (args.length > 0) stmt.bind(args);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  get(...args) {
    const results = this.all(...args);
    return results[0] || null;
  }

  run(...args) {
    if (args.length > 0) {
      this._dbWrapper._db.run(this._sql, args);
    } else {
      this._dbWrapper._db.run(this._sql);
    }
    // Read last_insert_rowid BEFORE saving (export can affect internal state)
    const lastId = this._dbWrapper._db.exec('SELECT last_insert_rowid()');
    const lastInsertRowid =
      lastId.length > 0 && lastId[0].values.length > 0 ? lastId[0].values[0][0] : null;
    this._dbWrapper._save();
    return { lastInsertRowid };
  }
}

class DbWrapper {
  constructor() {
    this._db = null;
  }

  async init() {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath);
      this._db = new SQL.Database(data);
    } else {
      this._db = new SQL.Database();
    }
  }

  _save() {
    const data = this._db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }

  prepare(sql) {
    return new PreparedStatement(this, sql);
  }

  exec(sql) {
    this._db.exec(sql);
    this._save();
  }
}

const db = new DbWrapper();

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function addWeeks(dateStr, weeks) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split('T')[0];
}

async function initializeDatabase() {
  await db.init();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'viewer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      skills TEXT NOT NULL DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      start_date DATE,
      end_date DATE,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resource_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      week_start DATE NOT NULL,
      percentage INTEGER NOT NULL,
      notes TEXT DEFAULT '',
      created_by_id INTEGER,
      created_by_name TEXT,
      updated_by_id INTEGER,
      updated_by_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(resource_id, project_id, week_start)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Add force_password_reset column if it doesn't exist (migration)
  try {
    db.exec('ALTER TABLE users ADD COLUMN force_password_reset INTEGER NOT NULL DEFAULT 0');
  } catch (e) { /* column already exists */ }

  seedData();
}

function seedData() {
  const bcrypt = require('bcryptjs');

  // Seed users
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (!userCount || userCount.count === 0) {
    const users = [
      { username: 'admin', password: 'admin123', full_name: 'Administrator', email: 'admin@company.com', role: 'team_lead' },
      { username: 'sarah.lead', password: 'lead123', full_name: 'Sarah Connor', email: 'sarah@company.com', role: 'team_lead' },
      { username: 'john.manager', password: 'mgr123', full_name: 'John Smith', email: 'john@company.com', role: 'manager' },
      { username: 'alex.viewer', password: 'view123', full_name: 'Alex Taylor', email: 'alex@company.com', role: 'viewer' },
    ];
    users.forEach(u => {
      const hash = bcrypt.hashSync(u.password, 10);
      db.prepare('INSERT INTO users (username, password_hash, full_name, email, role) VALUES (?, ?, ?, ?, ?)')
        .run(u.username, hash, u.full_name, u.email, u.role);
    });
    console.log('Users seeded: sarah.lead / lead123 | john.manager / mgr123 | alex.viewer / view123');
  }

  const resourceCount = db.prepare('SELECT COUNT(*) as count FROM resources').get();
  if (resourceCount && resourceCount.count > 0) return;

  const currentMonday = getMonday(new Date());

  const resources = [
    { name: 'Alice Chen', email: 'alice@company.com', role: 'Senior Frontend Developer', skills: JSON.stringify(['React', 'TypeScript', 'CSS', 'Vue']) },
    { name: 'Bob Martinez', email: 'bob@company.com', role: 'Backend Engineer', skills: JSON.stringify(['Node.js', 'Python', 'PostgreSQL', 'Docker']) },
    { name: 'Carol White', email: 'carol@company.com', role: 'Full Stack Developer', skills: JSON.stringify(['React', 'Node.js', 'MongoDB', 'AWS']) },
    { name: 'David Kim', email: 'david@company.com', role: 'DevOps Engineer', skills: JSON.stringify(['Kubernetes', 'Docker', 'CI/CD', 'Terraform']) },
    { name: 'Emma Johnson', email: 'emma@company.com', role: 'Mobile Developer', skills: JSON.stringify(['React Native', 'iOS', 'Android', 'TypeScript']) },
  ];

  const resourceIds = resources.map(r => {
    const result = db.prepare(
      'INSERT INTO resources (name, email, role, skills) VALUES (?, ?, ?, ?)'
    ).run(r.name, r.email, r.role, r.skills);
    return result.lastInsertRowid;
  });

  const projects = [
    { name: 'Customer Portal Redesign', description: 'Complete redesign of the customer-facing portal with modern UI/UX', start_date: addWeeks(currentMonday, -2), end_date: addWeeks(currentMonday, 6), status: 'active' },
    { name: 'API Gateway Migration', description: 'Migrate legacy REST APIs to new gateway infrastructure with improved security', start_date: addWeeks(currentMonday, -1), end_date: addWeeks(currentMonday, 4), status: 'active' },
    { name: 'Mobile App v2.0', description: 'Major update to mobile application with new features and performance improvements', start_date: addWeeks(currentMonday, 1), end_date: addWeeks(currentMonday, 8), status: 'active' },
  ];

  const projectIds = projects.map(p => {
    const result = db.prepare(
      'INSERT INTO projects (name, description, start_date, end_date, status) VALUES (?, ?, ?, ?, ?)'
    ).run(p.name, p.description, p.start_date, p.end_date, p.status);
    return result.lastInsertRowid;
  });

  const allocations = [
    { resource_id: resourceIds[0], project_id: projectIds[0], week_start: currentMonday, percentage: 60, notes: 'UI components' },
    { resource_id: resourceIds[1], project_id: projectIds[1], week_start: currentMonday, percentage: 80, notes: 'API refactoring' },
    { resource_id: resourceIds[2], project_id: projectIds[0], week_start: currentMonday, percentage: 40, notes: 'Backend integration' },
    { resource_id: resourceIds[2], project_id: projectIds[1], week_start: currentMonday, percentage: 40, notes: 'Gateway setup' },
    { resource_id: resourceIds[3], project_id: projectIds[1], week_start: currentMonday, percentage: 50, notes: 'Infrastructure' },
    { resource_id: resourceIds[0], project_id: projectIds[0], week_start: addWeeks(currentMonday, 1), percentage: 70, notes: 'Feature implementation' },
    { resource_id: resourceIds[1], project_id: projectIds[1], week_start: addWeeks(currentMonday, 1), percentage: 80, notes: 'Testing' },
    { resource_id: resourceIds[4], project_id: projectIds[2], week_start: addWeeks(currentMonday, 1), percentage: 100, notes: 'Core development' },
    { resource_id: resourceIds[2], project_id: projectIds[2], week_start: addWeeks(currentMonday, 1), percentage: 50, notes: 'API integration' },
    { resource_id: resourceIds[0], project_id: projectIds[0], week_start: addWeeks(currentMonday, 2), percentage: 80, notes: 'Testing & QA' },
    { resource_id: resourceIds[3], project_id: projectIds[2], week_start: addWeeks(currentMonday, 2), percentage: 60, notes: 'DevOps setup' },
    { resource_id: resourceIds[4], project_id: projectIds[2], week_start: addWeeks(currentMonday, 2), percentage: 100, notes: 'Feature complete' },
    { resource_id: resourceIds[0], project_id: projectIds[0], week_start: addWeeks(currentMonday, -1), percentage: 50, notes: 'Design review' },
    { resource_id: resourceIds[1], project_id: projectIds[1], week_start: addWeeks(currentMonday, -1), percentage: 70, notes: 'Architecture planning' },
    { resource_id: resourceIds[3], project_id: projectIds[1], week_start: addWeeks(currentMonday, -1), percentage: 30, notes: 'Environment setup' },
  ];

  allocations.forEach(a => {
    try {
      db.prepare(
        'INSERT INTO allocations (resource_id, project_id, week_start, percentage, notes) VALUES (?, ?, ?, ?, ?)'
      ).run(a.resource_id, a.project_id, a.week_start, a.percentage, a.notes);
    } catch (e) {
      // ignore duplicate seed entries
    }
  });

  console.log('Database seeded with sample data');
}

module.exports = { db, initializeDatabase };
