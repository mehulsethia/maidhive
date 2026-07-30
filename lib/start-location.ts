export type StartLocationForVerification = {
  latitude: number
  longitude: number
  accuracy_m?: number
}

export async function getStartLocationForVerification(): Promise<StartLocationForVerification | undefined> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return undefined

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 7000,
        maximumAge: 60000,
      })
    })
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy_m: position.coords.accuracy,
    }
  } catch {
    // Starting a job must remain available if location permission is denied or unavailable.
    return undefined
  }
}
