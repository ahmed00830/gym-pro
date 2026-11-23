import type { Migration } from './types'

/**
 * Adds optional member photo storage to the existing members table.
 *
 * The photo is stored as a small data URL so the local database remains
 * self-contained and no filesystem path or raw file access is exposed to the
 * renderer. Existing rows receive NULL and remain valid.
 */
export const memberPhotoMigration: Migration = {
  version: 3,
  name: 'member_photo',
  sql: `
ALTER TABLE members ADD COLUMN photo_data TEXT;
`
}
