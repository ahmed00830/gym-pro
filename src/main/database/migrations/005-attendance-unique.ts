import type { Migration } from './types'

export const attendanceUniqueMigration: Migration = {
  version: 5,
  name: 'attendance_unique_member_date',
  sql: `
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_member_date_unique
  ON attendance (member_id, check_in_date);
`
}
