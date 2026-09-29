const { rateLimit, MemoryStore } = require('express-rate-limit');

/**
 * Rate limiters for the unauthenticated auth endpoints.
 * Regular API traffic is authenticated and not rate limited (a busy SPA
 * easily makes 100 requests in 15 minutes).
 */

const MINUTE = 60 * 1000;
const stores = [];

function tooManyRequests(message) {
  return (req, res) => {
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message },
    });
  };
}

function createLimiter({ windowMs, limit, keyGenerator, message }) {
  const store = new MemoryStore();
  stores.push(store);
  return rateLimit({
    windowMs,
    limit,
    store,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator,
    handler: tooManyRequests(message),
  });
}

// IP + email, so one attacker cannot lock out every user and a shared office IP
// does not block everyone after a few typos
const ipAndEmail = (req) =>
  `${req.ip}|${String(req.body?.email || '')
    .trim()
    .toLowerCase()}`;

const loginLimiter = createLimiter({
  windowMs: 15 * MINUTE,
  limit: parseInt(process.env.LOGIN_RATE_LIMIT || '5', 10),
  keyGenerator: ipAndEmail,
  message: 'Too many login attempts. Please try again in 15 minutes.',
});

const forgotPasswordLimiter = createLimiter({
  windowMs: 60 * MINUTE,
  limit: 5,
  keyGenerator: ipAndEmail,
  message: 'Too many password reset requests. Please try again later.',
});

const refreshLimiter = createLimiter({
  windowMs: 15 * MINUTE,
  limit: 60,
  keyGenerator: (req) => req.ip,
  message: 'Too many requests. Please try again later.',
});

/**
 * Clear all limiter counters (tests only)
 */
function resetRateLimits() {
  stores.forEach((store) => store.resetAll());
}

module.exports = {
  loginLimiter,
  forgotPasswordLimiter,
  refreshLimiter,
  resetRateLimits,
};
