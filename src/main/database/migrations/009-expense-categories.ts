import type { Migration } from './types'

/**
 * Expense categories are stored rather than hardcoded so administrators can
 * add, rename and (de)activate them. The eight built-in categories are
 * seeded; existing expense rows keep their original category keys and are
 * resolved through this catalog at read time.
 */
export const expenseCategoriesMigration: Migration = {
  version: 9,
  name: 'expense_categories',
  sql: `
CREATE TABLE expense_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL COLLATE NOCASE UNIQUE
    CHECK (length(trim(key)) > 0 AND key = lower(key)),
  name_ar TEXT NOT NULL CHECK (length(trim(name_ar)) > 0),
  name_en TEXT NOT NULL CHECK (length(trim(name_en)) > 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

INSERT INTO expense_categories (key, name_ar, name_en, sort_order) VALUES
  ('electricity', 'كهرباء', 'Electricity', 10),
  ('water', 'مياه', 'Water', 20),
  ('rent', 'إيجار', 'Rent', 30),
  ('salaries', 'رواتب', 'Salaries', 40),
  ('maintenance', 'صيانة', 'Maintenance', 50),
  ('equipment', 'معدات رياضية', 'Sports equipment', 60),
  ('cleaning', 'نظافة', 'Cleaning', 70),
  ('other', 'مصروفات أخرى', 'Other expenses', 999);
`
}
