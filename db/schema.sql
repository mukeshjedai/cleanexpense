CREATE SCHEMA IF NOT EXISTS cleanexpense;
CREATE TABLE IF NOT EXISTS cleanexpense.forecasts (
  id uuid PRIMARY KEY,
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  generated_at timestamptz,
  horizon integer NOT NULL CHECK (horizon BETWEEN 7 AND 30),
  category text NOT NULL,
  currency varchar(3) NOT NULL,
  source_snapshot text NOT NULL,
  data_cutoff date NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','complete','failed')),
  report jsonb,
  CHECK (status <> 'complete' OR (report IS NOT NULL AND generated_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS forecasts_lookup_idx ON cleanexpense.forecasts (horizon,category,generated_at DESC) WHERE status='complete';
CREATE TABLE IF NOT EXISTS cleanexpense.category_rules (
  description_key text PRIMARY KEY CHECK (length(description_key) BETWEEN 1 AND 1000),
  category text NOT NULL CHECK (category IN ('Groceries','Dining','Shopping','Transport','Housing','Utilities','Health','Entertainment','Travel','Income','Transfers','Other')),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS cleanexpense.snapshots (
  id uuid PRIMARY KEY,
  saved_at timestamptz NOT NULL DEFAULT now(),
  currency varchar(3) NOT NULL CHECK (currency IN ('AUD','USD','GBP','EUR','INR')),
  version integer NOT NULL DEFAULT 1 CHECK (version = 1),
  source_key text UNIQUE,
  transaction_count integer NOT NULL CHECK (transaction_count BETWEEN 1 AND 5000)
);

CREATE TABLE IF NOT EXISTS cleanexpense.transactions (
  snapshot_id uuid NOT NULL REFERENCES cleanexpense.snapshots(id),
  id text NOT NULL CHECK (length(id) BETWEEN 1 AND 100),
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  transaction_date date NOT NULL,
  transaction_time varchar(8) CHECK (transaction_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$'),
  description text NOT NULL CHECK (length(description) BETWEEN 1 AND 1000),
  amount numeric(16,2) NOT NULL CHECK (amount BETWEEN -1000000000000 AND 1000000000000),
  category text NOT NULL CHECK (category IN ('Groceries','Dining','Shopping','Transport','Housing','Utilities','Health','Entertainment','Travel','Income','Transfers','Other')),
  incoming_amount numeric(16,2) GENERATED ALWAYS AS (greatest(amount, 0)) STORED,
  outgoing_amount numeric(16,2) GENERATED ALWAYS AS (greatest(-amount, 0)) STORED,
  PRIMARY KEY (snapshot_id, id),
  UNIQUE (snapshot_id, ordinal)
);

CREATE INDEX IF NOT EXISTS snapshots_saved_at_idx ON cleanexpense.snapshots(saved_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS transactions_date_category_idx ON cleanexpense.transactions(snapshot_id, transaction_date DESC, category);

CREATE OR REPLACE VIEW cleanexpense.current_transactions AS
SELECT t.*, s.currency, s.saved_at
FROM cleanexpense.transactions t
JOIN cleanexpense.snapshots s ON s.id = t.snapshot_id
WHERE s.id = (SELECT id FROM cleanexpense.snapshots ORDER BY saved_at DESC, id DESC LIMIT 1);
