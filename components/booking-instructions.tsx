'use client'

type ParsedBookingInstructions = {
  jobType?: string
  bedrooms?: string
  bathrooms?: string
  propertyCondition?: string
  cleaningSupplies?: string
  notes?: string
  photoUrls: string[]
  fallbackLines: string[]
}

function sanitizeValue(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value.trim())
}

function labelFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname
    const file = pathname.split('/').pop() || 'Photo'
    return decodeURIComponent(file)
  } catch {
    return 'Photo'
  }
}

function parseSpecialInstructions(raw: string): ParsedBookingInstructions {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const parsed: ParsedBookingInstructions = {
    photoUrls: [],
    fallbackLines: [],
  }

  for (const line of lines) {
    if (line.startsWith('Job type:')) {
      parsed.jobType = sanitizeValue(line.replace('Job type:', ''))
      continue
    }
    if (line.startsWith('Bedrooms:')) {
      parsed.bedrooms = sanitizeValue(line.replace('Bedrooms:', ''))
      continue
    }
    if (line.startsWith('Bathrooms:')) {
      parsed.bathrooms = sanitizeValue(line.replace('Bathrooms:', ''))
      continue
    }
    if (line.startsWith('Property condition:')) {
      parsed.propertyCondition = sanitizeValue(line.replace('Property condition:', ''))
      continue
    }
    if (line.startsWith('Cleaning supplies:')) {
      parsed.cleaningSupplies = sanitizeValue(line.replace('Cleaning supplies:', ''))
      continue
    }
    if (line.startsWith('What needs to be cleaned:')) {
      parsed.notes = sanitizeValue(line.replace('What needs to be cleaned:', ''))
      continue
    }
    if (line.startsWith('Job photos')) {
      const maybeUrls = line.split(':').slice(1).join(':')
      const urls = maybeUrls
        .split(',')
        .map((value) => value.trim())
        .filter((value) => isHttpUrl(value))
      parsed.photoUrls.push(...urls)
      continue
    }
    parsed.fallbackLines.push(line)
  }

  return parsed
}

export function BookingInstructions({ value, compact = false }: { value: string; compact?: boolean }) {
  const parsed = parseSpecialInstructions(value)

  const details = [
    ['Job type', parsed.jobType],
    ['Bedrooms', parsed.bedrooms],
    ['Bathrooms', parsed.bathrooms],
    ['Property condition', parsed.propertyCondition],
    ['Cleaning supplies', parsed.cleaningSupplies],
  ].filter(([, val]) => Boolean(val)) as Array<[string, string]>

  return (
    <div className="mt-3 rounded-lg bg-slate-50 px-3 py-3">
      {details.length > 0 && (
        <div className={`grid gap-2 ${compact ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
          {details.map(([label, val]) => (
            <p key={label} className="text-xs text-slate-700">
              <span className="font-semibold text-slate-900">{label}:</span> {val}
            </p>
          ))}
        </div>
      )}

      {parsed.notes && (
        <div className="mt-2">
          <p className="text-xs font-semibold text-slate-900">What needs to be cleaned</p>
          <p className="mt-1 text-xs text-slate-700">{parsed.notes}</p>
        </div>
      )}

      {parsed.photoUrls.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-slate-900">Photos ({parsed.photoUrls.length})</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {parsed.photoUrls.map((url, idx) => (
              <a
                key={`${url}-${idx}`}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="group block overflow-hidden rounded-md border border-slate-200 bg-white"
                title={labelFromUrl(url)}
              >
                <img src={url} alt={`Job photo ${idx + 1}`} className="h-20 w-full object-cover transition-transform group-hover:scale-[1.02]" />
              </a>
            ))}
          </div>
        </div>
      )}

      {parsed.fallbackLines.length > 0 && (
        <div className="mt-2 space-y-1">
          {parsed.fallbackLines.map((line, idx) => (
            <p key={idx} className="text-xs text-slate-600">{line}</p>
          ))}
        </div>
      )}
    </div>
  )
}
