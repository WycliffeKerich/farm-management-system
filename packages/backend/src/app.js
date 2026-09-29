const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');

const morganMiddleware = require('./middleware/logger.middleware');
const { errorHandler, notFound } = require('./middleware/error.middleware');
const routes = require('./routes');

/**
 * Create Express application
 */
const app = express();

// Behind a reverse proxy (nginx, Caddy), set TRUST_PROXY=1 so req.ip - and therefore
// rate limiting - uses the client address from X-Forwarded-For
if (process.env.TRUST_PROXY) {
  const hops = parseInt(process.env.TRUST_PROXY, 10);
  app.set('trust proxy', Number.isNaN(hops) ? process.env.TRUST_PROXY : hops);
}

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);

// Body parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Compression middleware
app.use(compression());

// HTTP request logging
app.use(morganMiddleware);

// API Routes
app.use('/api/v1', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Farm Management System API',
    version: '1.0.0',
    endpoints: {
      health: '/api/v1/health',
      auth: '/api/v1/auth',
    },
  });
});

// Handle 404 errors
app.use(notFound);

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
