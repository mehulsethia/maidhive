type GeocodingResult = {
  latitude: number | null
  longitude: number | null
  provider: 'google'
  status: 'verified' | 'not_configured' | 'not_found' | 'failed'
}

export const geocodingService = {
  async geocodeServiceAddress(input: {
    address: string
    city: string
    postcode: string
    country: string
  }): Promise<GeocodingResult> {
    const apiKey = process.env.GOOGLE_GEOCODING_API_KEY?.trim()
    if (!apiKey) {
      return {
        latitude: null,
        longitude: null,
        provider: 'google',
        status: 'not_configured',
      }
    }

    const address = [input.address, input.city, input.postcode, input.country]
      .filter(Boolean)
      .join(', ')
    const params = new URLSearchParams({ address, key: apiKey })

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
        { cache: 'no-store', signal: AbortSignal.timeout(5000) },
      )
      if (!response.ok) throw new Error(`google_geocoding_http_${response.status}`)
      const body = (await response.json()) as {
        status?: string
        results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }>
      }
      const location = body.results?.[0]?.geometry?.location
      if (
        body.status !== 'OK' ||
        typeof location?.lat !== 'number' ||
        typeof location.lng !== 'number'
      ) {
        return {
          latitude: null,
          longitude: null,
          provider: 'google',
          status: 'not_found',
        }
      }
      return {
        latitude: location.lat,
        longitude: location.lng,
        provider: 'google',
        status: 'verified',
      }
    } catch (error) {
      console.error('geocoding.service_address.failed', {
        message: error instanceof Error ? error.message : String(error),
      })
      return {
        latitude: null,
        longitude: null,
        provider: 'google',
        status: 'failed',
      }
    }
  },
}
