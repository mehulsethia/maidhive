import { afterEach, describe, expect, it, vi } from 'vitest'
import { getStartLocationForVerification } from '@/lib/start-location'

describe('start location helper', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns browser coordinates for Start Job verification', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: vi.fn((resolve: PositionCallback) => {
          resolve({
            coords: {
              latitude: 34.917,
              longitude: 33.629,
              accuracy: 35,
            },
          } as GeolocationPosition)
        }),
      },
    })

    await expect(getStartLocationForVerification()).resolves.toEqual({
      location: {
        latitude: 34.917,
        longitude: 33.629,
        accuracy_m: 35,
      },
    })
  })

  it('allows Start Job to continue when GPS is unavailable', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: vi.fn((_resolve: PositionCallback, reject: PositionErrorCallback) => {
          reject(new Error('denied') as unknown as GeolocationPositionError)
        }),
      },
    })

    await expect(getStartLocationForVerification()).resolves.toEqual({
      unavailableReason: 'location_unavailable',
    })
  })

  it('records permission denial distinctly from unavailable GPS', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: vi.fn((_resolve: PositionCallback, reject: PositionErrorCallback) => {
          reject({ code: 1, message: 'denied' } as GeolocationPositionError)
        }),
      },
    })

    await expect(getStartLocationForVerification()).resolves.toEqual({
      unavailableReason: 'permission_denied',
    })
  })
})
