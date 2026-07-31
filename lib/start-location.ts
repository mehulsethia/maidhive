export type StartLocationForVerification = {
  latitude: number
  longitude: number
  accuracy_m?: number
}

export type StartLocationUnavailableReason = 'permission_denied' | 'location_unavailable'

export type StartLocationAttempt =
  | { location: StartLocationForVerification; unavailableReason?: never }
  | { location?: undefined; unavailableReason: StartLocationUnavailableReason }

export async function getStartLocationForVerification(): Promise<StartLocationAttempt> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return { unavailableReason: 'location_unavailable' }
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 7000,
        maximumAge: 60000,
      })
    })
    return {
      location: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy_m: position.coords.accuracy,
      },
    }
  } catch (error) {
    // Starting a job must remain available if location permission is denied or unavailable.
    const code = typeof error === 'object' && error && 'code' in error ? Number((error as GeolocationPositionError).code) : null
    return {
      unavailableReason:
        code === 1 ? 'permission_denied' : 'location_unavailable',
    }
  }
}
