import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/server/repositories/cleaner.repo', () => ({
  cleanerRepo: {
    findById: vi.fn(async () => null),
  },
}))

async function loadLoopsEmailService() {
  vi.resetModules()
  vi.stubEnv('LOOPS_API_KEY', 'test-loops-key')
  vi.stubEnv('LOOPS_TRANSACTIONAL_ENDPOINT', 'https://loops.test/transactional')
  const fetchMock = vi.fn(async () => new Response('', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)

  const { loopsEmailService } = await import('@/server/services/loops-email.service')
  return { loopsEmailService, fetchMock }
}

function lastRequestBody(fetchMock: ReturnType<typeof vi.fn>) {
  const request = fetchMock.mock.calls.at(-1)
  expect(request).toBeTruthy()
  const init = request?.[1] as RequestInit
  return JSON.parse(String(init.body))
}

describe('Loops amendment emails', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('sends amendment expiry email with the shared expiry template payload', async () => {
    const { loopsEmailService, fetchMock } = await loadLoopsEmailService()
    const scheduledStart = new Date('2026-06-12T10:30:00.000Z')

    await loopsEmailService.sendAmendmentRequestExpired({
      email: 'client@example.test',
      fullName: 'Client User',
      scheduledStart,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://loops.test/transactional',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-loops-key',
          'Content-Type': 'application/json',
        }),
      }),
    )
    expect(lastRequestBody(fetchMock)).toEqual({
      transactionalId: 'cmqb0lh2j0fmu0jxihl9pz3qa',
      email: 'client@example.test',
      dataVariables: {
        FirstName: 'Client',
        Date: '12 Jun 2026',
        Time: '13:30',
      },
    })
  })

  it('sends amendment accepted email with original and new time variables', async () => {
    const { loopsEmailService, fetchMock } = await loadLoopsEmailService()
    const originalStart = new Date('2026-06-12T10:30:00.000Z')
    const newStart = new Date('2026-06-12T12:00:00.000Z')

    await loopsEmailService.sendAmendmentRequestAccepted({
      email: 'cleaner@example.test',
      fullName: 'Cleaner User',
      originalStart,
      newStart,
    })

    expect(lastRequestBody(fetchMock)).toEqual({
      transactionalId: 'cmqb0soch2eyc0j0170n9yjfh',
      email: 'cleaner@example.test',
      dataVariables: {
        FirstName: 'Cleaner',
        OriginalDate: '12 Jun 2026',
        OriginalTime: '13:30',
        NewDate: '12 Jun 2026',
        NewTime: '15:00',
      },
    })
  })

  it('sends amendment declined email with original booking time variables', async () => {
    const { loopsEmailService, fetchMock } = await loadLoopsEmailService()
    const originalStart = new Date('2026-06-12T10:30:00.000Z')

    await loopsEmailService.sendAmendmentRequestDeclined({
      email: 'client@example.test',
      fullName: 'Client User',
      originalStart,
    })

    expect(lastRequestBody(fetchMock)).toEqual({
      transactionalId: 'cmqf2hr134x6k0jyq8c6kg4d7',
      email: 'client@example.test',
      dataVariables: {
        FirstName: 'Client',
        OriginalDate: '12 Jun 2026',
        OriginalTime: '13:30',
      },
    })
  })
})
