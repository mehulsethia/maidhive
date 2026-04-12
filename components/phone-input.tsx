'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const COUNTRY_CODES = [
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
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length)
  for (const c of sorted) {
    if (trimmed.startsWith(c.code)) {
      return { dialCode: c.code, number: trimmed.slice(c.code.length) }
    }
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
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // Sync from external value changes
  useEffect(() => {
    const p = parsePhone(value)
    setDialCode(p.dialCode)
    setNumber(p.number)
  }, [value])

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

  const selected = COUNTRY_CODES.find(c => c.code === dialCode) ?? COUNTRY_CODES[0]

  const filtered = search.trim()
    ? COUNTRY_CODES.filter(c =>
        c.label.toLowerCase().includes(search.toLowerCase()) ||
        c.code.includes(search) ||
        c.country.toLowerCase().includes(search.toLowerCase())
      )
    : COUNTRY_CODES

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

  return (
    <div ref={ref} className={cn('relative flex', className)}>
      {/* Country code button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-10 items-center gap-1 rounded-l-xl border border-r-0 border-input bg-slate-50 px-2.5 text-sm transition-colors hover:bg-slate-100 shrink-0"
      >
        <span className="text-base leading-none">{selected.flag}</span>
        <span className="text-slate-700 font-medium">{selected.code}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {/* Phone number input */}
      <input
        type="tel"
        value={number}
        onChange={e => handleNumberChange(e.target.value)}
        placeholder={placeholder ?? 'Phone number'}
        className="flex h-10 w-full rounded-r-xl border border-input bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-slate-400 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
      />

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-slate-200 bg-white shadow-lg">
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
