const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { config } = require('./config');
const { createDatabase } = require('./db');
const { validateInterest } = require('./validation');

const app = express();
const database = createDatabase(config.databasePath);

// Trust reverse proxy headers when deployed behind Nginx/Caddy.
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: config.allowedOrigins,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    maxAge: 86400,
  })
);
app.use(express.json({ limit: '50kb' }));
app.use(morgan('combined'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/interest', (req, res) => {
  const rawLimit = Number(req.query.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(rawLimit, config.publicLimit)
    : config.publicLimit;
  const results = database.listInterests(limit);
  const total = database.countInterests();
  res.json({ results, total });
});

app.post('/api/interest', (req, res) => {
  const validation = validateInterest(req.body);
  if (!validation.ok) {
    return res.status(400).json({ error: 'Invalid request', details: validation.errors });
  }

  const created = database.insertInterest(validation.data);
  res.status(201).json({
    id: created.id,
    created_at: created.created_at,
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`LocalLoop backend listening on port ${config.port}`);
});

process.on('SIGINT', () => {
  database.db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  database.db.close();
  process.exit(0);
});
