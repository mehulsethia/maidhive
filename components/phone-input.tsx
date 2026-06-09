'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type CountryCodeOption = {
  code: string
  country: string
  flag: string
  label: string
}

const DEFAULT_COUNTRY_CODES: CountryCodeOption[] = [
  { code: '+357', country: 'CY', flag: '🇨🇾', label: 'Cyprus' },
  { code: '+353', country: 'IE', flag: '🇮🇪', label: 'Ireland' },
  { code: '+44', country: 'GB', flag: '🇬🇧', label: 'United Kingdom' },
  { code: '+30', country: 'GR', flag: '🇬🇷', label: 'Greece' },
  { code: '+49', country: 'DE', flag: '🇩🇪', label: 'Germany' },
  { code: '+33', country: 'FR', flag: '🇫🇷', label: 'France' },
  { code: '+34', country: 'ES', flag: '🇪🇸', label: 'Spain' },
  { code: '+39', country: 'IT', flag: '🇮🇹', label: 'Italy' },
  { code: '+31', country: 'NL', flag: '🇳🇱', label: 'Netherlands' },
  { code: '+1', country: 'US', flag: '🇺🇸', label: 'United States' },
  { code: '+91', country: 'IN', flag: '🇮🇳', label: 'India' },
  { code: '+61', country: 'AU', flag: '🇦🇺', label: 'Australia' },
  { code: '+971', country: 'AE', flag: '🇦🇪', label: 'UAE' },
  { code: '+90', country: 'TR', flag: '🇹🇷', label: 'Turkey' },
  { code: '+48', country: 'PL', flag: '🇵🇱', label: 'Poland' },
  { code: '+40', country: 'RO', flag: '🇷🇴', label: 'Romania' },
  { code: '+359', country: 'BG', flag: '🇧🇬', label: 'Bulgaria' },
]

/**
 * Parse a full phone string like "+357 99123456" into { dialCode, number }.
 * Tries longest match first so "+971" matches before "+9".
 */
export function parsePhone(full: string): { dialCode: string; number: string } {
  const trimmed = full.replace(/\s+/g, '').trim()
  if (!trimmed.startsWith('+')) return { dialCode: '+357', number: trimmed }

  // Sort by code length desc so longer codes match first
  const sorted = [...DEFAULT_COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length)
  for (const c of sorted) {
    if (trimmed.startsWith(c.code)) {
      return { dialCode: c.code, number: trimmed.slice(c.code.length) }
    }
  }
  const genericMatch = trimmed.match(/^(\+\d{1,4})(.*)$/)
  if (genericMatch) {
    return { dialCode: genericMatch[1], number: genericMatch[2] ?? '' }
  }
  return { dialCode: '+357', number: trimmed.replace(/^\+/, '') }
}

/** Combine dial code and number into a full phone string */
export function formatFullPhone(dialCode: string, number: string): string {
  const cleaned = number.replace(/\s+/g, '').trim()
  if (!cleaned) return ''
  return `${dialCode}${cleaned}`
}

interface PhoneInputProps {
  value: string
  onChange: (fullPhone: string) => void
  className?: string
  placeholder?: string
}

