import { afterEach, describe, expect, it, vi } from 'vitest'
import { geocodingService } from '@/server/services/geocoding.service'

describe('geocoding service', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('returns verified coordinates from Google Geocoding when configured', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      status: 'OK',
      results: [
        {
          geometry: {
            location: {
              lat: 34.917,
              lng: 33.629,
            },
          },
        },
      ],
    })))
    vi.stubEnv('GOOGLE_GEOCODING_API_KEY', 'test-google-key')
    vi.stubGlobal('fetch', fetchMock)

    const result = await geocodingService.geocodeServiceAddress({
      address: '1 Test Street',
      city: 'Larnaca',
      postcode: '6020',
      country: 'CY',
    })

    expect(result).toEqual({
      latitude: 34.917,
      longitude: 33.629,
      provider: 'google',
      status: 'verified',
    })
    const requestedUrl = String((fetchMock.mock.calls as any)[0][0])
    expect(requestedUrl).toContain('maps.googleapis.com/maps/api/geocode/json')
    expect(requestedUrl).toContain('key=test-google-key')
  })

  it('marks geocoding as not configured when the key is missing', async () => {
    vi.stubEnv('GOOGLE_GEOCODING_API_KEY', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(geocodingService.geocodeServiceAddress({
      address: '1 Test Street',
      city: 'Larnaca',
      postcode: '6020',
      country: 'CY',
    })).resolves.toEqual({
      latitude: null,
      longitude: null,
      provider: 'google',
      status: 'not_configured',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails closed without throwing when Google does not return coordinates', async () => {
    vi.stubEnv('GOOGLE_GEOCODING_API_KEY', 'test-google-key')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      status: 'ZERO_RESULTS',
      results: [],
    }))))

    await expect(geocodingService.geocodeServiceAddress({
      address: 'Unknown',
      city: 'Larnaca',
      postcode: '6020',
      country: 'CY',
    })).resolves.toEqual({
      latitude: null,
      longitude: null,
      provider: 'google',
      status: 'not_found',
    })
  })
})
