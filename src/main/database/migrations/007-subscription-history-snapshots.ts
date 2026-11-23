import type { Migration } from './types'

/**
 * Snapshots the plan name and duration onto each subscription.
 *
 * A subscription's price is already captured at purchase time; without these
 * columns, editing a plan's name or duration would retroactively rewrite the
 * permanent history of previously purchased subscriptions. Existing rows are
 * backfilled from their current plan — the best available information — and
 * every new subscription writes the values directly.
 */
export const subscriptionHistorySnapshotsMigration: Migration = {
  version: 7,
  name: 'subscription_history_snapshots',
  sql: `
ALTER TABLE subscriptions ADD COLUMN plan_name TEXT;
ALTER TABLE subscriptions ADD COLUMN duration_days INTEGER;

UPDATE subscriptions
SET plan_name = (
      SELECT name FROM membership_plans WHERE membership_plans.id = subscriptions.plan_id
    ),
    duration_days = (
      SELECT duration_days FROM membership_plans WHERE membership_plans.id = subscriptions.plan_id
    )
WHERE plan_name IS NULL;
`
}
