import type { Gender, MemberInput } from '../../shared/analytics'

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function requireText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new Error(`${field} must be text.`)
  }

  const trimmed = value.trim()

  if (!trimmed) {
    throw new Error(`${field} is required.`)
  }

  if (trimmed.length > maxLength) {
    throw new Error(`${field} is too long.`)
  }

  return trimmed
}

function optionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value !== 'string') {
    throw new Error(`${field} must be text.`)
  }

  const trimmed = value.trim()

  if (!trimmed) return null

  if (trimmed.length > maxLength) {
    throw new Error(`${field} is too long.`)
  }

  return trimmed
}

function validateDate(value: unknown, field: string, required: boolean): string {
  if (value === null || value === undefined || value === '') {
    if (required) throw new Error(`${field} is required.`)
    return ''
  }

  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) {
    throw new Error(`${field} must be a valid date.`)
  }

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(`${field} must be a valid date.`)
  }

  return value
}

function validateGender(value: unknown): Gender | null {
  if (value === null || value === undefined || value === '') return null
  if (value === 'male' || value === 'female' || value === 'other') return value
  throw new Error('Gender is invalid.')
}

function validatePhoto(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') throw new Error('Photo data is invalid.')

  if (!value.startsWith('data:image/')) {
    throw new Error('Photo data must be an image data URL.')
  }

  if (value.length > 700_000) {
    throw new Error('Photo data is too large.')
  }

  return value
}

export function validateMemberInput(value: unknown): MemberInput {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Member data is invalid.')
  }

  const candidate = value as Record<string, unknown>

  const fullName = requireText(candidate.fullName, 'Full name', 120)
  const phone = requireText(candidate.phone, 'Phone number', 40)
  const secondaryPhone = optionalText(candidate.secondaryPhone, 'Secondary phone', 40)
  const address = optionalText(candidate.address, 'Address', 500)
  const gender = validateGender(candidate.gender)
  const dateOfBirthRaw = validateDate(candidate.dateOfBirth, 'Date of birth', false)
  const dateOfBirth = dateOfBirthRaw || null
  const emergencyContact = optionalText(
    candidate.emergencyContact,
    'Emergency contact',
    160
  )
  const notes = optionalText(candidate.notes, 'Notes', 2000)
  const registrationDate = validateDate(
    candidate.registrationDate,
    'Registration date',
    true
  )
  const photoData = validatePhoto(candidate.photoData)

  return {
    fullName,
    phone,
    secondaryPhone,
    address,
    gender,
    dateOfBirth,
    emergencyContact,
    notes,
    registrationDate,
    photoData
  }
}

export function validateMemberId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error('Member ID is invalid.')
  }

  return value
}
