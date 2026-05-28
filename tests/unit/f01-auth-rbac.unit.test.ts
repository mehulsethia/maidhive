import { describe, expect, it } from 'vitest'
import { hasAnyRole } from '@/server/lib/rbac'

describe('F01 Auth + RBAC unit scaffold', () => {
  it('UT-AUTH-03 allows users with an allowed role', () => {
    expect(hasAnyRole('admin', ['admin'])).toBe(true)
    expect(hasAnyRole('cleaner', ['client', 'cleaner'])).toBe(true)
  })

  it('UT-AUTH-03 denies users without an allowed role', () => {
    expect(hasAnyRole('client', ['admin'])).toBe(false)
  })

  it.todo('UT-AUTH-01 valid role claims resolve to expected app role')
  it.todo('UT-AUTH-02 missing/expired session maps to unauthenticated outcome')
  it.todo('UT-AUTH-04 role parser rejects unknown roles safely')
})
