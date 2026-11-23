import type { Migration } from './types'

/**
 * Adds a permanent, sequential numeric membership number for every member.
 *
 * The generated `member_code` (GYM-000001) is preserved unchanged. The new
 * `member_number` is the plain number used at the reception desk. Existing
 * rows are backfilled from their permanent id so the number is stable and
 * unique. A tiny sequence table keeps the next number monotonic, so a number
 * is never reused even if the most recent member is removed.
 */
export const memberNumbersMigration: Migration = {
  version: 6,
  name: 'member_numbers',
  sql: `
ALTER TABLE members ADD COLUMN member_number INTEGER;

UPDATE members SET member_number = id WHERE member_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_member_number
  ON members (member_number);

CREATE TABLE member_number_sequence (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_number INTEGER NOT NULL DEFAULT 0
) STRICT;

INSERT INTO member_number_sequence (id, last_number)
VALUES (1, (SELECT COALESCE(MAX(member_number), 0) FROM members));
`
}
