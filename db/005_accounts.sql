BEGIN;

CREATE TABLE windowsill.accounts (
    player_id uuid PRIMARY KEY REFERENCES windowsill.players,
    username text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9_]{3,32}$'),
    password_salt text NOT NULL CHECK (password_salt ~ '^[a-f0-9]{32}$'),
    password_digest text NOT NULL CHECK (password_digest ~ '^[a-f0-9]{64}$'),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE windowsill.account_sessions (
    token_digest text PRIMARY KEY CHECK (token_digest ~ '^[a-f0-9]{64}$'),
    player_id uuid NOT NULL REFERENCES windowsill.accounts ON DELETE CASCADE,
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL CHECK (expires_at > created_at)
);

CREATE INDEX account_sessions_player_expiry_idx ON windowsill.account_sessions (player_id, expires_at);

COMMIT;
