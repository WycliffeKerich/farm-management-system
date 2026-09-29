-- Migration: 012_auth_hardening
-- Description: Account lockout, rotating refresh-token sessions, hashed password reset tokens
-- Neither user_sessions nor password_reset_tokens was used by the application before
-- this migration, so both are recreated rather than altered.

-- ==================== ACCOUNT LOCKOUT ====================

ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;

-- Emails are compared case-insensitively
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

-- ==================== REFRESH-TOKEN SESSIONS ====================
-- One row per issued refresh token. Rotation marks the old row replaced; presenting
-- a replaced or revoked token revokes every row in its family (token theft).

DROP TABLE IF EXISTS user_sessions;

CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,          -- sha256 of the opaque token; the token itself is never stored
    family_id UUID NOT NULL,                      -- all tokens descended from one login
    replaced_by INTEGER REFERENCES user_sessions(id) ON DELETE SET NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    last_used_at TIMESTAMP,
    user_agent VARCHAR(255),
    ip_address VARCHAR(64),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_family ON user_sessions(family_id);
CREATE INDEX idx_user_sessions_active ON user_sessions(user_id)
    WHERE revoked_at IS NULL AND replaced_by IS NULL;

-- ==================== PASSWORD RESET ====================

DROP TABLE IF EXISTS password_reset_tokens;

CREATE TABLE password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_password_reset_tokens_user ON password_reset_tokens(user_id);
