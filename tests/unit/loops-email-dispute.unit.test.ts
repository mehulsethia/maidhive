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
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.maidhive.test')
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

describe('Loops dispute emails', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('sends dispute submitted confirmation with the shared reporter template payload', async () => {
    const { loopsEmailService, fetchMock } = await loadLoopsEmailService()

    await loopsEmailService.sendDisputeSubmittedConfirmation({
      email: 'client@example.test',
      fullName: 'Client User',
      bookingReference: 'MH-1042',
      issueType: 'Service issue',
      disputePath: '/client/report?booking=booking_1042',
    })

    expect(lastRequestBody(fetchMock)).toEqual({
      transactionalId: 'cmqf1rb7r7z9q0jx99f8lq615',
      email: 'client@example.test',
      dataVariables: {
        first_name: 'Client',
        booking_reference: 'MH-1042',
        issue_type: 'Service issue',
        dispute_link: 'https://app.maidhive.test/client/report?booking=booking_1042',
      },
    })
  })

  it('sends dispute raised against notification with the shared counterparty template payload', async () => {
    const { loopsEmailService, fetchMock } = await loadLoopsEmailService()

    await loopsEmailService.sendDisputeRaisedAgainstNotification({
      email: 'cleaner@example.test',
      fullName: 'Cleaner User',
      bookingReference: 'MH-1042',
      issueType: 'Cleaner no-show',
      disputePath: '/cleaner/report?booking=booking_1042',
    })

    expect(lastRequestBody(fetchMock)).toEqual({
      transactionalId: 'cmqf1u9ly4ujo0jyq9kfdcfbw',
      email: 'cleaner@example.test',
      dataVariables: {
        first_name: 'Cleaner',
        booking_reference: 'MH-1042',
        issue_type: 'Cleaner no-show',
        dispute_link: 'https://app.maidhive.test/cleaner/report?booking=booking_1042',
      },
    })
  })

  it('sends dispute resolved outcome with booking, refund, payout and admin note variables', async () => {
    const { loopsEmailService, fetchMock } = await loadLoopsEmailService()

    await loopsEmailService.sendDisputeResolvedOutcome({
      email: 'client@example.test',
      fullName: 'Client User',
      bookingReference: 'MH-1042',
      resolutionOutcome: 'Partial refund €8.00 issued to client.',
      refundAmount: 8,
      cleanerPayoutOutcome: 'Cleaner payout adjusted to €16.00 after a €8.00 dispute adjustment.',
      resolutionNote: 'Partial service issue confirmed.',
    })

    expect(lastRequestBody(fetchMock)).toEqual({
      transactionalId: 'cmrgn2k8m29v60jzktfiu6iap',
      email: 'client@example.test',
      dataVariables: {
        first_name: 'Client',
        booking_reference: 'MH-1042',
        resolution_outcome: 'Partial refund €8.00 issued to client.',
        refund_amount: '€8.00',
        cleaner_payout_outcome: 'Cleaner payout adjusted to €16.00 after a €8.00 dispute adjustment.',
        resolution_note: 'Partial service issue confirmed.',
      },
    })
  })
})
