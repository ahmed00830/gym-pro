/**
 * Date helpers for the database boundary.
 *
 * Business dates (registration, payment, attendance, subscription periods)
 * are stored as local ISO calendar dates in `YYYY-MM-DD` form. Audit
 * timestamps are stored as UTC ISO-8601 timestamps. Keeping those two kinds
 * of values separate avoids the common bug where a date shifts by one day for
 * users east or west of UTC.
 */

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/** Returns true for a valid `HH:MM:SS` local wall-clock time. */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/

export function isValidLocalIsoTime(value: string): boolean {
  return TIME_PATTERN.test(value)
}

/** Returns true for a valid `YYYY-MM-DD` local calendar date. */
export function isValidLocalIsoDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value)

  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day, 12, 0, 0, 0)

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0')
}

/** Returns the local calendar date as `YYYY-MM-DD`. */
export function toLocalIsoDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Returns the local wall-clock time as `HH:MM:SS`. */
export function toLocalIsoTime(date: Date = new Date()): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** Returns a UTC ISO-8601 timestamp suitable for audit columns. */
export function toUtcIsoTimestamp(date: Date = new Date()): string {
  return date.toISOString()
}

/**
 * Adds calendar days to a local ISO date without converting through UTC.
 * Noon is used as the anchor so daylight-saving transitions cannot move the
 * resulting calendar day.
 */
export function addDaysToLocalIsoDate(isoDate: string, days: number): string {
  const match = ISO_DATE_PATTERN.exec(isoDate)

  if (!match) {
    throw new Error(`Invalid ISO date: ${isoDate}`)
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const anchor = new Date(year, month - 1, day + days, 12, 0, 0, 0)

  return toLocalIsoDate(anchor)
}
