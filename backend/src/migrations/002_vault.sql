-- Principal-protected prediction module (v2, phase 2 per spec).
-- Structural rule enforced by this schema: principal never moves into a
-- wager. Only yield harvested from Aave can be wagered. A withdraw() call
-- against `vaults.principal_balance` should never be blocked by an open
-- prediction position, because positions can only draw from `yield_pool`.

CREATE TABLE IF NOT EXISTS vaults (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chain TEXT NOT NULL DEFAULT 'x_layer',
  asset TEXT NOT NULL DEFAULT 'USDT',
  -- Principal is always withdrawable on demand. Nothing in this table
  -- should ever be decremented by a losing prediction; only withdraw()
  -- touches this column.
  principal_balance NUMERIC(38,6) NOT NULL DEFAULT 0 CHECK (principal_balance >= 0),
  deposit_tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS yield_pool (
  id SERIAL PRIMARY KEY,
  vault_id INTEGER NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  -- Cumulative yield harvested from Aave v3. This is the only balance a
  -- prediction position can draw from.
  harvested_amount NUMERIC(38,6) NOT NULL DEFAULT 0 CHECK (harvested_amount >= 0),
  -- Sum of amount_wagered across this vault's open prediction_positions.
  -- Kept as a column (not just derived) so a single row lock at wager time
  -- prevents wagering the same yield twice under concurrent requests.
  wagered_amount NUMERIC(38,6) NOT NULL DEFAULT 0 CHECK (wagered_amount >= 0),
  last_harvest_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT wagered_not_over_harvested CHECK (wagered_amount <= harvested_amount)
);

CREATE TABLE IF NOT EXISTS prediction_positions (
  id SERIAL PRIMARY KEY,
  vault_id INTEGER NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  -- References predictions_cache.topic / an external market id. No FK,
  -- since predictions_cache rows expire and get replaced.
  market_id TEXT NOT NULL,
  side TEXT NOT NULL,
  amount_wagered NUMERIC(38,6) NOT NULL CHECK (amount_wagered > 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost', 'void')),
  payout_amount NUMERIC(38,6),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vaults_user_id ON vaults(user_id);
CREATE INDEX IF NOT EXISTS idx_yield_pool_vault_id ON yield_pool(vault_id);
CREATE INDEX IF NOT EXISTS idx_prediction_positions_vault_id ON prediction_positions(vault_id);
CREATE INDEX IF NOT EXISTS idx_prediction_positions_status ON prediction_positions(status);
