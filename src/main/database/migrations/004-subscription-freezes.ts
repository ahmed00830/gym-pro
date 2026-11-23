import type { Migration } from './types'

/**
 * Preserves subscription freeze history. The subscriptions table keeps the
 * current freeze window for quick status checks; this table keeps every
 * freeze period so overlapping or invalid freezes can be detected and the
 * history is never lost.
 */
export const subscriptionFreezesMigration: Migration = {
  version: 4,
  name: 'subscription_freezes',
  sql: `
CREATE TABLE subscription_freezes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER NOT NULL,
  start_date TEXT NOT NULL CHECK (date(start_date) = start_date),
  end_date TEXT CHECK (end_date IS NULL OR date(end_date) = end_date),
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (subscription_id) REFERENCES subscriptions (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) STRICT;

CREATE INDEX idx_subscription_freezes_subscription_id
  ON subscription_freezes (subscription_id);
CREATE INDEX idx_subscription_freezes_dates
  ON subscription_freezes (subscription_id, start_date, end_date);
`
}
