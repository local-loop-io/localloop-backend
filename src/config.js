const path = require('path');

require('dotenv').config();

const env = process.env;

const config = {
  port: Number(env.PORT || 8080),
  databasePath: env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'interest.sqlite'),
  publicLimit: Number(env.PUBLIC_LIMIT || 100),
  allowedOrigins: (env.ALLOWED_ORIGINS || 'https://local-loop-io.github.io,http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  rateLimitMax: Number(env.RATE_LIMIT_MAX || 60),
};

module.exports = { config };
