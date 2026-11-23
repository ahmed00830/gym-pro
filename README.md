# GYM PRO

A premium, fully offline desktop application for managing a gym on Windows 10 and 11.

The repository currently contains **Phase 1 (application foundation)** and **Phase 2
(database foundation)**. Member-management, attendance, payment, and expense screens are
not built yet. The existing Phase 1 interface is unchanged.

## Stack

- Electron 45
- React 19 + TypeScript
- Vite 8 via electron-vite
- Tailwind CSS 4
- SQLite via `better-sqlite3` 13 (Node-API prebuild)
- Locally bundled fonts (Readex Pro for Arabic/Latin UI, Space Grotesk for branding)

## Requirements

- Windows 10 or Windows 11
- Node.js 22.12+ (Node 24 recommended)
- npm 10+
- Visual C++ runtime as required by the SQLite prebuild (normally already present on
  Windows 10/11)

## Getting started

```bash
npm install
npm run dev
```

Other useful commands:

```bash
npm run typecheck                # Type-check main, preload, and renderer code
npm run build                    # Type-check and create a production build in out/
npm start                        # Preview the production build
npm run test:database            # Database engine, schema, migration, and restart tests
npm run test:production-database # Built application, IPC, isolation, and restart tests
npm test                         # Run both test suites
```

The development command starts Vite, launches Electron, and enables hot reload for the
renderer and hot restart for the main process.

npm 11 asks for approval before running package install scripts. `package.json` already
allows the `better-sqlite3` install script. A native rebuild is not required because
`better-sqlite3` ships Node-API prebuilds compatible with Electron 45.

## Project structure

```
.
├── electron.vite.config.ts       # Main / preload / renderer build configuration + CSP
├── src
│   ├── main                      # Electron main process (Node.js privileges)
│   │   ├── index.ts              # App lifecycle, database lifecycle, window creation
│   │   ├── window.ts             # Secure BrowserWindow configuration
│   │   ├── security.ts           # Navigation, popup, permission, and IPC-origin guards
│   │   ├── database
│   │   │   ├── index.ts          # userData path + single database service instance
│   │   │   ├── GymProDatabase.ts # Connection lifecycle, health, status, and metadata
│   │   │   ├── connection.ts     # SQLite PRAGMAs and connection helpers
│   │   │   ├── migrate.ts        # Transactional migration runner + checksum validation
│   │   │   ├── date-time.ts      # Local business dates and UTC audit timestamps
│   │   │   └── migrations
│   │   │       ├── 001-core-schema.ts
│   │   │       └── 002-system-tables.ts
│   │   └── ipc
│   │       ├── app-handlers.ts   # Validated app metadata IPC
│   │       └── database-handlers.ts # Validated database IPC (three methods only)
│   ├── preload                   # Sandboxed bridge exposed to the renderer
│   │   └── index.ts
│   ├── shared                    # Types/contracts shared across process boundaries
│   │   ├── ipc.ts
│   │   └── database.ts
│   └── renderer
│       ├── index.html
│       └── src
│           ├── App.tsx
│           ├── components        # Welcome shell, header, footer, status card
│           ├── hooks             # Typed IPC data hooks
│           ├── i18n              # Arabic/English messages + RTL/LTR switching
│           ├── styles            # Tailwind theme and global styles
│           └── main.tsx
├── tests
│   ├── database.electron.ts      # Integration tests run inside Electron
│   └── production-database.cjs   # CDP tests against the built application
├── tsconfig.json                 # Project references
├── tsconfig.node.json            # Main + preload + build config types
├── tsconfig.test.json            # Test compilation configuration
└── tsconfig.web.json             # Renderer types
```

## Database foundation

### Location

The database is created at:

```
<Electron userData>/gym-pro.db
```

On Windows this is normally:

```
C:\Users\<user>\AppData\Roaming\GYM PRO\gym-pro.db
```

It is intentionally never stored in the project directory, the installation directory, or
any location writable by the renderer.

### Connection configuration

A single connection is owned by the main process (`GymProDatabase`). Every connection is
configured with:

- `journal_mode = WAL`
- `synchronous = NORMAL`
- `foreign_keys = ON` (verified at startup)
- `busy_timeout = 5000`
- `temp_store = MEMORY`
- 8 MB page cache
- Prepared statements for all queries

The raw `better-sqlite3` handle is never returned from the service, passed to preload, or
exposed over IPC.

### Migrations

Migrations are immutable, ordered TypeScript modules. The runner:

1. Creates the `schema_migrations` tracking table.
2. Verifies that every already-applied migration exists in the current build.
3. Verifies each applied migration's name and SHA-256 checksum.
4. Rejects a database with an unknown future migration or a mismatched
   `PRAGMA user_version`.
5. Applies each pending migration and its tracking row in one transaction.
6. Updates `PRAGMA user_version` only after the migration succeeds.

Current migrations:

| Version | Name            | Contents                                              |
| ------- | --------------- | ----------------------------------------------------- |
| 1       | `core_schema`   | Members, plans, subscriptions, payments, attendance, expenses |
| 2       | `system_tables` | Users, settings, notifications, activity logs          |

Never edit a migration after it has been applied. Add a new migration instead; changing
released SQL deliberately fails checksum validation.

### Schema