export function PhoneInput({ value, onChange, className, placeholder }: PhoneInputProps) {
  const parsed = parsePhone(value)
  const [dialCode, setDialCode] = useState(parsed.dialCode)
  const [number, setNumber] = useState(parsed.number)
  const [countryCodes, setCountryCodes] = useState<CountryCodeOption[]>(DEFAULT_COUNTRY_CODES)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // Sync from external value changes
  useEffect(() => {
    const p = parsePhone(value)
    setDialCode(p.dialCode)
    setNumber(p.number)
  }, [value])

  // Load complete country list for dropdown (fallback to static defaults if request fails)
  useEffect(() => {
    let active = true
    async function loadAllCountries() {
      try {
        const response = await fetch('https://restcountries.com/v3.1/all?fields=cca2,name,idd,flag')
        if (!response.ok) return
        const rows = (await response.json()) as Array<{
          cca2?: string
          flag?: string
          name?: { common?: string }
          idd?: { root?: string; suffixes?: string[] }
        }>
        const seen = new Set<string>()
        const options: CountryCodeOption[] = []
        for (const row of rows) {
          const root = row.idd?.root ?? ''
          const suffixes = row.idd?.suffixes ?? []
          const suffix = suffixes[0] ?? ''
          if (!root || !suffix) continue
          const code = `${root}${suffix}`
          if (!/^\+\d{1,4}$/.test(code)) continue
          if (seen.has(code)) continue
          seen.add(code)
          options.push({
            code,
            country: row.cca2 ?? 'ZZ',
            flag: row.flag ?? '🌐',
            label: row.name?.common ?? code,
          })
        }

        if (options.length === 0 || !active) return
        options.sort((a, b) => a.label.localeCompare(b.label))
        const cyprus = options.find((option) => option.country === 'CY' || option.code === '+357')
        const withoutCyprus = options.filter((option) => option !== cyprus)
        setCountryCodes(cyprus ? [cyprus, ...withoutCyprus] : [{ code: '+357', country: 'CY', flag: '🇨🇾', label: 'Cyprus' }, ...withoutCyprus])
      } catch {
        // Keep static fallback list
      }
    }
    loadAllCountries()
    return () => { active = false }
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const selected = countryCodes.find(c => c.code === dialCode) ?? { code: dialCode, country: 'ZZ', flag: '🌐', label: 'Custom' }
  const selectedLabel = countryCodes.find(c => c.code === dialCode)?.label ?? 'Custom'

  const filtered = search.trim()
    ? countryCodes.filter(c =>
        c.label.toLowerCase().includes(search.toLowerCase()) ||
        c.code.includes(search) ||
        c.country.toLowerCase().includes(search.toLowerCase())
      )
    : countryCodes

  function selectCode(code: string) {
    setDialCode(code)
    setOpen(false)
    setSearch('')
    onChange(formatFullPhone(code, number))
  }

  function handleNumberChange(val: string) {
    setNumber(val)
    onChange(formatFullPhone(dialCode, val))
  }

  function handleDialCodeInput(val: string) {
    const sanitized = `+${val.replace(/[^\d]/g, '').slice(0, 4)}`
    setDialCode(sanitized === '+' ? '+357' : sanitized)
    onChange(formatFullPhone(sanitized === '+' ? '+357' : sanitized, number))
  }

  return (
    <div ref={ref} className={cn('relative flex min-w-0', className)}>
      {/* Country code selector + manual code */}
      <div className="flex h-10 shrink-0 items-center gap-1 rounded-l-xl border border-r-0 border-input bg-slate-50 px-2 text-sm">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1 rounded-md px-1 py-1 transition-colors hover:bg-slate-100"
          title={selectedLabel}
        >
          <span className="text-base leading-none">{selected.flag}</span>
          <ChevronDown className={cn('h-3.5 w-3.5 text-slate-400 transition-transform', open && 'rotate-180')} />
        </button>
        <input
          type="text"
          value={dialCode}
          onChange={(e) => handleDialCodeInput(e.target.value)}
          className="w-14 bg-transparent text-sm font-medium text-slate-700 outline-none sm:w-[64px]"
          aria-label="Dial code"
          placeholder="+357"
        />
      </div>

      {/* Phone number input */}
      <input
        type="tel"
        value={number}
        onChange={e => handleNumberChange(e.target.value)}
        placeholder={placeholder ?? 'Phone number'}
        className="min-w-0 flex h-10 w-full rounded-r-xl border border-input bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-slate-400 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
      />

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-[min(16rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="p-2">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search country..."
              autoFocus
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
          <div className="max-h-48 overflow-y-auto px-1 pb-1">
            {filtered.map(c => (
              <button
                key={c.code + c.country}
                type="button"
                onClick={() => selectCode(c.code)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-slate-100',
                  c.code === dialCode && 'bg-primary/5 text-primary font-medium',
                )}
              >
                <span className="text-base leading-none">{c.flag}</span>
                <span className="flex-1 text-left truncate">{c.label}</span>
                <span className="text-slate-500 text-xs">{c.code}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-sm text-slate-400">No results</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
