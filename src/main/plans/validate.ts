import type { PlanInput } from '../../shared/analytics'

export function validatePlanInput(value: unknown): PlanInput {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Plan data is invalid.')
  }

  const candidate = value as Record<string, unknown>

  if (typeof candidate.name !== 'string' || !candidate.name.trim()) {
    throw new Error('Plan name is required.')
  }

  const name = candidate.name.trim()
  if (name.length > 120) throw new Error('Plan name is too long.')

  if (
    typeof candidate.durationDays !== 'number' ||
    !Number.isInteger(candidate.durationDays) ||
    candidate.durationDays < 1 ||
    candidate.durationDays > 3650
  ) {
    throw new Error('Plan duration must be between 1 and 3650 days.')
  }

  if (typeof candidate.price !== 'number' || candidate.price < 0) {
    throw new Error('Plan price must be zero or positive.')
  }

  const description =
    candidate.description === null ||
    candidate.description === undefined ||
    candidate.description === ''
      ? null
      : typeof candidate.description === 'string'
        ? candidate.description.trim() || null
        : (() => {
            throw new Error('Plan description must be text.')
          })()

  if (description && description.length > 1000) {
    throw new Error('Plan description is too long.')
  }

  if (typeof candidate.isActive !== 'boolean') {
    throw new Error('Plan status is invalid.')
  }

  return {
    name,
    durationDays: candidate.durationDays,
    price: Math.round(candidate.price * 100) / 100,
    description,
    isActive: candidate.isActive
  }
}

export function validatePlanId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error('Plan ID is invalid.')
  }

  return value
}
