import type { Migration } from './types'

/**
 * Strengthens the expenses ledger.
 *
 * `expense_time` records the local time the expense happened (backfilled from
 * the audit timestamp for existing rows, which is UTC for the rows created
 * before this migration). `recorded_by` records the employee who entered the
 * expense. `status` makes "deletion" a non-destructive archival, so a
 * financial record can never vanish without a trace.
 */
export const expensesHardeningMigration: Migration = {
  version: 8,
  name: 'expenses_hardening',
  sql: `
ALTER TABLE expenses ADD COLUMN expense_time TEXT;

UPDATE expenses
SET expense_time = substr(strftime('%H:%M:%S', created_at), 1, 8)
WHERE expense_time IS NULL;

ALTER TABLE expenses ADD COLUMN recorded_by TEXT
  CHECK (recorded_by IS NULL OR length(trim(recorded_by)) <= 120);

ALTER TABLE expenses ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'archived'));

CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses (status);
`
}