| Table              | Purpose                                                              |
| ------------------ | -------------------------------------------------------------------- |
| `members`          | Member profiles and generated membership codes                       |
| `membership_plans` | Reusable plan definitions (duration and price)                       |
| `subscriptions`    | Membership periods linked to a member and a plan                     |
| `payments`         | Payment records, optionally linked to a subscription                 |
| `attendance`       | Check-in date and time per member                                    |
| `expenses`         | Gym operating expenses                                               |
| `users`            | Future operator accounts (authentication UI is deferred)             |
| `settings`         | Typed key/value application settings                                 |
| `notifications`    | Durable in-app notifications                                         |
| `activity_logs`    | Audit trail; user references become `NULL` if the user is removed    |

Key constraints:

- All tables are `STRICT`; booleans are constrained to `0`/`1`.
- Dates use local `YYYY-MM-DD`; audit timestamps use UTC ISO-8601.
- Member, plan, subscription, payment, and attendance relationships use foreign keys.
- Deleting a member or plan with dependent history is rejected (`ON DELETE RESTRICT`).
- `subscriptions` and `payments` have `BEFORE DELETE` triggers that reject deletion so
  financial history is preserved. Cancel or correct records instead.
- Indexes cover member lookup, status, registration date, subscription dates, payment
  dates, attendance, expenses, notification state, and audit queries.

### Membership codes

Member codes are generated by SQLite, not by the application:

- `members.id` is `INTEGER PRIMARY KEY AUTOINCREMENT`.
- `members.member_code` is a stored generated column:
  `'GYM-' || printf('%06d', id)`.
- The column is `UNIQUE` and cannot be inserted or updated directly.
- Because `AUTOINCREMENT` never reuses a committed row id, deleted member codes are never
  reassigned. For example, deleting `GYM-000002` makes the next member `GYM-000003`.

### Dates

Business dates (registration, subscription periods, payment dates, attendance dates) are
stored as local calendar dates to avoid timezone shifts. Audit columns (`created_at`,
`updated_at`, notification timestamps, migration timestamps) are stored as UTC ISO-8601
strings.

## Database IPC surface

The renderer can call exactly three database methods through the frozen
`window.gymPro.database` bridge:

| Method                     | Returns                                                        |
| -------------------------- | -------------------------------------------------------------- |
| `healthCheck()`            | Integrity, foreign-key, schema, and journal-mode health status |
| `getInitializationStatus()`| State, schema version, applied migrations, and pending count   |
| `getInfo()`                | SQLite version, file name/path, size, page info, table count   |

There is no `query`, `execute`, `prepare`, `transaction`, connection, or filesystem
method. IPC arguments are not accepted; every handler validates the sender origin before
returning a result.

## Security model

- The renderer runs with `contextIsolation: true`, `sandbox: true`,
  `nodeIntegration: false`, and `webviewTag: false`.
- The preload script exposes a deliberately small, frozen API (`window.gymPro`). It never
  exposes `ipcRenderer`, `require`, `process`, or filesystem access.
- Every IPC handler validates the calling frame's origin before returning data.
- New windows, webviews, untrusted navigation, redirects, and all permission requests are
  denied by default.
- A strict, environment-aware Content Security Policy is injected into the renderer. The
  production policy allows local assets only.
- SQLite access remains in the main process. The renderer has no raw SQL, database handle,
  or native module access.
- `better-sqlite3` is externalized from the main bundle so Electron loads the native
  module from `node_modules` at runtime.

## Testing

Close any running GYM PRO window before running the tests. The production test launches
its own Electron instances, and Electron's single-instance lock would make it attach to or
quit alongside an already-running app.

`npm run test:database` compiles the test sources and runs two phases inside real Electron
processes:

- Fresh database creation and initialization
- All migrations, stepwise and idempotent application, schema history
- All required tables and indexes
- Member-code generation, uniqueness, and non-reuse after deletion
- Foreign-key enforcement and rejection of destructive financial deletes
- Atomic rollback of failed transactions
- Local-date and UTC-timestamp behavior
- Restart persistence in a second Electron process

`npm run test:production-database` builds the app and launches the production build twice
over the Chrome DevTools Protocol. It verifies:

- The database is created in the Electron userData directory (not the project)
- The approved IPC methods work in the built application
- The renderer has no database, SQL, Node.js, or `ipcRenderer` access
- The API surface is frozen and contains only the three approved methods
- The database and migration history survive a full application restart

Test artifacts are removed after successful runs.

## Internationalization

Arabic is the default language and the document is rendered as RTL from first paint. The
interface uses logical CSS properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`),
so the same components work in both directions. The language switch updates
`<html lang>` / `<html dir>` immediately and persists the choice locally.

## Phase scope

Completed:

- Electron + React + TypeScript application shell
- Secure preload/IPC foundation with live app metadata
- Premium dark UI, fully responsive desktop layout
- Complete Arabic/English switching with RTL/LTR support
- Locally bundled fonts and icons — no runtime network requests
- SQLite database foundation with versioned migrations
- All ten required tables, indexes, foreign keys, and history protections
- Database health, initialization status, and metadata IPC
- Database, restart, production-build, and renderer-isolation tests

Deferred until approval:

- Member management screens and member CRUD operations
- Membership plan and subscription workflows
- Payments, expenses, and attendance UI
- Authentication and operator-account management
- Notification and activity-log UI
- Packaging, installer, and auto-update strategy
