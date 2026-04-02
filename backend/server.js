require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initializeDatabase } = require('./database');

const authRouter = require('./routes/auth');
const resourcesRouter = require('./routes/resources');
const projectsRouter = require('./routes/projects');
const allocationsRouter = require('./routes/allocations');
const aiRouter = require('./routes/ai');
const auditLogRouter = require('./routes/auditlog');
const usersRouter = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/resources', resourcesRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/allocations', allocationsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/audit-log', auditLogRouter);
app.use('/api/users', usersRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Initialize database then start server (sql.js init is async)
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Resource Manager API running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
